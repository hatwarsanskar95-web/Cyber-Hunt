"""Unit tests for DB-004 — Supabase Client Factory (backend/app/db/client.py)."""

from unittest.mock import MagicMock, patch

import pytest
from pydantic import SecretStr

from app.config import Settings
from app.core.errors import ConfigurationError, DatabaseError
from app.db.client import get_supabase_client, reset_supabase_client


@pytest.fixture(autouse=True)
def clean_client():
    reset_supabase_client()
    yield
    reset_supabase_client()


class TestSupabaseClientInit:
    def test_missing_url_raises_configuration_error(self):
        settings = Settings(supabase_url="", supabase_anon_key=None, supabase_service_role_key=None)
        with pytest.raises(ConfigurationError, match="Supabase URL"):
            get_supabase_client(settings)

    def test_missing_keys_raises_configuration_error(self):
        settings = Settings(
            supabase_url="https://example.supabase.co",
            supabase_anon_key=None,
            supabase_service_role_key=None,
        )
        with pytest.raises(ConfigurationError, match="Neither SUPABASE_SERVICE_ROLE_KEY"):
            get_supabase_client(settings)

    @patch("app.db.client.create_client")
    def test_successful_client_creation_with_service_role(self, mock_create):
        mock_instance = MagicMock()
        mock_create.return_value = mock_instance

        settings = Settings(
            supabase_url="https://test.supabase.co",
            supabase_service_role_key="service-secret-xyz",
        )
        client = get_supabase_client(settings)

        assert client is mock_instance
        mock_create.assert_called_once_with("https://test.supabase.co", "service-secret-xyz")

    @patch("app.db.client.create_client")
    def test_fallback_to_anon_key_when_service_role_missing(self, mock_create):
        mock_instance = MagicMock()
        mock_create.return_value = mock_instance

        settings = Settings(
            supabase_url="https://test.supabase.co",
            supabase_anon_key="anon-key-123",
            supabase_service_role_key=None,
        )
        client = get_supabase_client(settings)

        assert client is mock_instance
        mock_create.assert_called_once_with("https://test.supabase.co", "anon-key-123")

    @patch("app.db.client.create_client")
    def test_client_singleton_reuses_instance(self, mock_create):
        mock_instance = MagicMock()
        mock_create.return_value = mock_instance

        settings = Settings(
            supabase_url="https://test.supabase.co",
            supabase_anon_key="anon-key-123",
        )
        client1 = get_supabase_client(settings)
        client2 = get_supabase_client(settings)

        assert client1 is client2
        assert mock_create.call_count == 1

    @patch("app.db.client.create_client")
    def test_creation_exception_wrapped_in_database_error(self, mock_create):
        mock_create.side_effect = RuntimeError("Connection refused")

        settings = Settings(
            supabase_url="https://test.supabase.co",
            supabase_anon_key="anon-key-123",
        )
        with pytest.raises(DatabaseError, match="Failed to initialize Supabase client"):
            get_supabase_client(settings)

