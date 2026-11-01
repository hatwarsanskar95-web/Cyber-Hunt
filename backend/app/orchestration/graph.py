"""LangGraph Multi-Agent StateGraph Definition and Conditional Routing.

Constructs the full multi-agent simulation graph:
Red Team -> Target AI -> Blue Team Guardian -> Policy Evaluation ->
    [ALLOW]              -> Tool Gateway -> Score Update
    [BLOCK]              -> Score Update
    [REQUIRE_APPROVAL]   -> Human Approval -> [Approved: Tool Gateway / Rejected: Score Update]
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.base import BaseCheckpointSaver

from app.orchestration.checkpointer import get_checkpointer
from app.orchestration.nodes.approval_node import human_approval_node
from app.orchestration.nodes.guardian_node import guardian_node
from app.orchestration.nodes.opa_node import node_opa_eval as policy_evaluation_node
from app.orchestration.nodes.red_team_node import red_team_node
from app.orchestration.nodes.score_node import score_update_node
from app.orchestration.nodes.target_ai_node import target_ai_node
from app.orchestration.nodes.tool_node import tool_gateway_node
from app.orchestration.state import SimulationState
from app.schemas.common import PolicyDecisionEnum, SimulationState as SimStatusEnum

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Conditional Routing Functions
# ---------------------------------------------------------------------------


def route_policy_decision(state: SimulationState) -> str:
    """Route based on deterministic OPA policy decision."""
    policy = state.get("policy_decision") or {}
    decision = policy.get("decision", PolicyDecisionEnum.BLOCK.value)

    if decision == PolicyDecisionEnum.ALLOW.value:
        return "tool_gateway"
    elif decision == PolicyDecisionEnum.REQUIRE_APPROVAL.value:
        return "human_approval"
    else:
        # BLOCK or unknown fails closed to score_update (bypasses tool execution)
        return "score_update"


def route_approval_decision(state: SimulationState) -> str:
    """Route after human approval decision has been delivered."""
    approval_status = state.get("approval_status", "REJECTED")

    if approval_status == "APPROVED":
        return "tool_gateway"
    else:
        # Rejected actions are never executed by Tool Gateway
        return "score_update"


def route_next_step(state: SimulationState) -> str:
    """Determine whether to proceed to next simulation step or finish."""
    status = state.get("status")
    current_step = state.get("current_step", 1)
    step_limit = state.get("step_limit", 5)

    if status == SimStatusEnum.COMPLETED.value or current_step > step_limit:
        return "END"
    return "red_team"


# ---------------------------------------------------------------------------
# Graph Construction & Compilation Factory
# ---------------------------------------------------------------------------


def build_simulation_graph(
    checkpointer: Optional[BaseCheckpointSaver] = None,
) -> CompiledStateGraph:
    """Construct and compile the CYBER HUNT multi-agent LangGraph workflow.

    Args:
        checkpointer: Optional checkpoint saver (defaults to MemorySaver).

    Returns:
        A compiled LangGraph runnable with interrupt and state recovery support.
    """
    saver = checkpointer or get_checkpointer()

    workflow = StateGraph(SimulationState)

    # 1. Register Nodes
    workflow.add_node("red_team", red_team_node)
    workflow.add_node("target_ai", target_ai_node)
    workflow.add_node("guardian", guardian_node)
    workflow.add_node("policy_evaluation", policy_evaluation_node)
    workflow.add_node("human_approval", human_approval_node)
    workflow.add_node("tool_gateway", tool_gateway_node)
    workflow.add_node("score_update", score_update_node)

    # 2. Register Standard Edges
    workflow.add_edge(START, "red_team")
    workflow.add_edge("red_team", "target_ai")
    workflow.add_edge("target_ai", "guardian")
    workflow.add_edge("guardian", "policy_evaluation")

    # 3. Conditional Policy Routing (ORCH-004)
    workflow.add_conditional_edges(
        "policy_evaluation",
        route_policy_decision,
        {
            "tool_gateway": "tool_gateway",
            "human_approval": "human_approval",
            "score_update": "score_update",
        },
    )

    # 4. Conditional Approval Routing (ORCH-006)
    workflow.add_conditional_edges(
        "human_approval",
        route_approval_decision,
        {
            "tool_gateway": "tool_gateway",
            "score_update": "score_update",
        },
    )

    # 5. Tool gateway flows directly to score update
    workflow.add_edge("tool_gateway", "score_update")

    # 6. Step Progression Loop or Termination
    workflow.add_conditional_edges(
        "score_update",
        route_next_step,
        {
            "red_team": "red_team",
            "END": END,
        },
    )

    # Compile with checkpointer for pause/resume interrupts
    return workflow.compile(checkpointer=saver)

