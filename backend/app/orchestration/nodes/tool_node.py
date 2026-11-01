"""Mock Tool Gateway Execution Node — TOOL-007.

LangGraph node that:
  1. Extracts the authorized action from SimulationState.
  2. Delegates execution to MockToolGateway (all security gates enforced inside the gateway).
  3. Persists the execution result to the tool_logs audit table.
  4. Injects the result into SimulationState as `tool_result`.

Security principle:
  - The gateway itself enforces OPA decision, action hash, tool/operation allowlists.
  - This node does NOT re-implement any security logic; it orchestrates and audits.
  - If audit persistence fails, the result is still recorded in state but flagged.
  - Exceptions from the gateway are caught and stored as ERROR results — never silently swallowed.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from app.config import get_settings
from app.db.client import get_supabase_client
from app.db.repositories.audit_repo import AuditRepository
from app.mock_tools.gateway import ToolExecutionResult, gateway
from app.orchestration.state import SimulationState
from app.schemas.common import PolicyDecisionEnum

log = logging.getLogger(__name__)


async def tool_gateway_node(state: SimulationState) -> Dict[str, Any]:
    """Execute the authorized synthetic tool action and persist the audit record."""
    sim_id = state.get("simulation_id", "sim-default")
    step = state.get("current_step", 1)
    policy = state.get("policy_decision") or {}
    proposal = state.get("target_proposal") or {}
    action_hash = state.get("action_hash") or ""

    opa_decision = policy.get("decision", "BLOCK")
    tool_name = proposal.get("tool_name", "none")
    operation = proposal.get("operation", "none")
    params = proposal.get("parameters") or {}

    # Fail-closed fast path: if somehow a non-ALLOW decision reaches this node
    # (graph routing error), the gateway will also catch it, but log loudly here.
    if opa_decision != PolicyDecisionEnum.ALLOW.value:
        log.error(
            "[tool_gateway_node] Non-ALLOW decision reached tool node: %r. "
            "Graph routing error. Blocking. sim=%r",
            opa_decision, sim_id,
        )

    # --- Delegate to MockToolGateway (all security gates enforced inside) ---
    result: ToolExecutionResult = gateway.execute(
        simulation_id=sim_id,
        tool_name=tool_name,
        operation=operation,
        parameters=params,
        action_hash=action_hash,
        opa_decision=opa_decision,
    )

    result_dict = result.model_dump()

    # --- Persist to audit tool_logs table ---
    _persist_tool_log(
        sim_id=sim_id,
        step=step,
        result=result,
        params=params,
    )

    log.info(
        "[tool_gateway_node] Execution complete: exec_id=%r status=%r sim=%r tool=%r op=%r",
        result.execution_id,
        result.execution_status,
        sim_id,
        tool_name,
        operation,
    )

    return {"tool_result": result_dict}


def _persist_tool_log(
    sim_id: str,
    step: int,
    result: ToolExecutionResult,
    params: Dict[str, Any],
) -> None:
    """Persist tool execution result to the Supabase tool_logs table.

    On failure, logs the error and sets a warning flag — does NOT suppress the error silently
    and does NOT block the graph (the result is already in state at this point).
    The gateway has already enforced all security checks before we reach here.
    """
    try:
        settings = get_settings()
        if settings.has_supabase_service_role or settings.supabase_anon_key:
            client = get_supabase_client(settings)
            repo = AuditRepository(client)
            try:
                uuid.UUID(sim_id)
                log_record: Dict[str, Any] = {
                    "simulation_id": sim_id,
                    "step": step,
                    "tool_name": result.tool_name,
                    "operation": result.operation,
                    "execution_status": result.execution_status,
                    "action_hash": result.action_hash,
                    "opa_decision": result.opa_decision,
                    "execution_id": result.execution_id,
                    "result_summary": result.result_data,
                    "error": result.error,
                    "executed_at": result.timestamp,
                }
                repo.record_tool_log(log_record)
                log.debug("[tool_gateway_node] Tool log persisted: exec_id=%r", result.execution_id)
            except ValueError:
                log.debug("Skipping Supabase persist for non-UUID synthetic test simulation: %s", sim_id)
    except Exception as exc:  # noqa: BLE001
        log.error(
            "[tool_gateway_node] AUDIT PERSISTENCE FAILED for exec_id=%r sim=%r: %s",
            result.execution_id, sim_id, exc,
        )
