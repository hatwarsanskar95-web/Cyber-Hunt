"""Standardized Simulation Event Schemas for Real-Time WebSocket Streaming — WS-001.

Implements all 14 PRD event types + future Gmail integration event:
1.  simulation.created
2.  simulation.status_changed
3.  red_team.attack_generated
4.  target_ai.response_ready
5.  target_ai.action_proposed
6.  guardian.analysis_completed
7.  policy.decision_made
8.  approval.requested
9.  approval.resolved
10. tool.executed
11. tool.blocked
12. score.updated
13. simulation.completed
14. simulation.failed
15. email.received  (Future real-time Gmail hook)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Exhaustive catalog of real-time event types in CYBER HUNT."""

    # Simulation lifecycle
    SIMULATION_CREATED = "simulation.created"
    SIMULATION_STATUS_CHANGED = "simulation.status_changed"
    SIMULATION_COMPLETED = "simulation.completed"
    SIMULATION_FAILED = "simulation.failed"

    # Agent activities
    RED_TEAM_ATTACK_GENERATED = "red_team.attack_generated"
    TARGET_AI_RESPONSE_READY = "target_ai.response_ready"
    TARGET_AI_ACTION_PROPOSED = "target_ai.action_proposed"
    GUARDIAN_ANALYSIS_COMPLETED = "guardian.analysis_completed"

    # Security & Enforcement
    POLICY_DECISION_MADE = "policy.decision_made"
    APPROVAL_REQUESTED = "approval.requested"
    APPROVAL_RESOLVED = "approval.resolved"

    # Tool Execution
    TOOL_EXECUTED = "tool.executed"
    TOOL_BLOCKED = "tool.blocked"

    # Scoring
    SCORE_UPDATED = "score.updated"

    # Future Gmail integration hook
    EMAIL_RECEIVED = "email.received"

    # Protocol keep-alive
    PING = "ping"
    PONG = "pong"


class SimulationEvent(BaseModel):
    """Standardized event envelope matching PRD Section 11 & WS-001.

    Every event broadcast via WebSocket or returned via replay endpoint
    conforms strictly to this contract.
    """

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for this event instance",
    )
    simulation_id: str = Field(
        ...,
        description="UUID of the simulation this event belongs to",
    )
    sequence_number: int = Field(
        ...,
        ge=1,
        description="Monotonically increasing sequence number per simulation",
    )
    event_type: str = Field(
        ...,
        description="Standard dot-delimited event name (e.g. policy.decision_made)",
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of event generation",
    )
    schema_version: str = Field(
        default="1.0",
        description="Schema contract version",
    )
    payload: Dict[str, Any] = Field(
        default_factory=dict,
        description="Domain payload data specific to the event type",
    )

    model_config = {"extra": "ignore"}


class EventReplayResponse(BaseModel):
    """Response returned by GET /api/v1/simulations/{id}/events for reconnect synchronization."""

    simulation_id: str
    total_events: int
    from_sequence: int
    latest_sequence: int
    events: list[SimulationEvent] = Field(default_factory=list)

