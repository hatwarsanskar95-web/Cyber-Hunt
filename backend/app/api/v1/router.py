"""API v1 Router — aggregates all versioned route modules.

Mount additional routers here as new features are implemented.
"""

from fastapi import APIRouter

from app.api.v1.approvals import router as approvals_router
from app.api.v1.browser import router as browser_router
from app.api.v1.files import router as files_router
from app.api.v1.gmail import router as gmail_router
from app.api.v1.health import router as health_router
from app.api.v1.payments import router as payments_router
from app.api.v1.reports import router as reports_router
from app.api.v1.simulations import router as simulations_router
from app.api.v1.ws import router as ws_router

router = APIRouter(prefix="/api/v1")

# Phase 1 — foundation
router.include_router(health_router)

# Google OAuth 2.0 (Gmail Read-Only Integration)
router.include_router(gmail_router)

# Level 2 — File Security & Quarantine
router.include_router(files_router)

# Level 3 — Browser Security & Web Download Quarantine
router.include_router(browser_router)

# Level 4 — Payment & Invoice Fraud Security
router.include_router(payments_router)

# Phase 5 — PDF Security Reports & Analysis History
router.include_router(reports_router)

# Phase 10 — Simulation Engine & Human-in-the-Loop Approvals
router.include_router(simulations_router)
router.include_router(approvals_router)

# Phase 11 — Real-Time Communication (WebSocket & Replay)
router.include_router(ws_router)

