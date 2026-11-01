"""Repository for Human-in-the-Loop Approval Requests."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.db.repositories.base import BaseRepository


class ApprovalRepository(BaseRepository):
    """Data access layer for public.approval_requests."""

    def create(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new approval request."""
        resp = self._execute(self.client.table("approval_requests").insert(request_data))
        return resp.data[0] if resp.data else {}

    def get_by_id(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Fetch approval request by UUID."""
        resp = self._execute(
            self.client.table("approval_requests")
            .select("*")
            .eq("id", request_id)
            .limit(1)
        )
        return resp.data[0] if resp.data else None

    def list_pending(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List active pending approval requests."""
        resp = self._execute(
            self.client.table("approval_requests")
            .select("*")
            .eq("decision", "PENDING")
            .order("created_at", desc=False)
            .limit(limit)
        )
        return resp.data or []

    def get_pending_by_simulation(self, simulation_id: str) -> Optional[Dict[str, Any]]:
        """Fetch active pending approval request for a simulation."""
        resp = self._execute(
            self.client.table("approval_requests")
            .select("*")
            .eq("simulation_id", simulation_id)
            .eq("decision", "PENDING")
            .order("created_at", desc=True)
            .limit(1)
        )
        return resp.data[0] if resp.data else None

    def resolve(
        self,
        request_id: str,
        decision: str,
        approver_id: str,
        reason: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Resolve an approval request (APPROVED or REJECTED)."""
        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "decision": decision,
            "approver_id": approver_id,
            "reason": reason,
            "resolved_at": now,
        }
        resp = self._execute(
            self.client.table("approval_requests")
            .update(update_data)
            .eq("id", request_id)
            .eq("decision", "PENDING")
        )
        return resp.data[0] if resp.data else None

