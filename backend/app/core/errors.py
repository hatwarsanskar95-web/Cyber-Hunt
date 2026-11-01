"""Custom Exception Hierarchy and FastAPI Error Handlers for CYBER HUNT.

All application errors derive from ``CyberHuntError``.  Each subclass maps to
a specific HTTP status code and a machine-readable error code string so that
clients can branch on structured responses rather than raw status codes.

Uniform JSON error envelope::

    {
        "status": "error",
        "error": {
            "code":    "<SCREAMING_SNAKE_CASE>",
            "message": "<human readable>",
            "details": null | <any>
        }
    }
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


# ---------------------------------------------------------------------------
# Base exception
# ---------------------------------------------------------------------------


class CyberHuntError(Exception):
    """Root exception for all CYBER HUNT application errors.

    Attributes:
        message:   Human-readable description shown in error responses.
        code:      Machine-readable error code (e.g. ``"AGENT_EXECUTION_ERROR"``).
        details:   Optional structured details for debugging or client logic.
        http_status: HTTP status code to use when converting to a response.
    """

    http_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "CYBER_HUNT_ERROR"

    def __init__(
        self,
        message: str = "An unexpected error occurred.",
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details

    def to_response_body(self) -> dict:
        """Serialise to the uniform error envelope."""
        return {
            "status": "error",
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            },
        }


# ---------------------------------------------------------------------------
# Concrete exception subclasses
# ---------------------------------------------------------------------------


class ConfigurationError(CyberHuntError):
    """Raised when the application is misconfigured (e.g. missing required env var)."""

    http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "CONFIGURATION_ERROR"

    def __init__(self, message: str = "Application configuration error.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class AuthenticationError(CyberHuntError):
    """Raised when a request cannot be authenticated (401)."""

    http_status = status.HTTP_401_UNAUTHORIZED
    code = "AUTHENTICATION_ERROR"

    def __init__(self, message: str = "Authentication required.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class AuthorizationError(CyberHuntError):
    """Raised when an authenticated principal lacks permission (403)."""

    http_status = status.HTTP_403_FORBIDDEN
    code = "AUTHORIZATION_ERROR"

    def __init__(self, message: str = "Access denied.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class ValidationError(CyberHuntError):
    """Raised on semantic validation failures (422).

    Note: Pydantic ``RequestValidationError`` is handled separately via
    ``register_exception_handlers``; this class covers domain-level validation.
    """

    http_status = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "VALIDATION_ERROR"

    def __init__(self, message: str = "Validation failed.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class DatabaseError(CyberHuntError):
    """Raised on database connectivity or query failures (503)."""

    http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "DATABASE_ERROR"

    def __init__(self, message: str = "Database operation failed.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class ExternalServiceError(CyberHuntError):
    """Raised when an external dependency (Gemini, OPA, Supabase) is unavailable (503)."""

    http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "EXTERNAL_SERVICE_ERROR"

    def __init__(self, message: str = "External service unavailable.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class PolicyEnforcementError(CyberHuntError):
    """Raised when OPA blocks an action under policy (403)."""

    http_status = status.HTTP_403_FORBIDDEN
    code = "POLICY_ENFORCEMENT_ERROR"

    def __init__(self, message: str = "Action blocked by policy.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class SimulationStateError(CyberHuntError):
    """Raised when an operation is invalid for the simulation's current state (409)."""

    http_status = status.HTTP_409_CONFLICT
    code = "SIMULATION_STATE_ERROR"

    def __init__(self, message: str = "Invalid simulation state transition.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class NotFoundError(CyberHuntError):
    """Raised when a requested resource is not found (404)."""

    http_status = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"

    def __init__(self, message: str = "Resource not found.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


class AgentExecutionError(CyberHuntError):
    """Raised when an LangGraph agent node encounters a fatal error (500)."""

    http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "AGENT_EXECUTION_ERROR"

    def __init__(self, message: str = "Agent execution failed.", details: Optional[Any] = None) -> None:
        super().__init__(message, details)


# ---------------------------------------------------------------------------
# FastAPI exception handler registration
# ---------------------------------------------------------------------------


def _make_error_response(exc: CyberHuntError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content=exc.to_response_body(),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all CYBER HUNT exception handlers to a FastAPI application.

    Also registers a generic ``Exception`` fallback that returns 500 without
    exposing internal details.

    Args:
        app: The FastAPI application instance.
    """
    import logging

    from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
    from fastapi.exceptions import HTTPException, RequestValidationError

    log = logging.getLogger(__name__)

    # --- domain exception handlers ---
    for exc_class in (
        ConfigurationError,
        AuthenticationError,
        AuthorizationError,
        ValidationError,
        DatabaseError,
        ExternalServiceError,
        PolicyEnforcementError,
        SimulationStateError,
        NotFoundError,
        AgentExecutionError,
        CyberHuntError,  # catch-all for direct CyberHuntError raises
    ):
        # Capture exc_class in closure via default argument
        def _make_handler(cls):
            async def handler(request: Request, exc: Exception) -> JSONResponse:
                # exc will be an instance of cls (a CyberHuntError subclass)
                cyber_exc = exc if isinstance(exc, CyberHuntError) else CyberHuntError(str(exc))
                log.error(
                    "Handled %s: %s",
                    cls.__name__,
                    cyber_exc.message,
                    extra={"error_code": cyber_exc.code, "details": cyber_exc.details},
                )
                return _make_error_response(cyber_exc)

            return handler

        app.add_exception_handler(exc_class, _make_handler(exc_class))

    # --- FastAPI built-ins ---
    @app.exception_handler(HTTPException)
    async def _http_exc_handler(request: Request, exc: HTTPException):
        log.warning("HTTPException %s: %s", exc.status_code, exc.detail)
        return await http_exception_handler(request, exc)

    @app.exception_handler(RequestValidationError)
    async def _validation_exc_handler(request: Request, exc: RequestValidationError):
        log.warning("RequestValidationError: %s", exc.errors())
        return await request_validation_exception_handler(request, exc)

    # --- generic fallback ---
    @app.exception_handler(Exception)
    async def _generic_handler(request: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected internal error occurred.",
                    "details": None,
                },
            },
        )
