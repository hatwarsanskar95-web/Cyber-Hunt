"""Google Gmail OAuth 2.0 and Inbound Email Service for CYBER HUNT.

Enforces:
1. Strict read-only scope (https://www.googleapis.com/auth/gmail.readonly).
2. Never sends, modifies, or deletes real emails.
3. Secure CSRF state generation and single-use validation.
4. Server-side token storage and automated refresh handling.
5. Ingestion into SimulationManager.inject_incoming_email() with untrusted sanitization.
"""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import secrets
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlencode

from cryptography.fernet import Fernet
import httpx
from pydantic import SecretStr

from app.config import Settings, get_settings
from app.core.errors import AuthenticationError, ConfigurationError
from app.schemas.gmail import (
    GMAIL_READONLY_SCOPE,
    EmailAttachment,
    GmailConnectResponse,
    GmailDisconnectResponse,
    GmailStatusResponse,
    IncomingEmailPayload,
)
from app.security.email_sanitizer import process_attachment, sanitize_text_content

log = logging.getLogger(__name__)

GOOGLE_AUTH_BASE_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL: str = "https://oauth2.googleapis.com/revoke"
GMAIL_API_BASE_URL: str = "https://gmail.googleapis.com/gmail/v1/users/me"

# Allowed scopes: read-only Gmail + optional userinfo for account identity display
ALLOWED_SCOPES: Set[str] = {
    GMAIL_READONLY_SCOPE,
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
}

# State validity duration (10 minutes)
STATE_TTL_SECONDS: int = 600

# Path to encrypted token store on disk
DEFAULT_TOKEN_FILE: Path = Path(__file__).resolve().parent.parent.parent / ".gmail_token.enc"


class GmailTokenData:
    """Internal server-side token store. Secrets are wrapped in SecretStr."""

    def __init__(
        self,
        access_token: SecretStr,
        refresh_token: Optional[SecretStr],
        expires_at: datetime,
        email: str,
        scopes: List[str],
    ) -> None:
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.email = email
        self.scopes = scopes

    @property
    def is_expired(self) -> bool:
        """Check if token is expired or expires within 60 seconds."""
        now = datetime.now(timezone.utc)
        return now >= (self.expires_at - timedelta(seconds=60))


