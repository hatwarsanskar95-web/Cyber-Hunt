"""Human-in-the-Loop Approval Decision REST API — SIM-005.

Provides endpoints for authorized operators/admins to review sensitive actions
and submit approval or rejection decisions:
- POST /api/v1/approvals/{id}/decision: Submit decision (APPROVED | REJECTED)
- GET  /api/v1/approvals/{id}: Get approval details
- GET  /api/v1/approvals: List active pending approvals
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, status

from app.config import Settings, get_settings
from app.dependencies import CurrentUser, CurrentUserDep, DEMO_OPERATOR_UUID, require_role
from app.orchestration.manager import SimulationManager, get_simulation_manager
from app.schemas.common import SuccessResponse
from app.schemas.simulation import ApprovalDecisionRequest, ApprovalDetail

log = logging.getLogger(__name__)

router = APIRouter(prefix="/approvals", tags=["Approvals"])


def get_manager() -> SimulationManager:
    """Dependency provider for the simulation lifecycle manager."""
    return get_simulation_manager()


def require_approver_role(
    current_user: CurrentUserDep,
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    """Authorize approver or admin role, allowing local demo operator on loopback in non-prod."""
    if settings.local_demo_mode and not settings.is_production and current_user.id == DEMO_OPERATOR_UUID:
        return CurrentUser(
            id=current_user.id,
            email=current_user.email,
            role="approver",
            display_name="Local Demo Approver",
        )
    if current_user.role not in ("approver", "admin"):
        from app.core.errors import AuthorizationError
        raise AuthorizationError(f"Role '{current_user.role}' not permitted. Requires ('approver', 'admin').")
    return current_user


# ---------------------------------------------------------------------------
# Query Approvals
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=SuccessResponse,
    summary="List pending approval requests",
)
async def list_pending_approvals(
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """List all active approval requests requiring human decision."""
    pending = []
    if manager.approval_repo:
        try:
            pending = manager.approval_repo.list_pending(limit=50)
        except Exception as exc:
            log.warning("DB list_pending failed, falling back to memory: %s", exc)

    if not pending:
        # Fallback to in-memory pending list
        pending = [
            req for req in manager._mem_approvals.values()
            if req.get("decision") == "PENDING"
        ]

    items = [ApprovalDetail(**r).model_dump() for r in pending]
    return SuccessResponse(status="success", data=items, message=f"{len(items)} pending approvals found.")


@router.get(
    "/{id}",
    response_model=SuccessResponse,
    summary="Get approval request details",
)
async def get_approval(
    id: str,
    current_user: CurrentUserDep,
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Get details for a specific approval request."""
    app_req = manager._get_approval_request(id)
    if not app_req:
        from app.core.errors import NotFoundError
        raise NotFoundError(f"Approval request '{id}' not found.")

    detail = ApprovalDetail(**app_req)
    return SuccessResponse(status="success", data=detail.model_dump())


# ---------------------------------------------------------------------------
# Decision Submission (SIM-005)
# ---------------------------------------------------------------------------


@router.post(
    "/{id}/decision",
    response_model=SuccessResponse,
    summary="Submit approval or rejection decision",
)
async def submit_approval_decision(
    id: str,
    payload: ApprovalDecisionRequest,
    current_user: CurrentUser = Depends(require_approver_role),
    manager: SimulationManager = Depends(get_manager),
) -> SuccessResponse:
    """Submit an authorized decision (APPROVED or REJECTED) for a pending action.

    Security guarantees:
    - Only users with 'approver' or 'admin' roles can execute this endpoint.
    - Requires exact original SHA-256 action hash to prevent replay and parameter tampering.
    - Resolves the approval request and automatically resumes the LangGraph simulation.
    - Approved actions undergo security revalidation before Mock Tool Gateway execution.
    - Rejected actions route directly to BLOCK without reaching the Mock Tool Gateway.
    """
    resolved = await manager.submit_approval_decision(
        approval_id=id,
        decision=payload.decision,
        action_hash=payload.action_hash,
        approver_id=current_user.id,
        reason=payload.reason,
    )

    detail = ApprovalDetail(**resolved)
    return SuccessResponse(
        status="success",
        data=detail.model_dump(),
        message=f"Action successfully {payload.decision.lower()} and simulation resumed.",
    )

