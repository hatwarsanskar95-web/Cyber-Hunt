"""CYBER HUNT FastAPI Application Factory.

Call ``create_application()`` to get a fully-configured FastAPI instance.
The module-level ``app`` is used by Uvicorn as the ASGI entry point.

Startup / shutdown lifecycle is managed via the ``lifespan`` context manager.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging
from app.orchestration.checkpointer import close_postgres_checkpointer, init_postgres_checkpointer


async def _email_polling_worker() -> None:
    """Background worker that automatically detects new inbound emails when Gmail is connected."""
    from app.security.gmail_service import get_gmail_service
    from app.orchestration.manager import get_simulation_manager

    poller_log = logging.getLogger("app.gmail.poller")
    # Grace period on startup
    await asyncio.sleep(3)

    try:
        init_service = get_gmail_service()
        if init_service.get_connection_status().connected:
            await init_service.seed_processed_message_ids(max_results=25)
    except Exception as exc:
        poller_log.debug("Initial seed message error: %s", exc)

    while True:
        poll_delay = 15
        try:
            service = get_gmail_service()
            status = service.get_connection_status()
            if status.connected:
                new_emails = await service.fetch_recent_emails(
                    max_results=5,
                    skip_duplicates=True,
                )
                if new_emails:
                    manager = get_simulation_manager()
                    active_sim_id: str | None = None
                    try:
                        sims = manager.list_simulations(limit=10)
                        active_sim = next(
                            (s for s in sims if s.get("state") in ("RUNNING", "ANALYSING", "CREATED", "AWAITING_APPROVAL")),
                            None,
                        )
                        if active_sim:
                            active_sim_id = active_sim.get("id")
                    except Exception:
                        pass

                    for em in new_emails:
                        if not active_sim_id:
                            sim = manager.create_simulation(
                                owner_id="00000000-0000-0000-0000-000000000001",
                                scenario_category="phishing",
                                task_summary=f"Inbound Email: {em.subject[:40]}",
                            )
                            active_sim_id = sim.get("id")

                        email_dict = {
                            "id": em.id,
                            "from": em.from_address,
                            "to": em.to_address,
                            "subject": em.subject,
                            "body": em.body_text,
                            "snippet": em.snippet,
                            "attachments": [att.model_dump() for att in em.attachments],
                            "received_at": em.received_at,
                            "is_untrusted": em.is_untrusted,
                        }
                        await manager.inject_incoming_email(active_sim_id, email_dict)
                        poller_log.info(
                            "Auto-detected new email '%s' and injected into simulation %s",
                            em.subject,
                            active_sim_id,
                        )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            poller_log.debug("Gmail background poll error: %s", exc)
            if "RATE_LIMIT_EXCEEDED" in str(exc) or "Quota exceeded" in str(exc) or "429" in str(exc):
                poll_delay = 60

        await asyncio.sleep(poll_delay)


@asynccontextmanager
async def _lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: run startup tasks, yield, then run shutdown tasks."""
    settings = get_settings()
    log = logging.getLogger(__name__)

    # --- Startup ---
    log.info(
        "CYBER HUNT API starting up",
        extra={
            "version": settings.app_version,
            "environment": settings.environment,
            "gemini_model": settings.gemini_model,
            "opa_url": settings.opa_url,
        },
    )

    # Initialize durable PostgreSQL checkpointer if DATABASE_URL configured
    if settings.database_url:
        try:
            init_postgres_checkpointer(settings)
            log.info("Durable PostgreSQL checkpointer ready for simulations")
        except Exception as exc:
            log.critical("Failed to initialize durable PostgreSQL checkpointer on startup: %s", exc)
            if settings.environment == "production":
                raise
    elif settings.environment == "production":
        log.critical("DATABASE_URL missing in production — durable checkpointing unavailable")
        raise RuntimeError("DATABASE_URL must be configured in production for durable LangGraph checkpointing.")

    # Start background Gmail polling worker for automatic email detection
    poller_task = asyncio.create_task(_email_polling_worker(), name="gmail-poller-worker")

    yield  # Application is live and serving requests here

    # --- Shutdown ---
    log.info("CYBER HUNT API shutting down")
    poller_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await poller_task

    from app.orchestration.manager import reset_simulation_manager
    reset_simulation_manager()
    close_postgres_checkpointer()


def create_application() -> FastAPI:
    """Create and configure the CYBER HUNT FastAPI application.

    Returns:
        A fully wired FastAPI instance ready to be served by Uvicorn.
    """
    settings = get_settings()

    # Initialise logging before anything else so all subsequent log calls
    # use the JSON formatter.
    setup_logging(level=settings.log_level)

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "CYBER HUNT API — Red Team vs Blue Team agent simulation platform. "
            "Built for CYBER-02 hackathon challenge. "
            "The LLM recommends. The Policy Engine decides. The Mock Gateway enforces."
        ),
        lifespan=_lifespan,
        # Disable docs in production to reduce attack surface
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    # --- CORS ---
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Request Tracing Middleware ---
    @application.middleware("http")
    async def correlation_id_middleware(request, call_next):
        import uuid
        from app.core.logging import set_correlation_id

        corr_id = request.headers.get("X-Correlation-ID") or f"req-{uuid.uuid4().hex[:12]}"
        set_correlation_id(corr_id)
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        return response

    # --- Exception handlers ---
    register_exception_handlers(application)

    # --- Routes ---
    from app.api.v1.router import router as v1_router

    application.include_router(v1_router)

    return application


# ASGI entry point for Uvicorn:
#   uvicorn app.main:app --reload --app-dir backend
app = create_application()

