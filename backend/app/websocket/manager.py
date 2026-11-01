"""WebSocket Connection Manager and Event Broadcaster — WS-002, WS-003, WS-006.

Features:
- Maintains active WebSocket connections partitioned by simulation_id.
- Isolated broadcasting: clients of sim-A never receive events for sim-B.
- Resilient dispatch: disconnected clients are pruned without affecting other clients or backend execution.
- Heartbeat monitoring: handles client ping/pong keepalives.
- Event sequence numbering & append-only persistence integration.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

from app.schemas.event import EventType, SimulationEvent

log = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections subscribed to simulation event streams."""

    def __init__(self) -> None:
        # Maps simulation_id -> set of active WebSocket instances
        self._subscriptions: Dict[str, Set[WebSocket]] = {}
        # Monotonic sequence counter per simulation (in-memory fast cache)
        self._sequence_counters: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, simulation_id: str) -> None:
        """Accept incoming connection and register subscription for simulation_id."""
        await websocket.accept()
        async with self._lock:
            subs = self._subscriptions.setdefault(simulation_id, set())
            subs.add(websocket)
            client_count = len(subs)

        log.info(
            "WebSocket client connected to simulation stream",
            extra={"simulation_id": simulation_id, "active_clients": client_count},
        )

    async def disconnect(self, websocket: WebSocket, simulation_id: str) -> None:
        """Unregister a client connection."""
        async with self._lock:
            subs = self._subscriptions.get(simulation_id)
            if subs and websocket in subs:
                subs.remove(websocket)
                if not subs:
                    self._subscriptions.pop(simulation_id, None)

        log.info(
            "WebSocket client disconnected from simulation stream",
            extra={"simulation_id": simulation_id},
        )

    def get_active_count(self, simulation_id: str) -> int:
        """Return number of actively connected clients for a simulation."""
        return len(self._subscriptions.get(simulation_id, set()))

    def get_next_sequence_number(self, simulation_id: str, seed: Optional[int] = None) -> int:
        """Get next monotonically increasing sequence number for a simulation."""
        current = self._sequence_counters.get(simulation_id)
        if current is None:
            current = seed if seed is not None else 0
        next_seq = current + 1
        self._sequence_counters[simulation_id] = next_seq
        return next_seq

    def reset_sequence_counter(self, simulation_id: str) -> None:
        """Reset sequence counter (used for test setup)."""
        self._sequence_counters.pop(simulation_id, None)

    async def broadcast(self, simulation_id: str, event: SimulationEvent | Dict[str, Any]) -> None:
        """Broadcast an event to all connected clients for a simulation.

        Guarantees:
        - Clients of other simulations will NOT receive this event.
        - Broken / closed sockets are pruned immediately without raising exceptions.
        - Frontend disconnection will NEVER interrupt or block backend execution.
        """
        payload_dict = event.model_dump() if isinstance(event, SimulationEvent) else event
        serialized = json.dumps(payload_dict)

        async with self._lock:
            # Create a snapshot copy of subscribers to iterate safely
            subscribers = list(self._subscriptions.get(simulation_id, set()))

        if not subscribers:
            log.debug("No active WebSocket subscribers for simulation %s", simulation_id)
            return

        dead_sockets: list[WebSocket] = []

        for ws in subscribers:
            try:
                await ws.send_text(serialized)
            except Exception as exc:  # noqa: BLE001
                log.debug("Failed sending to subscriber, marking for removal: %s", exc)
                dead_sockets.append(ws)

        # Prune any failed sockets
        if dead_sockets:
            async with self._lock:
                subs = self._subscriptions.get(simulation_id)
                if subs:
                    for dead in dead_sockets:
                        subs.discard(dead)
                    if not subs:
                        self._subscriptions.pop(simulation_id, None)

    async def handle_incoming_messages(self, websocket: WebSocket, simulation_id: str) -> None:
        """Read and handle incoming messages (e.g. heartbeat ping/pong)."""
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    msg = json.loads(data)
                except Exception:
                    msg = {"type": data}

                msg_type = msg.get("type", "").lower()
                # Respond to ping heartbeats (WS-006)
                if msg_type in ("ping", "heartbeat"):
                    pong_event = {
                        "type": EventType.PONG.value,
                        "simulation_id": simulation_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    await websocket.send_text(json.dumps(pong_event))
        except WebSocketDisconnect:
            await self.disconnect(websocket, simulation_id)
        except Exception as exc:  # noqa: BLE001
            log.debug("WebSocket receive error: %s", exc)
            await self.disconnect(websocket, simulation_id)


# ---------------------------------------------------------------------------
# Global Singleton
# ---------------------------------------------------------------------------

_connection_manager: Optional[ConnectionManager] = None


def get_connection_manager() -> ConnectionManager:
    """Return the global ConnectionManager singleton."""
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager()
    return _connection_manager


def reset_connection_manager() -> None:
    """Reset the global connection manager for test isolation."""
    global _connection_manager
    _connection_manager = None

