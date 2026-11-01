"""Repository for User Profiles."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.db.repositories.base import BaseRepository


class ProfileRepository(BaseRepository):
    """Data access layer for public.profiles."""

    def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve user profile by auth.users ID."""
        resp = self._execute(
            self.client.table("profiles").select("*").eq("id", user_id).limit(1)
        )
        return resp.data[0] if resp.data else None

    def upsert_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert or update a profile."""
        resp = self._execute(
            self.client.table("profiles").upsert(profile_data).execute()
            if hasattr(self.client.table("profiles").upsert(profile_data), "execute")
            else self.client.table("profiles").upsert(profile_data)
        )
        return resp.data[0] if resp.data else profile_data

    def update_role(self, user_id: str, role: str) -> Optional[Dict[str, Any]]:
        """Update user role (admin only operation)."""
        resp = self._execute(
            self.client.table("profiles").update({"role": role}).eq("id", user_id)
        )
        return resp.data[0] if resp.data else None

