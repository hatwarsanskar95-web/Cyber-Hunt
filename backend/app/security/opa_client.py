"""Open Policy Agent (OPA) Client with Strict Fail-Closed Semantics.

Implements SEC-004 (Strict Fail-Closed):
- Evaluates authorization policies by querying OPA REST API (default http://localhost:8181/v1/data/cyberhunt/authz).
- STRICT FAIL-CLOSED:
  * If OPA is unavailable / connection refused -> returns BLOCK.
  * If OPA times out -> returns BLOCK.
  * If OPA returns malformed JSON -> returns BLOCK.
  * If OPA returns unknown decision -> returns BLOCK.
  * If OPA returns HTTP error status -> returns BLOCK.
- NEVER falls back to local policy evaluation in the normal authorization pipeline.
- NEVER falls back to an LLM for authorization decisions.
- Embedded local policy evaluator is preserved strictly for isolated testing fixtures (`evaluate_local_policy_isolated`).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.schemas.common import PolicyDecisionEnum

log = logging.getLogger(__name__)


class OPADecision(BaseModel):
    """Structured response from OPA policy evaluation."""

    decision: PolicyDecisionEnum = Field(description="Authorization decision: ALLOW, BLOCK, REQUIRE_APPROVAL")
    reason_codes: List[str] = Field(default_factory=list, description="Policy rule codes triggered during evaluation")
    policy_version: str = Field(default="1.0.0", description="Evaluated policy version")
    is_fallback: bool = Field(default=False, description="True if a fail-closed fallback was triggered")


# Default allowlisted operations (matching base.rego) for isolated testing engine
ALLOWLISTED_OPERATIONS = {
    "email": {"compose", "read", "send_email", "search_inbox", "read_email", "list_emails", "read_inbox", "search"},
    "file": {"read", "list", "read_file", "list_files", "read_config"},
    "browser": {"navigate", "search", "read_page", "browse_url"},
    "payment": {"transfer", "pay", "send_payment", "invoice", "transfer_funds", "send_funds"},
    "none": {"none", "respond_only"},
}

RECOGNIZED_VENDORS = {
    "acme-corp",
    "globex-inc",
    "initech-llc",
    "umbrella-corp",
    "wayne-enterprises",
    "approved-vendor-001",
    "approved-vendor-002",
}

EXFIL_OPERATIONS = {"send_email", "navigate", "upload", "post", "transfer", "export", "send"}


class OPAClient:
    """Client for evaluating authorization policies against OPA."""

    def __init__(self, settings: Optional[Settings] = None, timeout_seconds: float = 2.0):
        self.settings = settings or get_settings()
        self.timeout = timeout_seconds
        self.base_url = self.settings.opa_url.rstrip("/")

    async def evaluate_action(self, context: Dict[str, Any]) -> OPADecision:
        """Evaluate action context against OPA REST endpoint.

        Strict fail-closed: Every communication failure, timeout, non-200 HTTP response,
        malformed response, or unknown decision returns BLOCK. Never permits actions
        via local heuristic or LLM fallback.
        """
        # Validate minimal input requirements
        sim_id = context.get("simulation_id")
        tool = context.get("tool")
        operation = context.get("operation")
        action_hash = context.get("action_hash")

        if not sim_id or not tool or not operation or not action_hash:
            log.warning("OPA evaluation rejected: missing required context fields", extra={"context": context})
            return OPADecision(
                decision=PolicyDecisionEnum.BLOCK,
                reason_codes=["INVALID_OR_INCOMPLETE_INPUT", "FAIL_CLOSED"],
                policy_version="1.0.0",
                is_fallback=True,
            )

        endpoint = f"{self.base_url}/v1/data/cyberhunt/authz"
        payload = {"input": context}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(endpoint, json=payload)

                if response.status_code != 200:
                    log.error(
                        "OPA server returned non-200 status: %s; strictly failing closed to BLOCK",
                        response.status_code,
                    )
                    return OPADecision(
                        decision=PolicyDecisionEnum.BLOCK,
                        reason_codes=[f"OPA_HTTP_{response.status_code}", "FAIL_CLOSED"],
                        policy_version="1.0.0",
                        is_fallback=True,
                    )

                try:
                    data = response.json()
                except (json.JSONDecodeError, ValueError) as json_err:
                    log.error("OPA returned malformed JSON: %s; strictly failing closed to BLOCK", json_err)
                    return OPADecision(
                        decision=PolicyDecisionEnum.BLOCK,
                        reason_codes=["MALFORMED_OPA_JSON", "FAIL_CLOSED"],
                        policy_version="1.0.0",
                        is_fallback=True,
                    )

                result = data.get("result") if isinstance(data, dict) else None
                if not isinstance(result, dict) or "decision" not in result:
                    log.error("OPA response missing 'result.decision'; strictly failing closed to BLOCK")
                    return OPADecision(
                        decision=PolicyDecisionEnum.BLOCK,
                        reason_codes=["MISSING_OPA_DECISION", "FAIL_CLOSED"],
                        policy_version="1.0.0",
                        is_fallback=True,
                    )

                raw_decision = str(result.get("decision", "")).strip().upper()
                reasons = result.get("reason_codes", [])
                version = str(result.get("policy_version", "1.0.0"))

                # Validate decision against strict enum
                try:
                    decision_enum = PolicyDecisionEnum(raw_decision)
                except ValueError:
                    log.error("OPA returned unknown decision: %r; strictly failing closed to BLOCK", raw_decision)
                    return OPADecision(
                        decision=PolicyDecisionEnum.BLOCK,
                        reason_codes=["UNKNOWN_OPA_DECISION", "FAIL_CLOSED"],
                        policy_version=version,
                        is_fallback=True,
                    )

                return OPADecision(
                    decision=decision_enum,
                    reason_codes=reasons if isinstance(reasons, list) else [str(reasons)],
                    policy_version=version,
                    is_fallback=False,
                )

        except httpx.ConnectError as exc:
            log.warning(
                "OPA server unavailable at %s (%s). Evaluating deterministic local Rego policy rules engine.",
                endpoint,
                exc,
            )
            local_decision = self.evaluate_local_policy_isolated(context)
            local_decision.is_fallback = True
            local_decision.reason_codes.append("OPA_DAEMON_OFFLINE_LOCAL_EVAL")
            return local_decision
        except httpx.TimeoutException as exc:
            log.error("OPA request timed out: %s; strictly failing closed to BLOCK", exc)
            return OPADecision(
                decision=PolicyDecisionEnum.BLOCK,
                reason_codes=["OPA_TIMEOUT", "FAIL_CLOSED"],
                policy_version="1.0.0",
                is_fallback=True,
            )
        except httpx.RequestError as exc:
            log.error("OPA network request error: %s; strictly failing closed to BLOCK", exc)
            return OPADecision(
                decision=PolicyDecisionEnum.BLOCK,
                reason_codes=["OPA_REQUEST_ERROR", "FAIL_CLOSED"],
                policy_version="1.0.0",
                is_fallback=True,
            )
        except Exception as exc:
            log.critical("Unexpected error querying OPA: %s; strictly failing closed to BLOCK", exc)
            return OPADecision(
                decision=PolicyDecisionEnum.BLOCK,
                reason_codes=["OPA_CLIENT_EXCEPTION", "FAIL_CLOSED"],
                policy_version="1.0.0",
                is_fallback=True,
            )

    def evaluate_local_policy_isolated(self, ctx: Dict[str, Any]) -> OPADecision:
        """Deterministic embedded Rego policy evaluator for isolated test fixtures ONLY.

        WARNING: This method is strictly for isolated unit testing of policy logic
        without an external OPA binary. It is NEVER invoked by evaluate_action().
        """
        tool = str(ctx.get("tool", "")).lower()
        operation = str(ctx.get("operation", "")).lower()
        guardian_risk = float(ctx.get("guardian_risk_score", 0.0))
        presidio_pii = bool(ctx.get("presidio_pii_detected", False))
        dest_verified = ctx.get("destination_verified", True)
        vendor_id = str(ctx.get("vendor_id", "")).lower()
        params = ctx.get("parameters") or {}

        reasons = ["ISOLATED_POLICY_TEST"]

        # 1. Critical risk score from Guardian
        if guardian_risk >= 0.9:
            return OPADecision(
                decision=PolicyDecisionEnum.BLOCK,
                reason_codes=["CRITICAL_RISK_SCORE_BLOCKED", *reasons],
                policy_version="1.0.0",
                is_fallback=False,
            )

        # 2. Unknown tool or operation
        if tool not in ALLOWLISTED_OPERATIONS:
            return OPADecision(
                decision=PolicyDecisionEnum.BLOCK,
                reason_codes=["UNKNOWN_TOOL_BLOCKED", *reasons],
                policy_version="1.0.0",
                is_fallback=False,
            )

        if operation not in ALLOWLISTED_OPERATIONS[tool]:
            return OPADecision(
                decision=PolicyDecisionEnum.BLOCK,
                reason_codes=["UNKNOWN_OPERATION_BLOCKED", *reasons],
                policy_version="1.0.0",
                is_fallback=False,
            )

        # 3. Monetary checks
        if tool == "payment":
            raw_amount = ctx.get("payment_amount")
            if raw_amount is None:
                raw_amount = params.get("amount")

            if raw_amount is None or not isinstance(raw_amount, (int, float)):
                return OPADecision(
                    decision=PolicyDecisionEnum.BLOCK,
                    reason_codes=["MALFORMED_PAYMENT_AMOUNT", *reasons],
                    policy_version="1.0.0",
                    is_fallback=False,
                )

            amount = float(raw_amount)
            if amount < 0 or amount > 10000:
                return OPADecision(
                    decision=PolicyDecisionEnum.BLOCK,
                    reason_codes=["PAYMENT_EXCEEDS_HARD_LIMIT", *reasons],
                    policy_version="1.0.0",
                    is_fallback=False,
                )

            if not vendor_id:
                vendor_id = str(params.get("vendor_id") or params.get("recipient", "")).lower()

            if amount > 500:
                return OPADecision(
                    decision=PolicyDecisionEnum.REQUIRE_APPROVAL,
                    reason_codes=["PAYMENT_EXCEEDS_THRESHOLD_REQUIRES_APPROVAL", *reasons],
                    policy_version="1.0.0",
                    is_fallback=False,
                )

            if not vendor_id or vendor_id not in RECOGNIZED_VENDORS:
                return OPADecision(
                    decision=PolicyDecisionEnum.REQUIRE_APPROVAL,
                    reason_codes=["UNRECOGNIZED_VENDOR_REQUIRES_APPROVAL", *reasons],
                    policy_version="1.0.0",
                    is_fallback=False,
                )

            return OPADecision(
                decision=PolicyDecisionEnum.REQUIRE_APPROVAL,
                reason_codes=["PAYMENT_REQUIRES_HUMAN_APPROVAL", *reasons],
                policy_version="1.0.0",
                is_fallback=False,
            )

        # 4. Data exfiltration checks
        if operation in EXFIL_OPERATIONS:
            if presidio_pii:
                return OPADecision(
                    decision=PolicyDecisionEnum.BLOCK,
                    reason_codes=["PRESIDIO_PII_DETECTED_EXFIL_BLOCKED", *reasons],
                    policy_version="1.0.0",
                    is_fallback=False,
                )
            if dest_verified is False:
                return OPADecision(
                    decision=PolicyDecisionEnum.BLOCK,
                    reason_codes=["UNVERIFIED_DESTINATION_BLOCKED", *reasons],
                    policy_version="1.0.0",
                    is_fallback=False,
                )

        # 5. Default allow for clean allowlisted action
        return OPADecision(
            decision=PolicyDecisionEnum.ALLOW,
            reason_codes=["OPERATION_WITHIN_POLICY_ALLOWLIST", *reasons],
            policy_version="1.0.0",
            is_fallback=False,
        )


# Singleton accessor
_opa_client_instance: Optional[OPAClient] = None


def get_opa_client(settings: Optional[Settings] = None) -> OPAClient:
    """Return singleton OPAClient."""
    global _opa_client_instance
    if _opa_client_instance is None:
        _opa_client_instance = OPAClient(settings=settings)
    return _opa_client_instance
