"""Pydantic schemas for OPA Policy Evaluation context and decisions."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.common import PolicyDecisionEnum


class PolicyEvaluationContext(BaseModel):
    """Structured context sent to OPA REST API."""

    simulation_id: str = Field(description="Unique simulation identifier")
    step: int = Field(default=1, ge=1, description="Current simulation step")
    scenario_category: str = Field(default="prompt_injection", description="Active adversarial scenario")
    tool: str = Field(description="Target tool to invoke")
    operation: str = Field(description="Target tool operation")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameters to pass to the tool")
    action_hash: str = Field(description="Deterministic SHA-256 action hash")
    guardian_risk_score: float = Field(default=0.0, ge=0.0, le=1.0)
    guardian_recommended_action: Optional[str] = Field(default=None)
    presidio_pii_detected: bool = Field(default=False)
    presidio_findings: List[Dict[str, Any]] = Field(default_factory=list)
    destination_verified: bool = Field(default=True)
    payment_amount: Optional[float] = Field(default=None)
    vendor_id: Optional[str] = Field(default=None)


class PolicyEvaluationResponse(BaseModel):
    """Structured response from OPA decision evaluation."""

    decision: PolicyDecisionEnum = Field(description="Authorization decision: ALLOW, BLOCK, REQUIRE_APPROVAL")
    reason_codes: List[str] = Field(default_factory=list, description="Matched policy rule identifiers")
    action_id: str = Field(description="Action identifier bound to hash")
    action_hash: str = Field(description="SHA-256 action hash")
    policy_version: str = Field(default="1.0.0", description="Policy engine version")