class GmailService:
    """Centralized Google OAuth 2.0 and Gmail Read-Only Service."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        token_file: Optional[Path] = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._state_store: Dict[str, datetime] = {}
        self._state_redirect_uris: Dict[str, str] = {}
        self._token_data: Optional[GmailTokenData] = None
        self._token_file_path: Path = token_file or DEFAULT_TOKEN_FILE
        self._processed_message_ids: Set[str] = set()

        # Restore encrypted tokens from disk if present
        self._load_persisted_tokens()

    def _get_credentials(self) -> Tuple[str, str, str]:
        """Validate and return (client_id, client_secret, redirect_uri)."""
        client_id = self._settings.google_client_id
        secret_obj = self._settings.google_client_secret
        redirect_uri = self._settings.google_redirect_uri

        if not client_id or not client_id.strip():
            raise ConfigurationError("GOOGLE_CLIENT_ID is not configured in backend environment.")
        if not secret_obj or not secret_obj.get_secret_value().strip():
            raise ConfigurationError("GOOGLE_CLIENT_SECRET is not configured in backend environment.")
        if not redirect_uri or not redirect_uri.strip():
            raise ConfigurationError("GOOGLE_REDIRECT_URI is not configured in backend environment.")

        return client_id.strip(), secret_obj.get_secret_value().strip(), redirect_uri.strip()

    # -----------------------------------------------------------------------
    # 0. Encryption at Rest Helpers (Fernet AES-128-CBC)
    # -----------------------------------------------------------------------

    def _get_encryption_cipher(self) -> Fernet:
        """Derive deterministic Fernet key from encryption key or client secret."""
        if self._settings.gmail_token_encryption_key:
            raw_key = self._settings.gmail_token_encryption_key.get_secret_value()
        elif self._settings.google_client_secret:
            raw_key = self._settings.google_client_secret.get_secret_value()
        else:
            raw_key = "cyberhunt-fallback-secret-for-tokens"
        key = base64.urlsafe_b64encode(hashlib.sha256(raw_key.encode("utf-8")).digest())
        return Fernet(key)

    def _save_tokens_encrypted(self) -> None:
        """Encrypt and persist token data to local disk at rest."""
        if not self._token_data:
            return
        cipher = self._get_encryption_cipher()
        data = {
            "access_token": self._token_data.access_token.get_secret_value(),
            "refresh_token": (
                self._token_data.refresh_token.get_secret_value()
                if self._token_data.refresh_token
                else None
            ),
            "expires_at": self._token_data.expires_at.isoformat(),
            "email": self._token_data.email,
            "scopes": self._token_data.scopes,
        }
        json_bytes = json.dumps(data).encode("utf-8")
        encrypted_bytes = cipher.encrypt(json_bytes)
        try:
            self._token_file_path.write_bytes(encrypted_bytes)
            log.info("Securely saved encrypted Gmail token to %s", self._token_file_path.name)
        except Exception as exc:
            log.error("Failed to write encrypted token file: %s", exc)

    def _load_persisted_tokens(self) -> None:
        """Load and decrypt tokens from local storage on service startup."""
        if not self._token_file_path.exists():
            return
        try:
            cipher = self._get_encryption_cipher()
            encrypted_bytes = self._token_file_path.read_bytes()
            decrypted_bytes = cipher.decrypt(encrypted_bytes)
            data = json.loads(decrypted_bytes.decode("utf-8"))
            self._token_data = GmailTokenData(
                access_token=SecretStr(data["access_token"]),
                refresh_token=SecretStr(data["refresh_token"]) if data.get("refresh_token") else None,
                expires_at=datetime.fromisoformat(data["expires_at"]),
                email=data["email"],
                scopes=data.get("scopes", [GMAIL_READONLY_SCOPE]),
            )
            log.info("Successfully restored encrypted Gmail session for %s", data["email"])
        except Exception as exc:
            log.warning("Could not decrypt persisted Gmail token (session expired or invalid key): %s", exc)
            self._token_data = None

    # -----------------------------------------------------------------------
    # 1. State Management & Authorization URL
    # -----------------------------------------------------------------------

    def create_authorization_url(
        self, redirect_uri_override: Optional[str] = None
    ) -> GmailConnectResponse:
        """Generate secure CSRF state and return the Google OAuth consent screen URL."""
        client_id, _, default_redirect_uri = self._get_credentials()
        raw_uri = redirect_uri_override or default_redirect_uri
        redirect_uri = raw_uri.strip().rstrip("/")

        # Prune expired states
        now = datetime.now(timezone.utc)
        self._state_store = {
            s: exp for s, exp in self._state_store.items()
            if (now - exp).total_seconds() < STATE_TTL_SECONDS
        }
        self._state_redirect_uris = {
            s: uri for s, uri in self._state_redirect_uris.items()
            if s in self._state_store
        }

        # Generate cryptographically strong random state
        state = secrets.token_urlsafe(32)
        self._state_store[state] = now
        self._state_redirect_uris[state] = redirect_uri

        # Construct consent URL with offline access to receive refresh_token
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": f"{GMAIL_READONLY_SCOPE} https://www.googleapis.com/auth/userinfo.email",
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        auth_url = f"{GOOGLE_AUTH_BASE_URL}?{urlencode(params)}"
        log.info(
            "Generated Gmail OAuth authorization URL with state %s... and redirect_uri: %s",
            state[:8],
            redirect_uri,
        )
        return GmailConnectResponse(authorization_url=auth_url, state=state)

    def validate_and_consume_state(self, state: Optional[str]) -> bool:
        """Validate CSRF state token and consume it to prevent replay."""
        if not state or state not in self._state_store:
            log.warning("Invalid or unknown OAuth state received")
            return False

        created_at = self._state_store.pop(state)
        now = datetime.now(timezone.utc)
        if (now - created_at).total_seconds() > STATE_TTL_SECONDS:
            self._state_redirect_uris.pop(state, None)
            log.warning("Expired OAuth state token rejected (exceeded %ds TTL)", STATE_TTL_SECONDS)
            return False

        return True

    # -----------------------------------------------------------------------
    # 2. Authorization Code Exchange
    # -----------------------------------------------------------------------

    async def exchange_code_for_tokens(
        self,
        code: str,
        state: Optional[str] = None,
        redirect_uri_override: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> str:
        """Exchange authorization code with Google OAuth token endpoint.

        Returns connected email address. Never exposes raw tokens.
        """
        client_id, client_secret, default_redirect_uri = self._get_credentials()
        raw_uri = (
            redirect_uri_override
            or (self._state_redirect_uris.pop(state, None) if state else None)
            or default_redirect_uri
        )
        redirect_uri = raw_uri.strip().rstrip("/")

        token_payload = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }

        client = http_client or httpx.AsyncClient(timeout=15.0)
        try:
            resp = await client.post(GOOGLE_TOKEN_URL, data=token_payload)
            if resp.status_code != 200:
                log.error("Google OAuth token exchange failed: HTTP %d", resp.status_code)
                raise AuthenticationError(f"Google token exchange rejected: {resp.text}")

            token_json = resp.json()
            raw_access_token = token_json.get("access_token")
            raw_refresh_token = token_json.get("refresh_token")
            expires_in = int(token_json.get("expires_in", 3600))
            scope_str = token_json.get("scope", "")

            if not raw_access_token:
                raise AuthenticationError("Google token response did not contain access_token.")

            # Verify granted scope does NOT grant write/send access
            granted_scopes = [s.strip() for s in scope_str.split(" ") if s.strip()]
            self._validate_read_only_scopes(granted_scopes)

            # Retrieve account email from Gmail profile
            account_email = await self._fetch_account_email(raw_access_token, client)

            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            # Preserve existing refresh token if Google didn't return a new one on re-auth
            stored_refresh: Optional[SecretStr] = None
            if raw_refresh_token:
                stored_refresh = SecretStr(raw_refresh_token)
            elif self._token_data and self._token_data.refresh_token:
                stored_refresh = self._token_data.refresh_token

            self._token_data = GmailTokenData(
                access_token=SecretStr(raw_access_token),
                refresh_token=stored_refresh,
                expires_at=expires_at,
                email=account_email,
                scopes=granted_scopes,
            )

            # Persist encrypted tokens to disk at rest
            self._save_tokens_encrypted()

            log.info("Gmail account %s connected successfully in read-only mode", account_email)
            return account_email
        finally:
            if http_client is None:
                await client.aclose()

    def _validate_read_only_scopes(self, scopes: List[str]) -> None:
        """Enforce that no write or modifying scopes are active."""
        forbidden_keywords = ("send", "modify", "compose", "insert", "delete")
        for sc in scopes:
            lower = sc.lower()
            if any(kw in lower for kw in forbidden_keywords):
                log.error("Security violation: prohibited scope detected: %s", sc)
                raise AuthenticationError(
                    f"Security policy violation: granted scope '{sc}' exceeds read-only permission."
                )

    async def _fetch_account_email(
        self,
        access_token: str,
        client: httpx.AsyncClient,
    ) -> str:
        """Fetch user email from Gmail profile or userinfo endpoint."""
        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            profile_resp = await client.get(f"{GMAIL_API_BASE_URL}/profile", headers=headers)
            if profile_resp.status_code == 200:
                data = profile_resp.json()
                if "emailAddress" in data:
                    return data["emailAddress"]
        except Exception as exc:
            log.warning("Could not fetch email from Gmail profile endpoint: %s", exc)

        # Fallback to userinfo
        try:
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo", headers=headers
            )
            if userinfo_resp.status_code == 200:
                data = userinfo_resp.json()
                if "email" in data:
                    return data["email"]
        except Exception as exc:
            log.warning("Could not fetch email from userinfo endpoint: %s", exc)

        return "connected-user@gmail.com"

    # -----------------------------------------------------------------------
    # 3. Token Refresh Handling
    # -----------------------------------------------------------------------

    async def get_valid_access_token(
        self,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> str:
        """Retrieve valid access token, performing automated refresh if expired.

        Returns raw token for internal service HTTP calls only.
        """
        if not self._token_data:
            raise AuthenticationError("Gmail account is not connected.")

        if not self._token_data.is_expired:
            return self._token_data.access_token.get_secret_value()

        # Token is expired; attempt refresh
        if not self._token_data.refresh_token:
            raise AuthenticationError(
                "Gmail access token is expired and no refresh token is stored. Reconnection required."
            )

        client_id, client_secret, _ = self._get_credentials()
        refresh_payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": self._token_data.refresh_token.get_secret_value(),
            "grant_type": "refresh_token",
        }

        client = http_client or httpx.AsyncClient(timeout=15.0)
        try:
            resp = await client.post(GOOGLE_TOKEN_URL, data=refresh_payload)
            if resp.status_code != 200:
                log.error("Token refresh failed with status %d", resp.status_code)
                raise AuthenticationError("Failed to refresh expired Gmail access token.")

            data = resp.json()
            new_access_token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))

            if not new_access_token:
                raise AuthenticationError("Refresh response did not contain access_token.")

            self._token_data.access_token = SecretStr(new_access_token)
            self._token_data.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            # If a new refresh token was returned, update it
            if "refresh_token" in data:
                self._token_data.refresh_token = SecretStr(data["refresh_token"])

            # Persist refreshed tokens encrypted
            self._save_tokens_encrypted()

            log.info("Gmail access token refreshed successfully for %s", self._token_data.email)
            return new_access_token
        finally:
            if http_client is None:
                await client.aclose()

    # -----------------------------------------------------------------------
    # 4. Status & Disconnect
    # -----------------------------------------------------------------------

    def get_connection_status(self) -> GmailStatusResponse:
        """Return public connection status without exposing secrets."""
        if not self._token_data:
            return GmailStatusResponse(
                connected=False,
                email=None,
                scopes=[],
                expires_at=None,
                is_expired=False,
                message="No Gmail account connected",
            )

        return GmailStatusResponse(
            connected=True,
            email=self._token_data.email,
            scopes=self._token_data.scopes,
            expires_at=self._token_data.expires_at.isoformat(),
            is_expired=self._token_data.is_expired,
            message="Gmail account actively connected in read-only mode",
        )

    async def disconnect(
        self,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> GmailDisconnectResponse:
        """Revoke tokens with Google and clear internal token storage."""
        if not self._token_data:
            return GmailDisconnectResponse(
                status="disconnected",
                message="No active Gmail connection to disconnect",
            )

        token_to_revoke = (
            self._token_data.refresh_token.get_secret_value()
            if self._token_data.refresh_token
            else self._token_data.access_token.get_secret_value()
        )

        client = http_client or httpx.AsyncClient(timeout=10.0)
        try:
            revoke_resp = await client.post(
                GOOGLE_REVOKE_URL,
                params={"token": token_to_revoke},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            log.info("Google token revocation returned status %d", revoke_resp.status_code)
        except Exception as exc:
            log.warning("Non-fatal error contacting Google revocation endpoint: %s", exc)
        finally:
            self._token_data = None
            try:
                if self._token_file_path.exists():
                    self._token_file_path.unlink()
                    log.info("Encrypted Gmail token file deleted successfully")
            except Exception as exc:
                log.warning("Failed to delete encrypted token file: %s", exc)

            if http_client is None:
                await client.aclose()

        return GmailDisconnectResponse(
            status="disconnected",
            message="Gmail account disconnected and tokens revoked successfully",
        )

    # -----------------------------------------------------------------------
    # 5. Strict Read-Only Prohibition Guards
    # -----------------------------------------------------------------------

    def send_email(self, *args: Any, **kwargs: Any) -> None:
        """Prohibited by CYBER HUNT architecture."""
        raise PermissionError("Strict Read-Only Enforcement: Sending real emails is prohibited.")

    def delete_email(self, *args: Any, **kwargs: Any) -> None:
        """Prohibited by CYBER HUNT architecture."""
        raise PermissionError("Strict Read-Only Enforcement: Deleting real emails is prohibited.")

    def modify_email(self, *args: Any, **kwargs: Any) -> None:
        """Prohibited by CYBER HUNT architecture."""
        raise PermissionError("Strict Read-Only Enforcement: Modifying real emails is prohibited.")

    def reply_email(self, *args: Any, **kwargs: Any) -> None:
        """Prohibited by CYBER HUNT architecture."""
        raise PermissionError("Strict Read-Only Enforcement: Replying to real emails is prohibited.")

    # -----------------------------------------------------------------------
    # 6. Inbound Email Reading & Sanitization
    # -----------------------------------------------------------------------

    async def fetch_recent_emails(
        self,
        max_results: int = 10,
        query: str = "in:inbox",
        skip_duplicates: bool = False,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> List[IncomingEmailPayload]:
        """Fetch and sanitize recent inbox emails as untrusted payloads."""
        access_token = await self.get_valid_access_token(http_client)
        headers = {"Authorization": f"Bearer {access_token}"}

        client = http_client or httpx.AsyncClient(timeout=20.0)
        try:
            # 1. List messages
            list_url = f"{GMAIL_API_BASE_URL}/messages"
            params: Dict[str, Any] = {"maxResults": min(max_results, 20), "q": query}
            if "spam" in query.lower() or "trash" in query.lower():
                params["includeSpamTrash"] = True
            resp = await client.get(list_url, headers=headers, params=params)
            if resp.status_code != 200:
                log.error("Failed to list Gmail messages: %d %s", resp.status_code, resp.text)
                return []

            list_data = resp.json()
            message_stubs = list_data.get("messages", [])
            results: List[IncomingEmailPayload] = []

            for stub in message_stubs:
                msg_id = stub.get("id")
                if not msg_id:
                    continue

                if skip_duplicates and msg_id in self._processed_message_ids:
                    log.debug("Skipping already processed Gmail message %s", msg_id)
                    continue

                # Fetch full message
                msg_resp = await client.get(
                    f"{GMAIL_API_BASE_URL}/messages/{msg_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if msg_resp.status_code == 200:
                    parsed = self._parse_and_sanitize_message(msg_resp.json())
                    results.append(parsed)
                    self._processed_message_ids.add(msg_id)

            return results
        finally:
            if http_client is None:
                await client.aclose()

    async def seed_processed_message_ids(
        self,
        max_results: int = 25,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        """Seed the processed message set with currently existing messages in Gmail to avoid initial spam."""
        if not self._token_data:
            return
        try:
            access_token = await self.get_valid_access_token(http_client)
            headers = {"Authorization": f"Bearer {access_token}"}
            client = http_client or httpx.AsyncClient(timeout=10.0)
            try:
                list_resp = await client.get(
                    f"{GMAIL_API_BASE_URL}/messages",
                    headers=headers,
                    params={"maxResults": max_results, "q": "in:inbox"},
                )
                if list_resp.status_code == 200:
                    messages = list_resp.json().get("messages", [])
                    for m in messages:
                        mid = m.get("id")
                        if mid:
                            self._processed_message_ids.add(mid)
                    log.info("Seeded %d existing message IDs to avoid false duplicate alerts on startup", len(messages))
            finally:
                if http_client is None:
                    await client.aclose()
        except Exception as exc:
            log.warning("Could not seed initial message IDs: %s", exc)

    # -----------------------------------------------------------------------
    # 7. Google Cloud Pub/Sub Watch & Push Processing
    # -----------------------------------------------------------------------

    async def setup_watch(
        self,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> Dict[str, Any]:
        """Register Gmail watch for Google Cloud Pub/Sub push notifications."""
        if not self._settings.google_pubsub_topic or not self._settings.google_pubsub_topic.strip():
            return {
                "pubsub_configured": False,
                "history_id": None,
                "expiration": None,
                "message": (
                    "GOOGLE_PUBSUB_TOPIC is not configured in backend environment. "
                    "Push notifications require: 1) GCP Pub/Sub Topic, 2) Granting gmail-api-push@system.gserviceaccount.com publish rights, "
                    "3) Setting GOOGLE_PUBSUB_TOPIC=projects/{project}/topics/{topic} in your backend .env."
                ),
            }

        access_token = await self.get_valid_access_token(http_client)
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        payload = {
            "topicName": self._settings.google_pubsub_topic.strip(),
            "labelIds": ["INBOX"],
        }
        client = http_client or httpx.AsyncClient(timeout=15.0)
        try:
            resp = await client.post(
                f"{GMAIL_API_BASE_URL}/watch",
                headers=headers,
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                log.info("Gmail watch established successfully: historyId=%s", data.get("historyId"))
                return {
                    "pubsub_configured": True,
                    "history_id": str(data.get("historyId")),
                    "expiration": str(data.get("expiration")),
                    "message": "Gmail watch successfully activated with Google Cloud Pub/Sub.",
                }
            else:
                log.error("Failed to setup Gmail watch: %d %s", resp.status_code, resp.text)
                return {
                    "pubsub_configured": False,
                    "history_id": None,
                    "expiration": None,
                    "message": f"Gmail watch request failed ({resp.status_code}): {resp.text}",
                }
        finally:
            if http_client is None:
                await client.aclose()

    async def process_pubsub_push(
        self,
        raw_b64_data: str,
        simulation_id: Optional[str] = None,
        manager: Optional[Any] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> List[Dict[str, Any]]:
        """Decode Pub/Sub push message, fetch new incoming emails, and inject into simulation."""
        try:
            decoded_json = base64.b64decode(raw_b64_data).decode("utf-8")
            data = json.loads(decoded_json)
            email_addr = data.get("emailAddress")
            history_id = data.get("historyId")
            log.info("Received Pub/Sub push notification for %s, historyId=%s", email_addr, history_id)
        except Exception as exc:
            log.warning("Invalid Pub/Sub base64 payload: %s", exc)
            return []

        # Fetch recent inbox messages skipping already processed IDs
        emails = await self.fetch_recent_emails(
            max_results=5,
            skip_duplicates=True,
            http_client=http_client,
        )
        injected = []
        if simulation_id and manager and emails:
            for em in emails:
                email_dict = {
                    "id": em.id,
                    "from": em.from_address,
                    "to": em.to_address,
                    "subject": em.subject,
                    "body": em.body_text,
                    "snippet": em.snippet,
                    "attachments": [att.model_dump() for att in em.attachments],
                    "received_at": em.received_at,
                    "is_untrusted": True,
                }
                res = await manager.inject_incoming_email(simulation_id, email_dict)
                injected.append(res)
        return injected

    def _parse_and_sanitize_message(self, raw_msg: Dict[str, Any]) -> IncomingEmailPayload:
        """Parse raw Gmail API message JSON into a sanitized untrusted payload."""
        msg_id = raw_msg.get("id", "unknown-id")
        thread_id = raw_msg.get("threadId")
        snippet = sanitize_text_content(raw_msg.get("snippet", ""))

        payload = raw_msg.get("payload", {})
        headers_list = payload.get("headers", [])

        from_addr = "unknown@example.com"
        to_addr = None
        subject = "(no subject)"
        date_str = datetime.now(timezone.utc).isoformat()

        for h in headers_list:
            name = h.get("name", "").lower()
            val = h.get("value", "")
            if name == "from":
                from_addr = val
            elif name == "to":
                to_addr = val
            elif name == "subject":
                subject = val
            elif name == "date":
                date_str = val

        # Extract body text and attachments from MIME parts
        body_parts: List[str] = []
        attachments: List[EmailAttachment] = []

        self._extract_mime_parts(payload, body_parts, attachments)

        combined_body = "\n\n".join(body_parts).strip()
        if not combined_body and snippet:
            combined_body = snippet

        # Pre-scan threat evaluation for incoming email
        from app.security.email_analyzer import analyze_email_threat
        pre_scan = analyze_email_threat({
            "from": from_addr,
            "to": to_addr,
            "subject": subject,
            "body": combined_body,
            "snippet": snippet,
            "attachments": attachments,
        })
        is_suspicious = (pre_scan.risk_score >= 30)

        return IncomingEmailPayload(
            id=msg_id,
            thread_id=thread_id,
            from_address=from_addr,
            to_address=to_addr,
            subject=subject,
            body_text=combined_body,
            snippet=snippet,
            attachments=attachments,
            received_at=date_str,
            is_untrusted=is_suspicious,
            status_tag="Not Analyzed",
            risk_score=pre_scan.risk_score,
        )

    def _extract_mime_parts(
        self,
        part: Dict[str, Any],
        body_parts: List[str],
        attachments: List[EmailAttachment],
    ) -> None:
        """Recursively walk MIME structure to extract safe text bodies and attachments."""
        mime_type = part.get("mimeType", "")
        filename = part.get("filename", "")
        body = part.get("body", {})
        data_base64 = body.get("data")

        # 1. Plain text or HTML body
        if mime_type == "text/plain" and data_base64 and not filename:
            decoded = self._decode_base64url(data_base64)
            body_parts.append(sanitize_text_content(decoded, is_html=False))

        elif mime_type == "text/html" and data_base64 and not filename and not body_parts:
            # Only use HTML if plain text not already found
            decoded = self._decode_base64url(data_base64)
            body_parts.append(sanitize_text_content(decoded, is_html=True))

        # 2. Attachments
        elif filename:
            raw_bytes = b""
            if data_base64:
                try:
                    raw_bytes = base64.urlsafe_b64decode(data_base64.encode("utf-8"))
                except Exception:
                    raw_bytes = b""

            att = process_attachment(filename, mime_type, raw_bytes)
            attachments.append(att)

        # 3. Multipart children
        for sub_part in part.get("parts", []):
            self._extract_mime_parts(sub_part, body_parts, attachments)

    @staticmethod
    def _decode_base64url(encoded_str: str) -> str:
        """Decode base64url data safely into a string."""
        try:
            # Fix padding
            padding = 4 - (len(encoded_str) % 4)
            if padding != 4:
                encoded_str += "=" * padding
            raw = base64.urlsafe_b64decode(encoded_str.encode("utf-8"))
            return raw.decode("utf-8", errors="replace")
        except Exception:
            return ""


# Global singleton instance
_gmail_service: Optional[GmailService] = None


def get_gmail_service(settings: Optional[Settings] = None) -> GmailService:
    """Return the cached singleton instance of GmailService."""
    global _gmail_service
    if _gmail_service is None:
        _gmail_service = GmailService(settings)
    return _gmail_service

