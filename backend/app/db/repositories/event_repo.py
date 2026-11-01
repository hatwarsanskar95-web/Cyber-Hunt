"""Repository for Simulation Events (append-only audit stream)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.db.repositories.base import BaseRepository


class EventRepository(BaseRepository):
    """Data access layer for public.simulation_events."""

    def append(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Append a single event to the simulation audit stream."""
        resp = self._execute(self.client.table("simulation_events").insert(event_data))
        return resp.data[0] if resp.data else {}

    def get_events_for_simulation(
        self,
        simulation_id: str,
        from_sequence: int = 0,
        after_sequence: Optional[int] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """Fetch ordered events for a simulation starting from sequence_number or strictly after."""
        query = (
            self.client.table("simulation_events")
            .select("*")
            .eq("simulation_id", simulation_id)
        )
        if after_sequence is not None:
            query = query.gt("sequence_number", after_sequence)
        else:
            query = query.gte("sequence_number", from_sequence)

        resp = self._execute(
            query.order("sequence_number", desc=False).limit(limit)
        )
        return resp.data or []

    def get_latest_sequence_number(self, simulation_id: str) -> int:
        """Get the highest sequence number recorded so far for a simulation."""
        resp = self._execute(
            self.client.table("simulation_events")
            .select("sequence_number")
            .eq("simulation_id", simulation_id)
            .order("sequence_number", desc=True)
            .limit(1)
        )
        if resp.data and len(resp.data) > 0:
            return int(resp.data[0]["sequence_number"])
        return 0

