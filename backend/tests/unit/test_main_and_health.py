"""Unit tests for BE-004 — FastAPI Application Factory (backend/app/main.py)
and BE-005 — Health Check Endpoint (GET /api/v1/health).

NOTE: All external HTTP calls (Supabase, OPA) are mocked so these tests run
fully offline in any environment.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Module-level autouse patch — intercept every httpx.AsyncClient call
# so no real network connections are attempted.
# ---------------------------------------------------------------------------


def _make_mock_http_client(status_code: int = 200):
    """Return a properly-configured mock for httpx.AsyncClient context manager."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=mock_resp)
    return mock_client


@pytest.fixture(autouse=True, scope="module")
def mock_httpx():
    """Patch httpx.AsyncClient for the entire test module."""
    with patch("app.api.v1.health.httpx.AsyncClient", return_value=_make_mock_http_client(200)):
        yield


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def client(mock_httpx):
    """Return a TestClient for the real CYBER HUNT app (no .env required)."""
    from app.main import app

    return TestClient(app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# BE-004 — Application Factory
# ---------------------------------------------------------------------------


class TestApplicationFactory:
    def test_app_import_does_not_crash(self):
        from app.main import app

        assert app is not None

    def test_app_title(self):
        from app.main import app

        assert "CYBER HUNT" in app.title

    def test_app_version(self):
        from app.main import app

        assert app.version == "2.0.0"

    def test_cors_header_for_localhost_3000(self, client):
        """CORS preflight for http://localhost:3000 must succeed."""
        r = client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        # 200 or 204 both indicate the preflight was accepted
        assert r.status_code in (200, 204)
        assert "access-control-allow-origin" in r.headers

    def test_cors_origin_header_in_response(self, client):
        r = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
        assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_correlation_id_generated_and_returned(self, client):
        """Responses should return an X-Correlation-ID header."""
        r = client.get("/api/v1/health")
        assert "x-correlation-id" in r.headers
        assert r.headers["x-correlation-id"].startswith("req-")

    def test_custom_correlation_id_echoed(self, client):
        """Client-provided X-Correlation-ID should be echoed back."""
        r = client.get("/api/v1/health", headers={"X-Correlation-ID": "custom-trace-999"})
        assert r.headers.get("x-correlation-id") == "custom-trace-999"


# ---------------------------------------------------------------------------
# BE-005 — Health Check Endpoint
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        r = client.get("/api/v1/health")
        assert r.status_code == 200

    def test_health_response_shape(self, client):
        r = client.get("/api/v1/health")
        body = r.json()
        assert "status" in body
        assert "service" in body
        assert "version" in body
        assert "checks" in body

    def test_health_checks_keys_present(self, client):
        r = client.get("/api/v1/health")
        checks = r.json()["checks"]
        assert "supabase" in checks
        assert "opa" in checks
        assert "gemini" in checks

    def test_gemini_unconfigured_when_no_key(self, client):
        """In the test environment (no .env) Gemini must show 'unconfigured'."""
        r = client.get("/api/v1/health")
        # Only assert if no key is configured
        from app.config import get_settings

        s = get_settings()
        if not s.has_gemini_key:
            assert r.json()["checks"]["gemini"] == "unconfigured"

    def test_health_no_credentials_in_response(self, client):
        """The health response must never include API keys or secrets."""
        r = client.get("/api/v1/health")
        text = r.text.lower()
        for keyword in ("api_key", "secret", "password", "service_role"):
            assert keyword not in text, f"Potential secret keyword '{keyword}' found in health response"

    def test_service_name_matches_config(self, client):
        from app.config import get_settings

        r = client.get("/api/v1/health")
        assert r.json()["service"] == get_settings().app_name

    def test_version_matches_config(self, client):
        from app.config import get_settings

        r = client.get("/api/v1/health")
        assert r.json()["version"] == get_settings().app_version

    def test_status_is_valid_value(self, client):
        r = client.get("/api/v1/health")
        assert r.json()["status"] in ("healthy", "degraded", "unhealthy")


class TestHealthEndpointMocked:
    """Additional health check coverage with controlled mock responses."""

    def test_supabase_check_present(self, client):
        """Supabase check must appear in the checks dict (mocked as healthy via autouse)."""
        r = client.get("/api/v1/health")
        assert "supabase" in r.json()["checks"]

    def test_opa_check_present(self, client):
        """OPA check must appear in the checks dict (mocked as healthy via autouse)."""
        r = client.get("/api/v1/health")
        assert "opa" in r.json()["checks"]

    def test_response_is_json(self, client):
        r = client.get("/api/v1/health")
        # Should not raise
        assert isinstance(r.json(), dict)
