"""Health-Check Endpoint — GET /api/v1/health

Checks the status of all backend dependencies:
- Supabase REST API
- Open Policy Agent HTTP server
- Google Gemini API key presence (does NOT call Gemini to keep health checks fast)

Returns a structured HealthStatus response. Never exposes credentials.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter

from app.config import get_settings
from app.schemas.common import HealthStatus

log = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthStatus,
    summary="System health check",
    description=(
        "Returns the operational status of the CYBER HUNT API and its key dependencies. "
        "Never exposes credentials or internal state."
    ),
)
async def health_check() -> HealthStatus:
    """Probe each dependency and return a consolidated health report."""
    settings = get_settings()
    checks: dict[str, str] = {}

    # --- Supabase ---
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.supabase_url}/rest/v1/")
            # Supabase returns 200 (or 400 for missing apikey header) for a live project.
            checks["supabase"] = "healthy" if resp.status_code < 500 else "degraded"
    except Exception as exc:
        log.warning("Supabase health probe failed: %s", exc)
        checks["supabase"] = "unreachable"

    # --- Open Policy Agent ---
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.opa_url}/health")
            checks["opa"] = "healthy" if resp.status_code == 200 else "degraded"
    except Exception as exc:
        log.warning("OPA health probe failed: %s", exc)
        checks["opa"] = "unreachable"

    # --- Gemini (key presence only — never call the model on health check) ---
    checks["gemini"] = "configured" if settings.has_gemini_key else "unconfigured"

    # --- Overall status ---
    # Gemini unconfigured degrades the API; OPA unreachable degrades; Supabase unreachable is unhealthy.
    if checks["supabase"] == "unreachable":
        overall = "unhealthy"
    elif "unreachable" in checks.values() or "degraded" in checks.values() or checks["gemini"] == "unconfigured":
        overall = "degraded"
    else:
        overall = "healthy"

    log.info("Health check completed", extra={"overall": overall, "checks": checks})

    return HealthStatus(
        status=overall,
        service=settings.app_name,
        version=settings.app_version,
        checks=checks,
    )

