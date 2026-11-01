"""Unit tests for BE-006 — Common Pydantic Models (backend/app/schemas/common.py)."""

import math

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.schemas.common import (
    ErrorDetail,
    ErrorResponse,
    HealthStatus,
    PaginatedResponse,
    PaginationParams,
    PolicyDecisionEnum,
    SimulationState,
    SuccessResponse,
    ThreatSeverity,
)


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class TestSimulationState:
    def test_all_states_defined(self):
        expected = {
            "CREATED", "INITIALIZING", "RUNNING", "ANALYSING",
            "AWAITING_APPROVAL", "PAUSED", "COMPLETED", "FAILED", "CANCELLED",
        }
        actual = {s.value for s in SimulationState}
        assert actual == expected

    def test_is_string_enum(self):
        assert isinstance(SimulationState.RUNNING, str)
        assert SimulationState.RUNNING == "RUNNING"


class TestThreatSeverity:
    def test_all_severities_defined(self):
        assert {s.value for s in ThreatSeverity} == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

    def test_is_string_enum(self):
        assert isinstance(ThreatSeverity.CRITICAL, str)


class TestPolicyDecisionEnum:
    def test_all_decisions_defined(self):
        assert {d.value for d in PolicyDecisionEnum} == {"ALLOW", "BLOCK", "REQUIRE_APPROVAL"}


# ---------------------------------------------------------------------------
# SuccessResponse
# ---------------------------------------------------------------------------


class TestSuccessResponse:
    def test_default_status(self):
        r = SuccessResponse(data={"id": 1})
        assert r.status == "success"

    def test_data_preserved(self):
        r = SuccessResponse(data={"key": "value"})
        assert r.data == {"key": "value"}

    def test_message_optional(self):
        r = SuccessResponse(data=None)
        assert r.message is None

    def test_message_set(self):
        r = SuccessResponse(data={}, message="Done!")
        assert r.message == "Done!"


# ---------------------------------------------------------------------------
# ErrorDetail and ErrorResponse
# ---------------------------------------------------------------------------


class TestErrorDetail:
    def test_required_fields(self):
        d = ErrorDetail(code="AGENT_EXECUTION_ERROR", message="Agent crashed.")
        assert d.code == "AGENT_EXECUTION_ERROR"
        assert d.message == "Agent crashed."
        assert d.details is None

    def test_details_field(self):
        d = ErrorDetail(code="X", message="Y", details={"step": 3})
        assert d.details == {"step": 3}


class TestErrorResponse:
    def test_default_status(self):
        r = ErrorResponse(error=ErrorDetail(code="C", message="M"))
        assert r.status == "error"

    def test_error_field(self):
        detail = ErrorDetail(code="DB_ERROR", message="Database unreachable.")
        r = ErrorResponse(error=detail)
        assert r.error.code == "DB_ERROR"


# ---------------------------------------------------------------------------
# HealthStatus
# ---------------------------------------------------------------------------


class TestHealthStatus:
    def test_construction(self):
        h = HealthStatus(
            status="healthy",
            service="CYBER HUNT API",
            version="2.0.0",
            checks={"supabase": "healthy", "opa": "healthy", "gemini": "configured"},
        )
        assert h.status == "healthy"
        assert h.checks["gemini"] == "configured"


# ---------------------------------------------------------------------------
# PaginationParams
# ---------------------------------------------------------------------------


class TestPaginationParams:
    def test_defaults(self):
        p = PaginationParams()
        assert p.page == 1
        assert p.page_size == 20

    def test_offset_first_page(self):
        p = PaginationParams(page=1, page_size=20)
        assert p.offset == 0

    def test_offset_second_page(self):
        p = PaginationParams(page=2, page_size=10)
        assert p.offset == 10

    def test_limit_alias(self):
        p = PaginationParams(page=1, page_size=50)
        assert p.limit == 50

    def test_page_must_be_ge_1(self):
        with pytest.raises(PydanticValidationError):
            PaginationParams(page=0)

    def test_page_size_must_be_ge_1(self):
        with pytest.raises(PydanticValidationError):
            PaginationParams(page_size=0)

    def test_page_size_must_be_le_100(self):
        with pytest.raises(PydanticValidationError):
            PaginationParams(page_size=101)

    def test_page_size_100_is_valid(self):
        p = PaginationParams(page_size=100)
        assert p.page_size == 100


# ---------------------------------------------------------------------------
# PaginatedResponse
# ---------------------------------------------------------------------------


class TestPaginatedResponse:
    def test_from_page_computes_pages(self):
        items = list(range(5))
        r = PaginatedResponse[int].from_page(items=items, total=47, page=1, page_size=5)
        assert r.pages == math.ceil(47 / 5)  # 10
        assert r.total == 47
        assert r.items == items

    def test_single_page(self):
        r = PaginatedResponse[str].from_page(items=["a", "b"], total=2, page=1, page_size=10)
        assert r.pages == 1

    def test_exact_multiple(self):
        r = PaginatedResponse[str].from_page(items=[], total=20, page=1, page_size=10)
        assert r.pages == 2

    def test_zero_total(self):
        r = PaginatedResponse[str].from_page(items=[], total=0, page=1, page_size=10)
        assert r.pages == 0

    def test_generic_type_preserved(self):
        r = PaginatedResponse[dict].from_page(
            items=[{"id": 1}, {"id": 2}], total=2, page=1, page_size=10
        )
        assert r.items[0]["id"] == 1

