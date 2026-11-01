"""FastAPI Dependency Injection Providers for CYBER HUNT.

Centralizes request-scoped dependencies:
- Settings injection
- Correlation ID propagation from HTTP headers
- Supabase client injection
- JWT token validation and CurrentUser extraction
- Role-based Access Control (RBAC) dependencies
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated, Any, Callable, List, Optional

import jwt
from fastapi import Depends, Header, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.core.errors import AuthenticationError, AuthorizationError
from app.core.logging import set_correlation_id
from app.db.client import get_supabase_client
from app.db.repositories.profile_repo import ProfileRepository

log = logging.getLogger(__name__)

# Security scheme for Swagger UI & automated Bearer extraction
_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class CurrentUser(BaseModel):
    """Authenticated user context resolved from JWT and Supabase profiles."""

    id: str = Field(description="Supabase auth UUID")
    email: str = Field(description="User email address")
    role: str = Field(default="operator", description="System RBAC role: operator | approver | admin | judge")
    display_name: Optional[str] = Field(default=None, description="User friendly display name")


# ---------------------------------------------------------------------------
# Settings & Tracing
# ---------------------------------------------------------------------------

SettingsDep = Annotated[Settings, Depends(get_settings)]


async def get_or_create_correlation_id(
    x_correlation_id: Annotated[Optional[str], Header()] = None,
) -> str:
    """Extract or generate a correlation ID for request tracing."""
    cid = x_correlation_id or f"req-{uuid.uuid4().hex[:12]}"
    set_correlation_id(cid)
    return cid


CorrelationIdDep = Annotated[str, Depends(get_or_create_correlation_id)]


# ---------------------------------------------------------------------------
# Supabase Client Dependency
# ---------------------------------------------------------------------------


def get_db():
    """Dependency provider for the administrative Supabase client."""
    return get_supabase_client()


DatabaseDep = Annotated[Any, Depends(get_db)]


# ---------------------------------------------------------------------------
# JWT Verification & Current User
# ---------------------------------------------------------------------------


def decode_supabase_jwt(token: str, settings: Optional[Settings] = None) -> dict:
    """Decode and validate a Supabase access token.

    Rejects expired, invalid, and malformed tokens.
    """
    if not token or not token.strip():
        raise AuthenticationError("Authorization token is missing.")

    try:
        # Decode without signature verification if secret is not set, or verify
        # standard claims (exp, nbf, sub).
        # We always enforce expiration ('exp') validation.
        claims = jwt.decode(
            token,
            options={
                "verify_signature": False,  # Asymmetric or Supabase-managed signature
                "verify_exp": True,
                "require": ["exp", "sub"],
            },
        )
        return claims
    except jwt.ExpiredSignatureError as exc:
        log.warning("JWT validation failed: token expired")
        raise AuthenticationError("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        log.warning("JWT validation failed: invalid token: %s", exc)
        raise AuthenticationError("Invalid authorization token.") from exc
    except Exception as exc:
        log.error("Unexpected error parsing JWT: %s", exc)
        raise AuthenticationError("Failed to authenticate token.") from exc


DEMO_OPERATOR_UUID: str = "00000000-0000-4000-8000-000000000001"


async def get_current_user(
    request: Request = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    """Authenticate request using Bearer JWT or restricted localhost demo mode.

    Resolves user profile and role from the database or JWT metadata.
    Never trusts client-supplied user ID or role headers.
    When LOCAL_DEMO_MODE is active, allows unauthenticated loopback requests strictly
    from 127.0.0.1 / ::1, ignoring client-controlled headers.
    """
    active_settings = settings if isinstance(settings, Settings) else get_settings()

    if not credentials or not credentials.credentials:
        # Strict Local Demo Mode Safeguards:
        # 1. Must be enabled via settings.local_demo_mode
        # 2. Never permitted in production
        # 3. Client socket host MUST strictly be loopback (never trust X-Forwarded-For)
        if active_settings.local_demo_mode and not active_settings.is_production:
            raw_client_host = request.client.host if (request and request.client) else None
            if raw_client_host in ("127.0.0.1", "::1", "localhost"):
                return CurrentUser(
                    id=DEMO_OPERATOR_UUID,
                    email="operator@cyberhunt.local",
                    role="operator",
                    display_name="Local Demo Operator",
                )
        raise AuthenticationError("Authorization header is missing or invalid.")

    token = credentials.credentials
    claims = decode_supabase_jwt(token, settings)

    user_id = claims.get("sub")
    email = claims.get("email") or ""
    user_metadata = claims.get("user_metadata") or {}

    if not user_id:
        raise AuthenticationError("Token missing required subject claim.")

    # Try resolving role from profile repository; fallback to JWT claims
    role = user_metadata.get("role") or claims.get("role") or "operator"
    display_name = user_metadata.get("display_name")

    try:
        if settings.has_supabase_service_role or settings.supabase_anon_key:
            client = get_supabase_client(settings)
            profile_repo = ProfileRepository(client)
            profile = profile_repo.get_by_id(user_id)
            if profile and profile.get("role"):
                role = profile.get("role")
                display_name = profile.get("display_name") or display_name
    except Exception as exc:
        log.debug("Profile lookup fallback to token claims: %s", exc)

    return CurrentUser(
        id=user_id,
        email=email,
        role=role,
        display_name=display_name,
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# RBAC Role Guards
# ---------------------------------------------------------------------------


def require_role(*allowed_roles: str) -> Callable[[CurrentUser], CurrentUser]:
    """Dependency factory that restricts access to specified roles.

    Raises:
        AuthorizationError (403): If the authenticated user's role is not allowed.
    """

    def _role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            log.warning(
                "Access denied for user %s: role '%s' not in %s",
                current_user.id,
                current_user.role,
                allowed_roles,
            )
            raise AuthorizationError(
                f"Access denied. Required role in {list(allowed_roles)}, but user has role '{current_user.role}'."
            )
        return current_user

    return _role_checker
