"""Typed Simulation State for LangGraph Multi-Agent Orchestration.

Defines the complete state structure passed between agent nodes,
ensuring strict type safety, predictable serialization, and full checkpointing.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict

from app.schemas.common import PolicyDecisionEnum, SimulationState as SimStatusEnum


class SimulationState(TypedDict, total=False):
    """LangGraph State dictionary tracking multi-agent simulation workflow."""

    # Identity & metadata
    simulation_id: str
    owner_id: str
    scenario_category: str
    task_summary: str

    # Execution limits & progress
    current_step: int
    step_limit: int
    status: str  # CREATED, RUNNING, ANALYSING, AWAITING_APPROVAL, PAUSED, COMPLETED, FAILED, CANCELLED

    # Step-level agent payloads
    untrusted_input: str
    attack_payload: Optional[Dict[str, Any]]
    target_proposal: Optional[Dict[str, Any]]
    guardian_assessment: Optional[Dict[str, Any]]
    policy_decision: Optional[Dict[str, Any]]
    tool_result: Optional[Dict[str, Any]]

    # Human-in-the-loop approval tracking
    action_hash: Optional[str]
    approval_status: Optional[str]  # PENDING, APPROVED, REJECTED
    approval_payload: Optional[Dict[str, Any]]

    # Cumulative audit & scoring
    round_result: Optional[Dict[str, Any]]
    history: List[Dict[str, Any]]
    errors: List[str]


def create_initial_state(
    simulation_id: str,
    owner_id: str,
    scenario_category: str,
    task_summary: str,
    step_limit: int = 5,
    untrusted_input: str = "",
) -> SimulationState:
    """Helper to initialize a clean SimulationState dictionary."""
    return SimulationState(
        simulation_id=simulation_id,
        owner_id=owner_id,
        scenario_category=scenario_category,
        task_summary=task_summary,
        current_step=1,
        step_limit=step_limit,
        status=SimStatusEnum.RUNNING.value,
        untrusted_input=untrusted_input,
        attack_payload=None,
        target_proposal=None,
        guardian_assessment=None,
        policy_decision=None,
        tool_result=None,
        action_hash=None,
        approval_status=None,
        approval_payload=None,
        round_result=None,
        history=[],
        errors=[],
    )

