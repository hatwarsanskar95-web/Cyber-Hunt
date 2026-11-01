"""Unit tests for BE-002 — Structured JSON Logging (backend/app/core/logging.py)."""

import json
import logging
import sys
from io import StringIO

import pytest

from app.core.logging import (
    JsonFormatter,
    get_logger,
    get_correlation_id,
    get_simulation_id,
    redact,
    set_correlation_id,
    set_simulation_id,
    setup_logging,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _capture_log(logger: logging.Logger, level: int, message: str, **kwargs) -> dict:
    """Capture a single log record as a parsed JSON dict."""
    buf = StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(JsonFormatter())
    logger.handlers = [handler]
    logger.setLevel(logging.DEBUG)
    logger.log(level, message, **kwargs)
    buf.seek(0)
    return json.loads(buf.read())


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestJsonFormatter:
    def test_output_is_valid_json(self):
        log = get_logger("test.json_format")
        record = _capture_log(log, logging.INFO, "hello world")
        # If we reach here, json.loads succeeded
        assert record["message"] == "hello world"

    def test_required_fields_present(self):
        log = get_logger("test.required_fields")
        record = _capture_log(log, logging.WARNING, "test message")
        for field in ("timestamp", "level", "logger", "message"):
            assert field in record, f"Missing field: {field}"

    def test_level_reflects_severity(self):
        log = get_logger("test.level")
        assert _capture_log(log, logging.DEBUG, "d")["level"] == "DEBUG"
        assert _capture_log(log, logging.INFO, "i")["level"] == "INFO"
        assert _capture_log(log, logging.ERROR, "e")["level"] == "ERROR"

    def test_logger_name_correct(self):
        log = get_logger("my.special.module")
        record = _capture_log(log, logging.INFO, "msg")
        assert record["logger"] == "my.special.module"

    def test_exception_field_on_error(self):
        log = get_logger("test.exception")
        buf = StringIO()
        handler = logging.StreamHandler(buf)
        handler.setFormatter(JsonFormatter())
        log.handlers = [handler]
        log.setLevel(logging.DEBUG)
        try:
            raise ValueError("boom")
        except ValueError:
            log.exception("caught error")
        buf.seek(0)
        record = json.loads(buf.read())
        assert "exception" in record
        assert "ValueError" in record["exception"]


class TestContextVars:
    def test_correlation_id_appears_in_log(self):
        set_correlation_id("req-abc-123")
        log = get_logger("test.correlation")
        record = _capture_log(log, logging.INFO, "with correlation")
        assert record.get("correlation_id") == "req-abc-123"

    def test_simulation_id_appears_in_log(self):
        set_simulation_id("sim-xyz-456")
        log = get_logger("test.simulation")
        record = _capture_log(log, logging.INFO, "with simulation")
        assert record.get("simulation_id") == "sim-xyz-456"

    def test_get_correlation_id_returns_set_value(self):
        set_correlation_id("check-id")
        assert get_correlation_id() == "check-id"

    def test_get_simulation_id_returns_set_value(self):
        set_simulation_id("check-sim")
        assert get_simulation_id() == "check-sim"


class TestRedact:
    def test_redacts_api_key_field(self):
        data = {"gemini_api_key": "super-secret", "other": "value"}
        result = redact(data)
        assert result["gemini_api_key"] == "***REDACTED***"
        assert result["other"] == "value"

    def test_redacts_password_field(self):
        data = {"password": "hunter2"}
        result = redact(data)
        assert result["password"] == "***REDACTED***"

    def test_redacts_nested_secrets(self):
        data = {"config": {"database_url": "postgres://user:pass@host/db"}}
        result = redact(data)
        assert result["config"]["database_url"] == "***REDACTED***"

    def test_leaves_safe_fields_untouched(self):
        data = {"username": "admin", "action": "login"}
        result = redact(data)
        assert result == data

    def test_handles_list_of_dicts(self):
        data = [{"token": "abc"}, {"name": "visible"}]
        result = redact(data)
        assert result[0]["token"] == "***REDACTED***"
        assert result[1]["name"] == "visible"

    def test_scalar_passthrough(self):
        assert redact("hello") == "hello"
        assert redact(42) == 42
        assert redact(None) is None


class TestSetupLogging:
    def test_setup_logging_does_not_crash(self):
        setup_logging("DEBUG")
        log = logging.getLogger("test.setup")
        # Should not raise
        log.info("setup test")

    def test_get_logger_returns_logger(self):
        log = get_logger("my.module")
        assert isinstance(log, logging.Logger)
        assert log.name == "my.module"

