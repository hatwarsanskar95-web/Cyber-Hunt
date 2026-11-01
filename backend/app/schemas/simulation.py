"""Pydantic schemas for Simulation lifecycle management and Human-in-the-Loop approvals."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SimulationCreateRequest(BaseModel):
    """Request payload to create and configure a new simulation run."""

    scenario_category: str = Field(
        ...,
        description="Attack scenario type (e.g. direct_prompt_injection, data_exfiltration)",
        examples=["direct_prompt_injection", "financial_fraud"],
    )
    task_summary: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="High-level description of legitimate user task",
        examples=["Summarize Q3 financial report"],
    )
    step_limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum turns/steps before bounding termination (default: 5, max: 20)",
    )
    initial_input: Optional[str] = Field(
        default=None,
        description="Optional initial untrusted input/payload",
    )

    model_config = {"extra": "forbid"}


class SimulationDetail(BaseModel):
    """Structured simulation details returned by API endpoints."""

    id: str
    owner_id: str
    scenario_category: str
    task_summary: str
    state: str
    step_limit: int
    current_step: int
    final_metrics: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"extra": "ignore"}


class SimulationActionResponse(BaseModel):
    """Response returned upon lifecycle action (start, pause, resume, stop)."""

    simulation_id: str
    state: str
    message: str

    model_config = {"extra": "ignore"}


class ApprovalDecisionRequest(BaseModel):
    """Payload submitted by authorized human approver to resolve a pending action."""

    decision: str = Field(
        ...,
        pattern="^(APPROVED|REJECTED)$",
        description="Human operator decision: APPROVED or REJECTED",
    )
    action_hash: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="Exact SHA-256 action hash to verify parameter integrity",
    )
    reason: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional operational justification for approval or rejection",
    )

    model_config = {"extra": "forbid"}


class ApprovalDetail(BaseModel):
    """Structured approval request record."""

    id: str
    simulation_id: str
    action_id: str
    action_hash: str
    approver_id: Optional[str] = None
    decision: str
    reason: Optional[str] = None
    expiry_time: str
    resolved_at: Optional[str] = None
    created_at: Optional[str] = None
    email_id: Optional[str] = None
    email_from: Optional[str] = None
    email_subject: Optional[str] = None
    threat_score: Optional[int] = None
    target_findings: Optional[str] = None
    blue_findings: Optional[str] = None
    recommended_action: Optional[str] = None

    model_config = {"extra": "ignore"}

