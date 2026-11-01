"""Durable PostgreSQL Checkpointing for LangGraph Multi-Agent Orchestration.

Replaces in-memory MemorySaver with reliable, durable PostgreSQL-backed
checkpointing using the application's configured PostgreSQL database.

Requirements:
- Strict fail-closed: No silent fallback to MemorySaver if PostgreSQL is unconfigured or fails.
- Schema setup: Ensures checkpoint tables and migrations are initialized safely.
- Safe lifecycle: Connection pool opened on startup, closed on shutdown.
- Thread binding: Simulations are bound to stable, unique thread IDs.
- Secret redaction: Database credentials are never logged or exposed.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from langgraph.checkpoint.base import BaseCheckpointSaver
from psycopg_pool import ConnectionPool
from langgraph.checkpoint.postgres import PostgresSaver

from app.config import Settings, get_settings
from app.core.errors import ConfigurationError, DatabaseError

log = logging.getLogger(__name__)

# Singletons for connection pool and checkpointer
_pool: Optional[ConnectionPool] = None
_postgres_saver: Optional[PostgresSaver] = None
_test_checkpointer: Optional[BaseCheckpointSaver] = None


def _redact_conn_string(url: str) -> str:
    """Mask credentials in database URL for safe logging without parsing crashes."""
    try:
        # Regex replacement preserves scheme, host, port, db name while redacting user & password
        return re.sub(r"://([^:@]+):([^@]+)@", r"://***:***@", url)
    except Exception:
        return "***"


def init_postgres_checkpointer(settings: Optional[Settings] = None, max_retries: int = 3) -> PostgresSaver:
    """Initialize connection pool and PostgreSQL checkpointer with automatic retry and backoff.

    Ensures checkpoint tables (checkpoints, checkpoint_blobs, checkpoint_writes,
    checkpoint_migrations) are verified/created via LangGraph checkpointer setup.

    Raises:
        ConfigurationError: If DATABASE_URL is missing.
        DatabaseError: If connection or schema setup fails after retries.
    """
    global _pool, _postgres_saver

    if _postgres_saver is not None:
        return _postgres_saver

    cfg = settings or get_settings()

    if not cfg.database_url:
        masked_msg = "DATABASE_URL is not configured for persistent LangGraph checkpointing."
        log.error(masked_msg)
        raise ConfigurationError(masked_msg)

    conninfo = cfg.database_url.get_secret_value()
    redacted = _redact_conn_string(conninfo)

    log.info("Initializing persistent LangGraph PostgreSQL checkpointer", extra={"db_host": redacted})

    last_error: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            pool = ConnectionPool(
                conninfo=conninfo,
                min_size=1,
                max_size=10,
                timeout=10.0,
                check=ConnectionPool.check_connection,
                open=True,
                kwargs={"autocommit": True, "prepare_threshold": 0},
            )
            saver = PostgresSaver(pool)
            # Initialize LangGraph checkpoint tables and schema migrations
            saver.setup()

            _pool = pool
            _postgres_saver = saver
            log.info("LangGraph PostgreSQL checkpointer successfully initialized and schema verified")
            return _postgres_saver
        except Exception as exc:
            last_error = exc
            log.warning(
                "PostgreSQL checkpointer initialization attempt %d/%d failed: %s",
                attempt,
                max_retries,
                exc,
            )
            if attempt < max_retries:
                time.sleep(1.0 * attempt)

    log.critical("Failed to initialize persistent PostgreSQL checkpointer after %d attempts: %s", max_retries, last_error)
    if _pool is not None:
        try:
            _pool.close()
        except Exception:
            pass
        _pool = None
    _postgres_saver = None
    raise DatabaseError(f"PostgreSQL checkpointer initialization failed: {last_error}") from last_error


def get_checkpointer(settings: Optional[Settings] = None) -> BaseCheckpointSaver:
    """Return the active durable checkpointer.

    Strict fail-closed: If PostgreSQL checkpointer is not initialized, attempts initialization.
    If initialization fails, raises DatabaseError / ConfigurationError.
    NEVER silently falls back to MemorySaver in production.
    """
    global _postgres_saver, _test_checkpointer

    # In test isolation, an explicit test checkpointer may be configured
    if _test_checkpointer is not None:
        return _test_checkpointer

    if _postgres_saver is not None:
        return _postgres_saver

    # Attempt on-demand initialization
    return init_postgres_checkpointer(settings)


def close_postgres_checkpointer() -> None:
    """Close the checkpointer connection pool cleanly on application shutdown."""
    global _pool, _postgres_saver
    if _pool is not None:
        try:
            _pool.close()
            log.info("LangGraph PostgreSQL connection pool closed cleanly")
        except Exception as exc:
            log.warning("Error closing checkpointer connection pool: %s", exc)
        finally:
            _pool = None
            _postgres_saver = None


def set_test_checkpointer(saver: Optional[BaseCheckpointSaver]) -> None:
    """Set an explicit checkpointer for test fixtures."""
    global _test_checkpointer
    _test_checkpointer = saver


def reset_checkpointer() -> None:
    """Reset singletons for test teardown."""
    global _test_checkpointer
    _test_checkpointer = None
    close_postgres_checkpointer()


# Backward-compatible alias for existing imports
get_memory_checkpointer = get_checkpointer
