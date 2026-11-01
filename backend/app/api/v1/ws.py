"""FastAPI WebSocket and Event Replay Endpoints — WS-002, WS-005.

Endpoints:
- WebSocket /api/v1/ws/simulations/{id}: Real-time event stream subscription
- GET /api/v1/simulations/{id}/events: Ordered event replay with after_sequence support for reconnect synchronization
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.db.client import get_supabase_client
from app.db.repositories.event_repo import EventRepository
from app.schemas.common import SuccessResponse
from app.schemas.event import EventReplayResponse, SimulationEvent
from app.websocket.broadcaster import get_in_memory_events
from app.websocket.manager import ConnectionManager, get_connection_manager

log = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


# ---------------------------------------------------------------------------
# WebSocket Endpoint (WS-002)
# ---------------------------------------------------------------------------


@router.websocket("/ws/simulations/{id}")
async def websocket_simulation_stream(
    websocket: WebSocket,
    id: str,
) -> None:
    """Connect to live real-time simulation event stream.

    Per Phase 11 hackathon specifications:
    - No JWT required for local demo WebSocket connections.
    - Subscribes to events exclusively for the specified simulation ID.
    - Disconnected clients are handled gracefully without affecting backend workflow.
    - Supports heartbeat ping/pong keepalives.
    """
    cm: ConnectionManager = get_connection_manager()
    await cm.connect(websocket, id)

    try:
        await cm.handle_incoming_messages(websocket, id)
    except WebSocketDisconnect:
        await cm.disconnect(websocket, id)
    except Exception as exc:  # noqa: BLE001
        log.debug("WebSocket session ended: %s", exc)
        await cm.disconnect(websocket, id)


# ---------------------------------------------------------------------------
# Event Replay Endpoint (WS-005)
# ---------------------------------------------------------------------------


@router.get(
    "/simulations/{id}/events",
    response_model=SuccessResponse,
    summary="Replay simulation events for client reconnect synchronization",
)
async def replay_simulation_events(
    id: str,
    after_sequence: Optional[int] = Query(
        default=None,
        ge=0,
        description="Fetch events with sequence_number strictly greater than this value",
    ),
    from_sequence: int = Query(
        default=0,
        ge=0,
        description="Fetch events starting from sequence_number (used if after_sequence not set)",
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
        description="Maximum number of events to replay",
    ),
) -> SuccessResponse:
    """Return ordered event history for reconnect synchronization.

    Enables Next.js frontend to detect sequence gaps and replay missing events
    seamlessly after a brief network drop.
    """
    raw_events: list[dict] = []

    # 1. Attempt database fetch
    try:
        client = get_supabase_client()
        repo = EventRepository(client)
        raw_events = repo.get_events_for_simulation(
            simulation_id=id,
            from_sequence=from_sequence,
            after_sequence=after_sequence,
            limit=limit,
        )
    except Exception as exc:
        log.debug("DB event replay lookup skipped, using memory fallback: %s", exc)

    # 2. Fallback to in-memory store if DB has no results
    if not raw_events:
        mem_events = get_in_memory_events(id)
        if after_sequence is not None:
            raw_events = [e for e in mem_events if e.get("sequence_number", 0) > after_sequence][:limit]
        else:
            raw_events = [e for e in mem_events if e.get("sequence_number", 0) >= from_sequence][:limit]

    # Convert to SimulationEvent models
    events: list[SimulationEvent] = []
    latest_seq = 0
    for r in raw_events:
        try:
            evt = SimulationEvent(
                event_id=str(r.get("id") or r.get("event_id")),
                simulation_id=str(r.get("simulation_id")),
                sequence_number=int(r.get("sequence_number", 0)),
                event_type=str(r.get("event_type")),
                timestamp=str(r.get("timestamp")),
                schema_version=str(r.get("schema_version", "1.0")),
                payload=r.get("payload") or {},
            )
            events.append(evt)
            if evt.sequence_number > latest_seq:
                latest_seq = evt.sequence_number
        except Exception as parse_err:
            log.warning("Skipping malformed event in replay: %s", parse_err)

    data = EventReplayResponse(
        simulation_id=id,
        total_events=len(events),
        from_sequence=after_sequence + 1 if after_sequence is not None else from_sequence,
        latest_sequence=latest_seq,
        events=events,
    )

    return SuccessResponse(
        status="success",
        data=data.model_dump(),
        message=f"{len(events)} events replayed for simulation {id}.",
    )

