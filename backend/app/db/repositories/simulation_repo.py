"""Repository for Simulation Runs."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.db.repositories.base import BaseRepository


class SimulationRepository(BaseRepository):
    """Data access layer for public.simulations."""

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a new simulation record."""
        resp = self._execute(self.client.table("simulations").insert(data))
        return resp.data[0] if resp.data else {}

    def get_by_id(self, simulation_id: str) -> Optional[Dict[str, Any]]:
        """Fetch simulation by UUID."""
        resp = self._execute(
            self.client.table("simulations").select("*").eq("id", simulation_id).limit(1)
        )
        return resp.data[0] if resp.data else None

    def list_by_owner(
        self, owner_id: str, limit: int = 20, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List simulations owned by a specific user with pagination."""
        resp = self._execute(
            self.client.table("simulations")
            .select("*")
            .eq("owner_id", owner_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        return resp.data or []

    def count_by_owner(self, owner_id: str) -> int:
        """Count total simulations owned by a user."""
        resp = self._execute(
            self.client.table("simulations")
            .select("id", count="exact")
            .eq("owner_id", owner_id)
        )
        return resp.count if resp.count is not None else len(resp.data or [])

    def update_state(
        self, simulation_id: str, state: str, current_step: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Update simulation lifecycle state and current step."""
        update_data: Dict[str, Any] = {"state": state}
        if current_step is not None:
            update_data["current_step"] = current_step

        resp = self._execute(
            self.client.table("simulations").update(update_data).eq("id", simulation_id)
        )
        return resp.data[0] if resp.data else None

    def update_metrics(
        self, simulation_id: str, final_metrics: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update simulation final scoring metrics."""
        resp = self._execute(
            self.client.table("simulations")
            .update({"final_metrics": final_metrics})
            .eq("id", simulation_id)
        )
        return resp.data[0] if resp.data else None

