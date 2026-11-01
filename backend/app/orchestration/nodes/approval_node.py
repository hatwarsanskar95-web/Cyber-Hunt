"""Human-in-the-Loop Approval Node for LangGraph.

Uses LangGraph `interrupt()` primitive to pause execution when
policy returns REQUIRE_APPROVAL, and resumes with human decision payload.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from langgraph.types import interrupt

from app.orchestration.state import SimulationState
from app.schemas.common import PolicyDecisionEnum

log = logging.getLogger(__name__)


def human_approval_node(state: SimulationState) -> Dict[str, Any]:
    """Pause graph execution for human authorization and process approval payload."""
    sim_id = state.get("simulation_id", "sim-default")
    policy = state.get("policy_decision") or {}
    action_hash = state.get("action_hash", "")
    action_id = policy.get("action_id", "")

    log.info(
        "Pausing simulation for human approval",
        extra={"simulation_id": sim_id, "action_id": action_id, "action_hash": action_hash[:12]},
    )

    # Trigger LangGraph interrupt primitive — execution pauses here
    approval_payload: Dict[str, Any] = interrupt(
        {
            "simulation_id": sim_id,
            "action_id": action_id,
            "action_hash": action_hash,
            "reasons": policy.get("reason_codes", []),
            "prompt": "Human operator authorization required before executing sensitive tool.",
        }
    )

    # When resumed, approval_payload contains human decision
    decision_val = (
        approval_payload.get("decision", "REJECTED").upper()
        if isinstance(approval_payload, dict)
        else "REJECTED"
    )

    log.info(
        "Human approval resumed",
        extra={"simulation_id": sim_id, "decision": decision_val},
    )

    updated_policy = dict(policy)
    if decision_val == "APPROVED":
        updated_policy["decision"] = PolicyDecisionEnum.ALLOW.value
        updated_status = "RUNNING"
    else:
        updated_policy["decision"] = PolicyDecisionEnum.BLOCK.value
        updated_status = "RUNNING"

    return {
        "approval_status": decision_val,
        "approval_payload": approval_payload if isinstance(approval_payload, dict) else {},
        "policy_decision": updated_policy,
        "status": updated_status,
    }

