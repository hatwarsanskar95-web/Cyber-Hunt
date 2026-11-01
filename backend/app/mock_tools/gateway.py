"""Mock Tool Gateway — TOOL-001.

The ONLY authorised entry point to all simulated tool execution.

Security enforcement order (fail-closed at every step):
    1. Require explicit OPA ALLOW decision (no other decision reaches here).
    2. Verify cryptographic action hash — reject tampered parameters.
    3. Verify tool is allowlisted.
    4. Verify operation is allowlisted for that tool.
    5. Dispatch to appropriate sandboxed mock tool.
    6. Return structured ToolExecutionResult.

ZERO real egress:  no network, no filesystem, no real email/payments.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.security.validator import verify_action_hash

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowlisted tools and operations (mirrors base.rego + OPA client)
# ---------------------------------------------------------------------------

ALLOWLISTED_OPERATIONS: Dict[str, frozenset] = {
    "email": frozenset(
        {"compose", "read", "send_email", "search_inbox", "read_email",
         "list_emails", "read_inbox", "search"}
    ),
    "file": frozenset({"read", "list", "read_file", "list_files", "read_config", "write_file"}),
    "browser": frozenset({"navigate", "search", "read_page", "browse_url", "fetch_page"}),
    "payment": frozenset(
        {"transfer", "pay", "send_payment", "invoice", "transfer_funds",
         "send_funds", "get_balance", "execute_transfer"}
    ),
    "none": frozenset({"none", "respond_only"}),
}

# ---------------------------------------------------------------------------
# Result schema
# ---------------------------------------------------------------------------


class ToolExecutionResult(BaseModel):
    """Structured result returned by the Mock Tool Gateway."""

    execution_id: str = Field(description="Unique synthetic execution identifier")
    simulation_id: str
    tool_name: str
    operation: str
    execution_status: str = Field(description="SUCCESS | BLOCKED | HASH_MISMATCH | INVALID_TOOL | ERROR")
    result_data: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    action_hash: str
    opa_decision: str
    timestamp: str = Field(description="ISO 8601 UTC timestamp")

    model_config = {"extra": "forbid"}


# ---------------------------------------------------------------------------
# Gateway
# ---------------------------------------------------------------------------


class MockToolGateway:
    """Enforces security policy before dispatching to sandboxed mock tools."""

    def execute(
        self,
        *,
        simulation_id: str,
        tool_name: str,
        operation: str,
        parameters: Dict[str, Any],
        action_hash: str,
        opa_decision: str,
    ) -> ToolExecutionResult:
        """Run the full security gauntlet then dispatch to the correct mock tool.

        Returns a ToolExecutionResult.  Never raises — always returns a structured result.
        """
        exec_id = f"EXEC-{uuid.uuid4().hex[:10].upper()}"
        ts = datetime.now(timezone.utc).isoformat()

        base_kwargs: Dict[str, Any] = dict(
            execution_id=exec_id,
            simulation_id=simulation_id,
            tool_name=tool_name,
            operation=operation,
            action_hash=action_hash,
            opa_decision=opa_decision,
            timestamp=ts,
        )

        # ── Gate 1: OPA decision must be ALLOW ────────────────────────────
        if opa_decision != "ALLOW":
            log.error(
                "[GATEWAY] BLOCKED — OPA decision is %r, not ALLOW. sim=%r tool=%r",
                opa_decision, simulation_id, tool_name,
            )
            return ToolExecutionResult(
                **base_kwargs,
                execution_status="BLOCKED",
                error=f"Execution blocked: OPA decision is {opa_decision!r}, not ALLOW.",
            )

        # ── Gate 2: Action hash verification ──────────────────────────────
        if not verify_action_hash(
            expected_hash=action_hash,
            simulation_id=simulation_id,
            tool=tool_name,
            operation=operation,
            parameters=parameters,
        ):
            log.error(
                "[GATEWAY] HASH_MISMATCH — action hash invalid. sim=%r tool=%r op=%r",
                simulation_id, tool_name, operation,
            )
            return ToolExecutionResult(
                **base_kwargs,
                execution_status="HASH_MISMATCH",
                error="Action hash verification failed: parameters may have been tampered with.",
            )

        # ── Gate 3: Tool allowlist ─────────────────────────────────────────
        if tool_name not in ALLOWLISTED_OPERATIONS:
            log.error("[GATEWAY] INVALID_TOOL — %r not allowlisted", tool_name)
            return ToolExecutionResult(
                **base_kwargs,
                execution_status="INVALID_TOOL",
                error=f"Tool {tool_name!r} is not in the allowlist.",
            )

        # ── Gate 4: Operation allowlist ────────────────────────────────────
        if operation not in ALLOWLISTED_OPERATIONS[tool_name]:
            log.error(
                "[GATEWAY] INVALID_TOOL — operation %r not allowlisted for tool %r",
                operation, tool_name,
            )
            return ToolExecutionResult(
                **base_kwargs,
                execution_status="INVALID_TOOL",
                error=f"Operation {operation!r} is not allowlisted for tool {tool_name!r}.",
            )

        # ── Gate 5: "none" tool — no dispatch needed ───────────────────────
        if tool_name == "none":
            return ToolExecutionResult(
                **base_kwargs,
                execution_status="SUCCESS",
                result_data={"note": "No tool action was required for this response."},
            )

        # ── Gate 6: Dispatch to sandboxed mock tool ────────────────────────
        try:
            result_data = self._dispatch(tool_name, operation, parameters)
        except Exception as exc:  # noqa: BLE001
            log.exception("[GATEWAY] Unexpected error during dispatch: %s", exc)
            return ToolExecutionResult(
                **base_kwargs,
                execution_status="ERROR",
                error=f"Unexpected gateway error: {exc}",
            )

        log.info(
            "[GATEWAY] SUCCESS exec_id=%r sim=%r tool=%r op=%r",
            exec_id, simulation_id, tool_name, operation,
        )
        return ToolExecutionResult(
            **base_kwargs,
            execution_status="SUCCESS",
            result_data=result_data,
        )

    # ── Internal dispatcher ───────────────────────────────────────────────

    @staticmethod
    def _dispatch(tool_name: str, operation: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Route to the appropriate mock tool module."""
        if tool_name == "email":
            from app.mock_tools.email_tool import execute as email_execute
            return email_execute(operation, parameters)

        if tool_name == "payment":
            from app.mock_tools.payment_tool import execute as payment_execute
            return payment_execute(operation, parameters)

        if tool_name == "browser":
            from app.mock_tools.browser_tool import execute as browser_execute
            return browser_execute(operation, parameters)

        if tool_name == "file":
            from app.mock_tools.file_tool import execute as file_execute
            return file_execute(operation, parameters)

        return {"note": f"No handler registered for tool {tool_name!r}", "status": "NOOP"}


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

gateway = MockToolGateway()

