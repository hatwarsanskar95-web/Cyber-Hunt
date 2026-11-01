"""Unit tests for BE-001 — Centralized Settings Management (backend/app/config.py)."""

import pytest
from pydantic import SecretStr


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings(**overrides):
    """Return a fresh (uncached) Settings instance with the given env overrides."""
    from app.config import Settings

    return Settings(_env_file=None, **overrides)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSettingsDefaults:
    """Settings should load successfully with default values when no .env is present."""

    def test_loads_with_defaults(self):
        s = _make_settings()
        assert s.app_name == "CYBER HUNT API"
        assert s.app_version == "2.0.0"
        assert s.environment == "development"
        assert s.log_level == "INFO"

    def test_gemini_model_default(self):
        s = _make_settings()
        assert s.gemini_model == "gemini-3.8-flash"

    def test_supabase_url_default(self):
        s = _make_settings()
        assert "supabase.co" in s.supabase_url

    def test_opa_url_default(self):
        s = _make_settings()
        assert s.opa_url == "http://localhost:8181"

    def test_cors_origins_default(self):
        s = _make_settings()
        assert "http://localhost:3000" in s.cors_origins

    def test_step_limit_default(self):
        s = _make_settings()
        assert 1 <= s.default_step_limit <= 20


class TestOptionalSecrets:
    """Missing optional secrets must not cause crashes."""

    def test_missing_gemini_key_does_not_crash(self):
        s = _make_settings()
        # gemini_api_key is Optional — should be None when not supplied
        assert s.gemini_api_key is None

    def test_missing_supabase_service_role_does_not_crash(self):
        s = _make_settings()
        assert s.supabase_service_role_key is None

    def test_missing_database_url_does_not_crash(self):
        s = _make_settings()
        assert s.database_url is None


class TestHasGeminiKey:
    """has_gemini_key property should reflect key presence without exposing the value."""

    def test_false_when_no_key(self):
        s = _make_settings()
        assert s.has_gemini_key is False

    def test_true_when_key_provided(self):
        s = _make_settings(gemini_api_key="test-key-abc123")
        assert s.has_gemini_key is True

    def test_false_when_empty_string(self):
        # An empty SecretStr should count as "not configured"
        s = _make_settings(gemini_api_key="")
        assert s.has_gemini_key is False


class TestSecretStrNotExposed:
    """SecretStr fields must not leak their values through model_dump or repr."""

    def test_gemini_key_not_in_model_dump(self):
        s = _make_settings(gemini_api_key="super-secret-key")
        dumped = s.model_dump()
        # The dict value should be a SecretStr object (or None), NOT a plain string
        key_val = dumped.get("gemini_api_key")
        assert key_val is not None
        assert not isinstance(key_val, str), (
            "SecretStr must not be serialised to a plain string in model_dump()"
        )

    def test_gemini_key_repr_redacted(self):
        s = _make_settings(gemini_api_key="super-secret-key")
        r = repr(s.gemini_api_key)
        assert "super-secret-key" not in r

    def test_service_role_key_repr_redacted(self):
        s = _make_settings(supabase_service_role_key="service-role-value")
        r = repr(s.supabase_service_role_key)
        assert "service-role-value" not in r


class TestIsProduction:
    """is_production property should only be True when environment == 'production'."""

    def test_false_in_development(self):
        s = _make_settings(environment="development")
        assert s.is_production is False

    def test_false_in_test(self):
        s = _make_settings(environment="test")
        assert s.is_production is False

    def test_true_in_production(self):
        s = _make_settings(environment="production")
        assert s.is_production is True


class TestGetSettingsSingleton:
    """get_settings() should return the same cached instance on repeated calls."""

    def test_singleton(self):
        from app.config import get_settings

        a = get_settings()
        b = get_settings()
        assert a is b, "get_settings() should return the same cached instance"

