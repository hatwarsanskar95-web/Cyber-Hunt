"""Unit tests for BE-003 — Custom Exception Hierarchy and Error Handlers
(backend/app/core/errors.py).
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.errors import (
    AgentExecutionError,
    AuthenticationError,
    AuthorizationError,
    ConfigurationError,
    CyberHuntError,
    DatabaseError,
    ExternalServiceError,
    PolicyEnforcementError,
    SimulationStateError,
    ValidationError,
    register_exception_handlers,
)


# ---------------------------------------------------------------------------
# HTTP status mapping
# ---------------------------------------------------------------------------


class TestExceptionHttpStatus:
    """Each exception class must map to the specified HTTP status code."""

    @pytest.mark.parametrize(
        "exc_class, expected_status",
        [
            (ConfigurationError, status.HTTP_500_INTERNAL_SERVER_ERROR),
            (AuthenticationError, status.HTTP_401_UNAUTHORIZED),
            (AuthorizationError, status.HTTP_403_FORBIDDEN),
            (ValidationError, status.HTTP_422_UNPROCESSABLE_CONTENT),
            (DatabaseError, status.HTTP_503_SERVICE_UNAVAILABLE),
            (ExternalServiceError, status.HTTP_503_SERVICE_UNAVAILABLE),
            (PolicyEnforcementError, status.HTTP_403_FORBIDDEN),
            (SimulationStateError, status.HTTP_409_CONFLICT),
            (AgentExecutionError, status.HTTP_500_INTERNAL_SERVER_ERROR),
        ],
    )
    def test_http_status(self, exc_class, expected_status):
        exc = exc_class()
        assert exc.http_status == expected_status


# ---------------------------------------------------------------------------
# Error code mapping
# ---------------------------------------------------------------------------


class TestExceptionErrorCodes:
    @pytest.mark.parametrize(
        "exc_class, expected_code",
        [
            (ConfigurationError, "CONFIGURATION_ERROR"),
            (AuthenticationError, "AUTHENTICATION_ERROR"),
            (AuthorizationError, "AUTHORIZATION_ERROR"),
            (ValidationError, "VALIDATION_ERROR"),
            (DatabaseError, "DATABASE_ERROR"),
            (ExternalServiceError, "EXTERNAL_SERVICE_ERROR"),
            (PolicyEnforcementError, "POLICY_ENFORCEMENT_ERROR"),
            (SimulationStateError, "SIMULATION_STATE_ERROR"),
            (AgentExecutionError, "AGENT_EXECUTION_ERROR"),
        ],
    )
    def test_error_code(self, exc_class, expected_code):
        exc = exc_class()
        assert exc.code == expected_code


# ---------------------------------------------------------------------------
# Error envelope format
# ---------------------------------------------------------------------------


class TestErrorEnvelope:
    def test_to_response_body_structure(self):
        exc = AuthorizationError("You shall not pass.", details={"role": "viewer"})
        body = exc.to_response_body()
        assert body["status"] == "error"
        assert body["error"]["code"] == "AUTHORIZATION_ERROR"
        assert body["error"]["message"] == "You shall not pass."
        assert body["error"]["details"] == {"role": "viewer"}

    def test_details_none_by_default(self):
        exc = DatabaseError()
        body = exc.to_response_body()
        assert body["error"]["details"] is None

    def test_message_preserved(self):
        exc = AgentExecutionError("Red agent crashed unexpectedly.")
        assert exc.message == "Red agent crashed unexpectedly."
        assert str(exc) == "Red agent crashed unexpectedly."


# ---------------------------------------------------------------------------
# Inheritance
# ---------------------------------------------------------------------------


class TestExceptionInheritance:
    def test_all_inherit_from_cyber_hunt_error(self):
        for cls in (
            ConfigurationError,
            AuthenticationError,
            AuthorizationError,
            ValidationError,
            DatabaseError,
            ExternalServiceError,
            PolicyEnforcementError,
            SimulationStateError,
            AgentExecutionError,
        ):
            assert issubclass(cls, CyberHuntError), f"{cls} should inherit CyberHuntError"


# ---------------------------------------------------------------------------
# FastAPI integration via TestClient
# ---------------------------------------------------------------------------


def _make_test_app():
    """Create a minimal FastAPI app that raises various exceptions for testing."""
    from fastapi import FastAPI

    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/raise/{exc_name}")
    def raise_exc(exc_name: str):
        mapping = {
            "auth": AuthenticationError("Not authenticated."),
            "authz": AuthorizationError("Forbidden."),
            "policy": PolicyEnforcementError("Policy blocked this action."),
            "db": DatabaseError("DB down."),
            "agent": AgentExecutionError("Agent failed."),
            "state": SimulationStateError("Wrong state."),
            "config": ConfigurationError("Bad config."),
            "generic": CyberHuntError("Base error."),
        }
        raise mapping.get(exc_name, CyberHuntError("Unknown."))

    @app.get("/unhandled")
    def raise_unhandled():
        raise RuntimeError("Something truly unexpected.")

    return app


@pytest.fixture(scope="function")
def error_client():
    app = _make_test_app()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


class TestFastAPIErrorHandlers:
    def test_authentication_returns_401(self, error_client):
        r = error_client.get("/raise/auth")
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "AUTHENTICATION_ERROR"

    def test_authorization_returns_403(self, error_client):
        r = error_client.get("/raise/authz")
        assert r.status_code == 403

    def test_policy_returns_403(self, error_client):
        r = error_client.get("/raise/policy")
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "POLICY_ENFORCEMENT_ERROR"

    def test_database_returns_503(self, error_client):
        r = error_client.get("/raise/db")
        assert r.status_code == 503

    def test_agent_returns_500(self, error_client):
        r = error_client.get("/raise/agent")
        assert r.status_code == 500

    def test_state_returns_409(self, error_client):
        r = error_client.get("/raise/state")
        assert r.status_code == 409

    def test_unhandled_returns_500_without_details(self, error_client):
        r = error_client.get("/unhandled")
        assert r.status_code == 500
        body = r.json()
        assert body["status"] == "error"
        assert body["error"]["code"] == "INTERNAL_SERVER_ERROR"
        # Must not expose internal traceback strings to caller
        assert "RuntimeError" not in body["error"]["message"]

    def test_error_envelope_shape(self, error_client):
        r = error_client.get("/raise/auth")
        body = r.json()
        assert "status" in body
        assert "error" in body
        assert "code" in body["error"]
        assert "message" in body["error"]
        assert "details" in body["error"]
