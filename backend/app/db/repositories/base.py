"""Base Repository for Supabase PostgREST operations."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from supabase import Client

from app.core.errors import DatabaseError

log = logging.getLogger(__name__)


class BaseRepository:
    """Base repository handling Supabase client interaction and error wrapping."""

    def __init__(self, client: Client) -> None:
        self.client = client

    def _execute(self, query: Any) -> Any:
        """Execute a PostgREST query and map errors to DatabaseError."""
        try:
            return query.execute()
        except Exception as exc:
            log.error("Database query failed: %s", exc)
            raise DatabaseError(f"Database operation failed: {exc}") from exc

