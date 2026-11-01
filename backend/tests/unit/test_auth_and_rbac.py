"""Unit tests for DB-006 — JWT Authentication and RBAC (backend/app/dependencies.py)."""

import time
from unittest.mock import MagicMock, patch

import jwt
import pytest

from app.config import Settings
from app.core.errors import AuthenticationError, AuthorizationError
from app.dependencies import (
    CurrentUser,
    decode_supabase_jwt,
    get_current_user,
    require_role,
)


def _generate_test_jwt(sub: str = "user-123", email: str = "op@cyberhunt.io", role: str = "operator", exp_offset: int = 3600) -> str:
    """Generate an unsigned or HMAC test token with valid claims."""
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "user_metadata": {"role": role, "display_name": "Test Operator"},
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, "super-secret-key-that-is-at-least-32-bytes-long!", algorithm="HS256")


class TestJWTDecoding:
    def test_valid_token_decodes_claims(self):
        token = _generate_test_jwt(sub="u-42", email="test@cyberhunt.io")
        claims = decode_supabase_jwt(token)
        assert claims["sub"] == "u-42"
        assert claims["email"] == "test@cyberhunt.io"

    def test_expired_token_raises_authentication_error(self):
        token = _generate_test_jwt(exp_offset=-10)
        with pytest.raises(AuthenticationError, match="Token has expired"):
            decode_supabase_jwt(token)

    def test_malformed_token_raises_authentication_error(self):
        with pytest.raises(AuthenticationError, match="Invalid authorization token"):
            decode_supabase_jwt("not.a.valid.jwt")

    def test_empty_token_raises_authentication_error(self):
        with pytest.raises(AuthenticationError, match="missing"):
            decode_supabase_jwt("")


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_missing_credentials_raises_authentication_error(self):
        with pytest.raises(AuthenticationError, match="Authorization header is missing"):
            await get_current_user(credentials=None)

    @pytest.mark.asyncio
    async def test_resolves_current_user_from_token_metadata(self):
        token = _generate_test_jwt(sub="u-101", email="agent@cyberhunt.io", role="approver")
        credentials = MagicMock(credentials=token)

        settings = MagicMock()
        settings.has_supabase_service_role = False
        settings.supabase_anon_key = None

        user = await get_current_user(credentials=credentials, settings=settings)
        assert isinstance(user, CurrentUser)
        assert user.id == "u-101"
        assert user.email == "agent@cyberhunt.io"
        assert user.role == "approver"


class TestRBACGuards:
    def test_require_role_allows_matching_role(self):
        guard = require_role("admin", "approver")
        admin_user = CurrentUser(id="1", email="a@c.io", role="admin")

        allowed = guard(current_user=admin_user)
        assert allowed is admin_user

    def test_require_role_rejects_unauthorized_role(self):
        guard = require_role("admin")
        op_user = CurrentUser(id="2", email="op@c.io", role="operator")

        with pytest.raises(AuthorizationError, match="Access denied"):
            guard(current_user=op_user)

    def test_judge_restricted_from_admin_actions(self):
        admin_guard = require_role("admin")
        judge_user = CurrentUser(id="3", email="judge@c.io", role="judge")

        with pytest.raises(AuthorizationError):
            admin_guard(current_user=judge_user)

    def test_judge_allowed_on_judge_actions(self):
        judge_guard = require_role("judge", "admin")
        judge_user = CurrentUser(id="3", email="judge@c.io", role="judge")

        assert judge_guard(current_user=judge_user) is judge_user


class TestLocalDemoModeSafeguards:
    @pytest.mark.asyncio
    async def test_demo_mode_allows_localhost_socket(self):
        """When local_demo_mode is enabled in non-production, loopback socket gets demo operator."""
        settings = Settings(local_demo_mode=True, environment="development")
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"

        user = await get_current_user(request=mock_request, credentials=None, settings=settings)
        assert user.id == "00000000-0000-4000-8000-000000000001"
        assert user.role == "operator"
        assert user.email == "operator@cyberhunt.local"

    @pytest.mark.asyncio
    async def test_demo_mode_rejects_external_client_ip(self):
        """Even with demo_mode enabled, external client IPs are rejected with AuthenticationError."""
        settings = Settings(local_demo_mode=True, environment="development")
        mock_request = MagicMock()
        mock_request.client.host = "192.168.1.100"

        with pytest.raises(AuthenticationError, match="Authorization header is missing"):
            await get_current_user(request=mock_request, credentials=None, settings=settings)

    @pytest.mark.asyncio
    async def test_demo_mode_never_trusts_forwarded_for_header(self):
        """Spoofed X-Forwarded-For loopback headers are ignored; raw socket peer determines access."""
        settings = Settings(local_demo_mode=True, environment="development")
        mock_request = MagicMock()
        mock_request.client.host = "203.0.113.195"  # External peer IP
        mock_request.headers = {"x-forwarded-for": "127.0.0.1"}

        with pytest.raises(AuthenticationError, match="Authorization header is missing"):
            await get_current_user(request=mock_request, credentials=None, settings=settings)

    @pytest.mark.asyncio
    async def test_demo_mode_disabled_in_production(self):
        """Local demo mode is strictly prohibited and ignored in production."""
        settings = Settings(local_demo_mode=True, environment="production")
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"

        with pytest.raises(AuthenticationError, match="Authorization header is missing"):
            await get_current_user(request=mock_request, credentials=None, settings=settings)

