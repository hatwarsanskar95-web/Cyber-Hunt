"""Common Pydantic response models and shared enumerations for CYBER HUNT.

These schemas form the shared contract between the FastAPI backend and
the Next.js frontend.  They are intentionally framework-agnostic so they
can be imported by any layer (API, orchestration, security, etc.).
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Type variable for generic pagination
# ---------------------------------------------------------------------------

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class SimulationState(str, Enum):
    """Lifecycle states for a Red-vs-Blue simulation run."""

    CREATED = "CREATED"
    INITIALIZING = "INITIALIZING"
    RUNNING = "RUNNING"
    ANALYSING = "ANALYSING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ThreatSeverity(str, Enum):
    """Severity classification for detected threats or events."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class PolicyDecisionEnum(str, Enum):
    """Possible outcomes from the OPA policy engine."""

    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"


# ---------------------------------------------------------------------------
# Uniform response envelopes
# ---------------------------------------------------------------------------


class SuccessResponse(BaseModel):
    """Generic success wrapper returned by all non-paginated endpoints.

    Example::

        {"status": "success", "data": {...}, "message": "Simulation started."}
    """

    status: str = Field(default="success", description="Always 'success' for this model.")
    data: Any = Field(description="The actual payload of the response.")
    message: Optional[str] = Field(default=None, description="Optional human-readable note.")


class ErrorDetail(BaseModel):
    """Machine-readable error detail block embedded in ``ErrorResponse``."""

    code: str = Field(description="Screaming-snake-case error code (e.g. AGENT_EXECUTION_ERROR).")
    message: str = Field(description="Human-readable description of the error.")
    details: Optional[Any] = Field(default=None, description="Optional structured context for debugging.")


class ErrorResponse(BaseModel):
    """Uniform error envelope returned on all non-2xx responses.

    Example::

        {"status": "error", "error": {"code": "...", "message": "...", "details": null}}
    """

    status: str = Field(default="error", description="Always 'error' for this model.")
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Health status
# ---------------------------------------------------------------------------


class HealthStatus(BaseModel):
    """Response model for ``GET /api/v1/health``."""

    status: str = Field(description="Overall status: 'healthy' | 'degraded' | 'unhealthy'.")
    service: str = Field(description="Name of this service (e.g. 'CYBER HUNT API').")
    version: str = Field(description="API version string (e.g. '2.0.0').")
    checks: Dict[str, str] = Field(
        description="Per-dependency status map (key → 'healthy' | 'degraded' | 'unreachable' | 'unconfigured')."
    )


# ---------------------------------------------------------------------------
# Pagination helpers
# ---------------------------------------------------------------------------


class PaginationParams(BaseModel):
    """Query-parameter helper for list endpoints."""

    page: int = Field(default=1, ge=1, description="1-based page number.")
    page_size: int = Field(default=20, ge=1, le=100, description="Records per page (max 100).")

    @property
    def offset(self) -> int:
        """SQL OFFSET for this page."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """SQL LIMIT for this page (alias for page_size)."""
        return self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated list response.

    Usage::

        return PaginatedResponse[SimulationSummary](
            items=results,
            total=count,
            page=params.page,
            page_size=params.page_size,
        )
    """

    items: List[T] = Field(description="Records for the current page.")
    total: int = Field(description="Total number of matching records across all pages.")
    page: int = Field(description="Current page number (1-based).")
    page_size: int = Field(description="Records per page.")
    pages: int = Field(description="Total number of pages.")

    @classmethod
    def from_page(cls, items: List[T], total: int, page: int, page_size: int) -> "PaginatedResponse[T]":
        """Convenience constructor that computes ``pages`` automatically."""
        import math

        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if page_size > 0 else 0,
        )

