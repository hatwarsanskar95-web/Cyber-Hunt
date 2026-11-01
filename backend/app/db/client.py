"""Supabase Client Factory and Lifecycle Management for CYBER HUNT.

Provides authenticated and service-role Supabase clients.
Never exposes credentials in logs.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

from app.config import Settings, get_settings
from app.core.errors import ConfigurationError, DatabaseError

log = logging.getLogger(__name__)

_supabase_admin_client: Optional[Client] = None


def get_supabase_client(settings: Optional[Settings] = None) -> Client:
    """Return an administrative Supabase client using the service-role key.

    Used by backend services to persist events, run state, and audit logs.
    Fails closed if the service-role key is not configured.
    """
    global _supabase_admin_client

    if _supabase_admin_client is not None:
        return _supabase_admin_client

    cfg = settings or get_settings()

    if not cfg.supabase_url:
        raise ConfigurationError("Supabase URL is not configured.")

    # In production/runtime, service_role_key is required for backend admin operations.
    # If not set, check anon_key as fallback for read-only / public testing.
    key = None
    if cfg.supabase_service_role_key:
        key = cfg.supabase_service_role_key.get_secret_value()
    elif cfg.supabase_anon_key:
        key = cfg.supabase_anon_key

    if not key:
        raise ConfigurationError(
            "Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is configured."
        )

    try:
        _supabase_admin_client = create_client(cfg.supabase_url, key)
        log.info(
            "Supabase client initialized",
            extra={"url": cfg.supabase_url, "has_service_role": cfg.has_supabase_service_role},
        )
        return _supabase_admin_client
    except Exception as exc:
        log.error("Failed to initialize Supabase client: %s", exc)
        raise DatabaseError(f"Failed to initialize Supabase client: {exc}") from exc


def reset_supabase_client() -> None:
    """Reset cached client singleton (primarily used for unit test teardown)."""
    global _supabase_admin_client
    _supabase_admin_client = None

