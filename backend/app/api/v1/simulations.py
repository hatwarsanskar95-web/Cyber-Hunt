"""Simulation REST API Endpoints — SIM-002.

Provides lifecycle management routes:
- POST /api/v1/simulations: Create new simulation run
- GET  /api/v1/simulations: List owned simulations
- GET  /api/v1/simulations/{id}: Get detailed simulation state
- POST /api/v1/simulations/{id}/start: Begin async background execution
- POST /api/v1/simulations/{id}/pause: Pause execution
- POST /api/v1/simulations/{id}/resume: Resume paused execution
- POST /api/v1/simulations/{id}/stop: Cancel/terminate execution
- POST /api/v1/simulations/analyze-email: Manual email triage through full security pipeline
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.core.errors import AuthorizationError, NotFoundError
from app.dependencies import CurrentUser, CurrentUserDep
from app.orchestration.manager import SimulationManager, get_simulation_manager
from app.schemas.common import PaginatedResponse, PaginationParams, SuccessResponse
from app.schemas.simulation import (
    SimulationActionResponse,
    SimulationCreateRequest,
    SimulationDetail,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/simulations", tags=["Simulations"])


def get_manager() -> SimulationManager:
    """Dependency provider for the simulation lifecycle manager."""
    return get_simulation_manager()


# ---------------------------------------------------------------------------
# Create & Read
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=SuccessResponse,
    summary="List active and owned simulations",
)
async def list_simulations(
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
    limit: int = Query(default=10, ge=1, le=50, description="Max simulations to return"),
) -> SuccessResponse:
    """List recent simulations belonging to current user or active in system."""
    owner_id = None if current_user.role in ("admin", "judge") else current_user.id
    sims = manager.list_simulations(owner_id=owner_id, limit=limit)
    return SuccessResponse(status="success", data=sims)


@router.post(
    "",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new simulation run",
)
async def create_simulation(
    payload: SimulationCreateRequest,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Create a new simulation in CREATED state."""
    sim = manager.create_simulation(
        owner_id=current_user.id,
        scenario_category=payload.scenario_category,
        task_summary=payload.task_summary,
        step_limit=payload.step_limit,
        initial_input=payload.initial_input,
    )
    return SuccessResponse(
        status="success",
        data=sim,
        message="Simulation initialized successfully.",
    )


@router.get(
    "/{id}",
    response_model=SuccessResponse,
    summary="Get detailed state of a specific simulation",
)
async def get_simulation(
    id: str,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Fetch full simulation record and runtime state."""
    owner_check = None if current_user.role in ("admin", "judge") else current_user.id
    sim = manager.get_simulation(id)
    if owner_check and sim.get("owner_id") != owner_check:
        raise AuthorizationError("Access denied to simulation.")
    return SuccessResponse(status="success", data=sim)


# ---------------------------------------------------------------------------
# Lifecycle State Controls
# ---------------------------------------------------------------------------


@router.post(
    "/{id}/start",
    response_model=SuccessResponse,
    summary="Start/launch execution of a simulation",
)
async def start_simulation(
    id: str,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Launch asynchronous background execution of the LangGraph workflow."""
    owner_check = None if current_user.role in ("admin", "judge") else current_user.id
    updated = await manager.start_simulation(id, owner_id=owner_check)
    res = SimulationActionResponse(
        simulation_id=id,
        state=updated.get("state", "RUNNING"),
        message="Simulation execution started in background.",
    )
    return SuccessResponse(status="success", data=res.model_dump(), message=res.message)


@router.post(
    "/{id}/pause",
    response_model=SuccessResponse,
    summary="Pause a running simulation",
)
async def pause_simulation(
    id: str,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Pause execution of an actively running simulation."""
    owner_check = None if current_user.role == "admin" else current_user.id
    updated = await manager.pause_simulation(id, owner_id=owner_check)
    res = SimulationActionResponse(
        simulation_id=id,
        state=updated.get("state", "PAUSED"),
        message="Simulation execution paused.",
    )
    return SuccessResponse(status="success", data=res.model_dump(), message=res.message)


@router.post(
    "/{id}/resume",
    response_model=SuccessResponse,
    summary="Resume a paused simulation",
)
async def resume_simulation(
    id: str,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Resume execution of a previously paused simulation."""
    owner_check = None if current_user.role == "admin" else current_user.id
    updated = await manager.resume_simulation(id, owner_id=owner_check)
    res = SimulationActionResponse(
        simulation_id=id,
        state=updated.get("state", "RUNNING"),
        message="Simulation execution resumed in background.",
    )
    return SuccessResponse(status="success", data=res.model_dump(), message=res.message)


@router.post(
    "/{id}/stop",
    response_model=SuccessResponse,
    summary="Cancel/terminate a simulation run",
)
async def stop_simulation(
    id: str,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Cancel and terminate execution of a simulation."""
    owner_check = None if current_user.role == "admin" else current_user.id
    updated = await manager.stop_simulation(id, owner_id=owner_check)
    res = SimulationActionResponse(
        simulation_id=id,
        state=updated.get("state", "CANCELLED"),
        message="Simulation execution stopped/cancelled.",
    )
    return SuccessResponse(status="success", data=res.model_dump(), message=res.message)


# ---------------------------------------------------------------------------
# Manual Analysis Endpoint
# ---------------------------------------------------------------------------


class EmailAnalysisRequest(BaseModel):
    email: Dict[str, Any] = Field(..., description="Full email payload to analyze")
    simulation_id: Optional[str] = Field(default=None, description="Optional target simulation session ID")


EmailAnalysisRequest.model_rebuild()


@router.post(
    "/analyze-email",
    response_model=SuccessResponse,
    summary="Analyze an email through the full Red Team -> Target AI -> Blue Team -> OPA pipeline",
)
async def analyze_email_endpoint(
    payload: EmailAnalysisRequest,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Manually analyze an email through the autonomous security workflow."""
    sim_id = payload.simulation_id
    if not sim_id:
        sims = manager.list_simulations(limit=10)
        active_sim = next(
            (s for s in sims if s.get("state") in ("RUNNING", "ANALYSING", "CREATED", "AWAITING_APPROVAL")),
            None,
        )
        if not active_sim:
            active_sim = manager.create_simulation(
                owner_id=current_user.id,
                scenario_category="phishing",
                task_summary=f"Manual analysis of email: {payload.email.get('subject', 'Untitled')}",
            )
        sim_id = active_sim.get("id")

    # Broadcast EMAIL_RECEIVED so frontend updates timeline Stage 1 immediately
    await manager.emit_event(
        simulation_id=sim_id,
        event_type="email.received",
        payload={
            "id": payload.email.get("id"),
            "from": payload.email.get("from"),
            "to": payload.email.get("to"),
            "subject": payload.email.get("subject"),
            "snippet": payload.email.get("snippet") or payload.email.get("body", "")[:120],
            "body": payload.email.get("body", ""),
            "received_at": payload.email.get("received_at"),
            "is_untrusted": payload.email.get("is_untrusted", False),
        },
    )

    result = await manager.analyze_email_workflow(sim_id, payload.email)
    return SuccessResponse(status="success", data={"simulation_id": sim_id, "result": result})
