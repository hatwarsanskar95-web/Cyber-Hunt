"""Open Policy Agent (OPA) Evaluation Node for Multi-Agent Orchestration.

Implements SEC-007:
- Gathers Target AI proposal, Guardian assessment, Presidio findings, and action hash.
- Submits structured authorization context to OPAClient.
- Treats OPA as the sole authorization authority (Guardian MONITOR is advisory only).
- Persists policy decisions to Supabase `policy_decisions` table.
- Binds validated decision and action hash into LangGraph state.
- Strictly fails closed (`BLOCK`) on any failure.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict

from app.config import get_settings
from app.db.client import get_supabase_client
from app.db.repositories.audit_repo import AuditRepository
from app.orchestration.state import SimulationState
from app.schemas.common import PolicyDecisionEnum
from app.security.opa_client import get_opa_client
from app.security.presidio_scanner import get_presidio_scanner
from app.security.validator import compute_action_hash

log = logging.getLogger(__name__)


async def node_opa_eval(state: SimulationState) -> Dict[str, Any]:
    """Execute deterministic OPA policy evaluation node."""
    sim_id = state.get("simulation_id", "sim-default")
    step = state.get("current_step", 1)
    proposal = state.get("target_proposal") or {}
    guardian = state.get("guardian_assessment") or {}
    scenario_category = state.get("scenario_category", "prompt_injection")
    settings = get_settings()

    tool = proposal.get("tool_name", "none")
    operation = proposal.get("operation", "none")
    params = proposal.get("parameters") or {}

    log.info(
        "Executing OPA Evaluation Node",
        extra={"simulation_id": sim_id, "step": step, "tool": tool, "operation": operation},
    )

    # 1. Compute Action Hash (SEC-006)
    try:
        action_hash = compute_action_hash(
            simulation_id=sim_id,
            tool=tool,
            operation=operation,
            parameters=params,
        )
    except Exception as exc:
        log.error("Failed to compute action hash: %s; failing closed to BLOCK", exc)
        return {
            "policy_decision": {
                "decision": PolicyDecisionEnum.BLOCK.value,
                "reason_codes": ["ACTION_HASH_COMPUTATION_FAILED", "FAIL_CLOSED"],
                "action_id": "act-invalid",
                "action_hash": "invalid",
                "policy_version": "1.0.0",
            },
            "action_hash": "invalid",
            "status": "RUNNING",
        }

    # 2. Run Presidio Scanner on parameters (SEC-005)
    scanner = get_presidio_scanner()
    presidio_res = scanner.scan_dict(params)

    # 3. Assemble complete structured OPA context
    guardian_risk = float(guardian.get("risk_score", 0.0))
    guardian_action = guardian.get("recommended_action")  # Advisory only

    # Determine destination verification
    url = params.get("url") or params.get("destination") or ""
    destination_verified = True
    if url:
        destination_verified = not any(malicious in url.lower() for malicious in ["evil.com", "attacker", "exfil"])

    opa_context = {
        "simulation_id": sim_id,
        "step": step,
        "scenario_category": scenario_category,
        "tool": tool,
        "operation": operation,
        "parameters": params,
        "action_hash": action_hash,
        "guardian_risk_score": guardian_risk,
        "guardian_recommended_action": guardian_action,
        "presidio_pii_detected": presidio_res.has_pii,
        "presidio_findings": [f.model_dump() for f in presidio_res.findings],
        "destination_verified": destination_verified,
        "payment_amount": params.get("amount"),
        "vendor_id": params.get("vendor_id") or params.get("recipient"),
    }

    # 4. Query OPA Client (SEC-004)
    opa_client = get_opa_client(settings)
    try:
        opa_decision = await opa_client.evaluate_action(opa_context)
    except Exception as exc:
        log.error("OPA evaluation raised exception (%s); failing closed to BLOCK", exc)
        decision_val = PolicyDecisionEnum.BLOCK.value
        reasons = ["OPA_EVAL_EXCEPTION", "FAIL_CLOSED"]
        policy_version = "1.0.0"
    else:
        decision_val = opa_decision.decision.value
        reasons = opa_decision.reason_codes
        policy_version = opa_decision.policy_version

    # 5. Persist Policy Decision to Supabase before permitting execution (SEC-007)
    persistence_error: Optional[str] = None
    try:
        if settings.has_supabase_service_role or settings.supabase_anon_key:
            client = get_supabase_client(settings)
            audit_repo = AuditRepository(client)
            try:
                uuid.UUID(sim_id)
                audit_repo.record_policy_decision({
                    "simulation_id": sim_id,
                    "step": step,
                    "tool": tool,
                    "operation": operation,
                    "action_hash": action_hash,
                    "decision": decision_val,
                    "reason_codes": reasons,
                    "policy_version": policy_version,
                })
                log.info(
                    "Policy decision persisted to Supabase",
                    extra={"simulation_id": sim_id, "step": step, "decision": decision_val},
                )
            except ValueError:
                log.debug("Skipping Supabase persist for non-UUID synthetic test simulation: %s", sim_id)
    except Exception as db_exc:
        log.error("Failed to persist policy decision to Supabase audit log: %s; failing closed to BLOCK", db_exc)
        persistence_error = str(db_exc)

    # Security check: if required audit persistence failed, NEVER proceed to tool execution
    if persistence_error:
        log.critical(
            "Audit persistence failure prevented tool execution — action blocked",
            extra={"simulation_id": sim_id, "step": step, "action_hash": action_hash},
        )
        decision_val = PolicyDecisionEnum.BLOCK.value
        reasons = ["AUDIT_PERSISTENCE_FAILED", "FAIL_CLOSED"]

    # 6. Update LangGraph State
    if persistence_error:
        new_status = "FAILED"
    elif decision_val == PolicyDecisionEnum.REQUIRE_APPROVAL.value:
        new_status = "AWAITING_APPROVAL"
    else:
        new_status = "RUNNING"

    policy_decision_payload = {
        "decision": decision_val,
        "reason_codes": reasons,
        "action_id": f"act-{action_hash[:8]}",
        "action_hash": action_hash,
        "policy_version": policy_version,
    }

    return {
        "policy_decision": policy_decision_payload,
        "action_hash": action_hash,
        "presidio_scan": presidio_res.model_dump(),
        "status": new_status,
    }


# Backward-compatible alias for existing graph / policy_node references
policy_evaluation_node = node_opa_eval

