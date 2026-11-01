"""Structured JSON Logging for CYBER HUNT.

Provides a centralized logging setup that outputs machine-readable JSON records.
Correlation IDs and simulation IDs are automatically injected from contextvars.
Secrets are never included in log output.
"""

import json
import logging
import sys
import traceback
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Context variables – set per-request or per-simulation
# ---------------------------------------------------------------------------

_correlation_id: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)
_simulation_id: ContextVar[Optional[str]] = ContextVar("simulation_id", default=None)


def set_correlation_id(value: str) -> None:
    """Bind a correlation ID to the current async context."""
    _correlation_id.set(value)


def set_simulation_id(value: str) -> None:
    """Bind a simulation ID to the current async context."""
    _simulation_id.set(value)


def get_correlation_id() -> Optional[str]:
    """Return the current correlation ID, or None if not set."""
    return _correlation_id.get()


def get_simulation_id() -> Optional[str]:
    """Return the current simulation ID, or None if not set."""
    return _simulation_id.get()


# ---------------------------------------------------------------------------
# Secret redaction
# ---------------------------------------------------------------------------

_REDACTED = "***REDACTED***"

# Substrings whose values must never appear in log output.
_SECRET_KEYS = frozenset(
    {
        "gemini_api_key",
        "supabase_service_role_key",
        "database_url",
        "password",
        "secret",
        "token",
        "api_key",
    }
)


def redact(data: Any) -> Any:
    """Recursively replace secret fields with a redaction placeholder.

    Operates on dicts, lists, and scalar values.  The original object is
    not mutated – a sanitised copy is returned.
    """
    if isinstance(data, dict):
        return {
            k: _REDACTED if any(s in k.lower() for s in _SECRET_KEYS) else redact(v)
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [redact(item) for item in data]
    return data


# ---------------------------------------------------------------------------
# JSON Formatter
# ---------------------------------------------------------------------------


class JsonFormatter(logging.Formatter):
    """Format log records as single-line JSON objects.

    Each record includes:
    - ``timestamp`` — ISO-8601 with UTC offset
    - ``level``     — Severity label (DEBUG / INFO / WARNING / ERROR / CRITICAL)
    - ``logger``    — Logger name (module path)
    - ``message``   — Human-readable log message
    - ``correlation_id`` — Request correlation ID if set
    - ``simulation_id``  — Active simulation ID if set
    - ``exception`` — Formatted traceback string (only on exceptions)
    - Any extra key-value pairs passed via ``extra={}``
    """

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        payload: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": _correlation_id.get(),
            "simulation_id": _simulation_id.get(),
        }

        # Include exception info when present
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        elif record.exc_text:
            payload["exception"] = record.exc_text

        # Merge safe extra fields (skip internal logging attrs)
        _SKIP = frozenset(
            {
                "args",
                "created",
                "exc_info",
                "exc_text",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "message",
                "module",
                "msecs",
                "msg",
                "name",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "thread",
                "threadName",
                "taskName",
            }
        )
        for key, value in record.__dict__.items():
            if key not in _SKIP and not key.startswith("_"):
                payload[key] = redact(value)

        # Strip None context fields to reduce noise
        payload = {k: v for k, v in payload.items() if v is not None}

        return json.dumps(payload, default=str, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Setup helper
# ---------------------------------------------------------------------------


def setup_logging(level: str = "INFO") -> None:
    """Configure the root logger with a JSON handler on stdout.

    Should be called exactly once during application startup.

    Args:
        level: Logging level string (DEBUG / INFO / WARNING / ERROR / CRITICAL).
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(numeric_level)

    # Quieten noisy third-party loggers in production
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger.  Uses the module __name__ convention.

    Example::

        log = get_logger(__name__)
        log.info("Simulation started", extra={"simulation_id": sid})
    """
    return logging.getLogger(name)

