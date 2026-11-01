"""Centralized Application Configuration for CYBER HUNT.

Uses Pydantic BaseSettings to load and validate environment variables with safe defaults.
Secrets are protected and never logged or exposed to the frontend.
"""

from functools import lru_cache
from typing import List, Literal, Optional
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable resolution and validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application Metadata
    app_name: str = Field(default="CYBER HUNT API", description="Application service name")
    app_version: str = Field(default="2.0.0", description="Backend API version")
    environment: Literal["development", "test", "production"] = Field(
        default="development", description="Operational environment"
    )
    log_level: str = Field(default="INFO", description="Structured logging level")

    # Primary Foundation Model (Google Gemini)
    gemini_api_key: Optional[SecretStr] = Field(
        default=None, description="Google Gemini API key (server-side only)"
    )
    gemini_model: str = Field(
        default="gemini-3.8-flash", description="Primary AI model identifier"
    )

    # Google OAuth 2.0 (Gmail Read-Only Integration)
    google_client_id: Optional[str] = Field(
        default=None, description="Google OAuth 2.0 Client ID"
    )
    google_client_secret: Optional[SecretStr] = Field(
        default=None, description="Google OAuth 2.0 Client Secret (server-side only)"
    )
    google_redirect_uri: str = Field(
        default="http://localhost:8001/api/v1/auth/gmail/callback",
        description="Google OAuth 2.0 Redirect URI",
    )
    google_pubsub_topic: Optional[str] = Field(
        default=None,
        description="Google Cloud Pub/Sub topic for Gmail push notifications (projects/{project}/topics/{topic})",
    )
    google_pubsub_verification_token: Optional[SecretStr] = Field(
        default=None,
        description="Secret verification token for Google Cloud Pub/Sub push webhook",
    )
    gmail_token_encryption_key: Optional[SecretStr] = Field(
        default=None,
        description="Secret key used to encrypt OAuth tokens at rest (auto-derived if not specified)",
    )

    # VirusTotal Threat Intelligence API (Optional)
    virustotal_api_key: Optional[SecretStr] = Field(
        default=None, description="VirusTotal v3 API key for dynamic URL & file scanning"
    )

    # Supabase Database & Auth
    supabase_url: str = Field(
        default="https://hdlczmhzbytvxetingjb.supabase.co",
        description="Supabase Project API URL",
    )
    supabase_anon_key: Optional[str] = Field(
        default=None, description="Supabase Anon / Publishable key"
    )
    supabase_service_role_key: Optional[SecretStr] = Field(
        default=None, description="Supabase Service-Role key (privileged server-side only)"
    )
    database_url: Optional[SecretStr] = Field(
        default=None, description="Direct PostgreSQL connection string"
    )

    # Open Policy Agent (OPA)
    opa_url: str = Field(
        default="http://localhost:8181", description="Open Policy Agent service endpoint"
    )

    # CORS & Frontend Origins
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed CORS origins for Next.js frontend",
    )
    next_public_api_url: str = Field(
        default="http://127.0.0.1:8001", description="Backend REST endpoint"
    )
    next_public_ws_url: str = Field(
        default="ws://127.0.0.1:8001/api/v1/ws",
        description="Backend WebSocket endpoint",
    )

    # Safety & Simulation Limits
    default_step_limit: int = Field(default=5, ge=1, le=20, description="Max steps per simulation")
    action_timeout_seconds: float = Field(default=30.0, ge=1.0, description="Per-action execution timeout")

    # Local Demo Mode (strictly restricted to loopback 127.0.0.1 in development)
    local_demo_mode: bool = Field(
        default=False,
        description="Enable unauthenticated demo operator context strictly for local development on 127.0.0.1",
    )

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"

    @property
    def has_gemini_key(self) -> bool:
        """Check if a Gemini API key is configured without exposing it."""
        return self.gemini_api_key is not None and len(self.gemini_api_key.get_secret_value()) > 0

    @property
    def has_supabase_service_role(self) -> bool:
        """Check if Supabase service role key is configured without exposing it."""
        return (
            self.supabase_service_role_key is not None
            and len(self.supabase_service_role_key.get_secret_value()) > 0
        )

    @property
    def has_google_oauth(self) -> bool:
        """Check if Google OAuth credentials are configured without exposing them."""
        return (
            self.google_client_id is not None
            and bool(self.google_client_id.strip())
            and self.google_client_secret is not None
            and bool(self.google_client_secret.get_secret_value().strip())
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton instance of application settings."""
    return Settings()

