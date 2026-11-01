"""Event Broadcaster Utility linked to LangGraph state transitions and SimulationManager — WS-003.

Enforces:
- Sequence ordering: Every event receives a monotonically increasing sequence_number per simulation.
- Append-only persistence: Recorded to `simulation_events` before broadcast.
- Zero-leak broadcast: Routed solely to the target simulation's active WebSocket subscribers.
- Non-blocking: Failures in persistence or disconnected sockets never disrupt backend workflow.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.db.client import get_supabase_client
from app.db.repositories.event_repo import EventRepository
from app.schemas.event import EventType, SimulationEvent
from app.websocket.manager import get_connection_manager

log = logging.getLogger(__name__)

# Fallback in-memory event store for testing when database is unconfigured
_in_memory_event_store: Dict[str, list[Dict[str, Any]]] = {}


def get_in_memory_events(simulation_id: str) -> list[Dict[str, Any]]:
    """Return in-memory events for a simulation."""
    return list(_in_memory_event_store.get(simulation_id, []))


def clear_in_memory_events() -> None:
    """Clear in-memory events for test isolation."""
    global _in_memory_event_store
    _in_memory_event_store = {}


async def emit_simulation_event(
    *,
    simulation_id: str,
    event_type: EventType | str,
    payload: Dict[str, Any],
    event_repo: Optional[EventRepository] = None,
) -> SimulationEvent:
    """Generate, persist, and broadcast a standardized SimulationEvent.

    Args:
        simulation_id: UUID of the target simulation.
        event_type: One of the 14 standard PRD event types or dot-delimited string.
        payload: Event domain payload dictionary.
        event_repo: Optional database repository. If None, resolves from client or memory.

    Returns:
        The generated and broadcast SimulationEvent.
    """
    event_type_str = event_type.value if isinstance(event_type, EventType) else str(event_type)
    cm = get_connection_manager()

    # 1. Determine next sequence number
    # If not cached in connection manager, query repo/memory
    current_seq_seed = None
    if simulation_id not in cm._sequence_counters:
        if event_repo:
            try:
                uuid.UUID(simulation_id)
                current_seq_seed = event_repo.get_latest_sequence_number(simulation_id)
            except Exception:
                pass
        if current_seq_seed is None:
            mem_events = _in_memory_event_store.get(simulation_id, [])
            current_seq_seed = len(mem_events)

    seq_num = cm.get_next_sequence_number(simulation_id, seed=current_seq_seed)

    # 2. Construct standardized SimulationEvent envelope (WS-001)
    event = SimulationEvent(
        event_id=str(uuid.uuid4()),
        simulation_id=simulation_id,
        sequence_number=seq_num,
        event_type=event_type_str,
        timestamp=datetime.now(timezone.utc).isoformat(),
        schema_version="1.0",
        payload=payload,
    )

    event_dict = event.model_dump()

    # 3. Append to in-memory store
    _in_memory_event_store.setdefault(simulation_id, []).append(event_dict)

    # 4. Append-only persistence to Supabase simulation_events (WS-004)
    if event_repo:
        try:
            uuid.UUID(simulation_id)
            event_repo.append({
                "id": event.event_id,
                "simulation_id": simulation_id,
                "sequence_number": seq_num,
                "event_type": event_type_str,
                "schema_version": "1.0",
                "payload": payload,
                "timestamp": event.timestamp,
            })
        except Exception as exc:
            log.debug("Event persistence to DB skipped/failed for %s: %s", simulation_id, exc)
    else:
        # Attempt resolving client
        try:
            client = get_supabase_client()
            uuid.UUID(simulation_id)
            repo = EventRepository(client)
            repo.append({
                "id": event.event_id,
                "simulation_id": simulation_id,
                "sequence_number": seq_num,
                "event_type": event_type_str,
                "schema_version": "1.0",
                "payload": payload,
                "timestamp": event.timestamp,
            })
        except Exception:
            pass

    # 5. Broadcast to connected WebSocket subscribers (WS-002, WS-003)
    await cm.broadcast(simulation_id, event)

    log.debug(
        "Emitted event %s (seq=%d) for simulation %s",
        event_type_str,
        seq_num,
        simulation_id,
    )

    return event

