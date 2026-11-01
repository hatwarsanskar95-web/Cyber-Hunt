"""FastAPI Routes for Google Gmail OAuth 2.0 and Inbound Email Sync.

Provides:
- GET  /api/v1/auth/gmail/connect     Initiate OAuth connection
- GET  /api/v1/auth/gmail/callback    Handle OAuth callback and code exchange
- GET  /api/v1/auth/gmail/status      Query read-only connection status
- POST /api/v1/auth/gmail/disconnect  Disconnect and revoke tokens
- POST /api/v1/auth/gmail/sync        Sync incoming emails into a simulation run
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse

from app.core.errors import AuthenticationError
from app.orchestration.manager import SimulationManager, get_simulation_manager
from app.schemas.gmail import (
    GmailCallbackResponse,
    GmailConnectResponse,
    GmailDisconnectResponse,
    GmailMessagesResponse,
    GmailPubSubPushPayload,
    GmailStatusResponse,
    GmailSyncRequest,
    GmailSyncResponse,
    GmailWatchResponse,
    IncomingEmailPayload,
)
from app.security.gmail_service import GmailService, get_gmail_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/gmail", tags=["Gmail OAuth"])


# ---------------------------------------------------------------------------
# 1. Initiate OAuth Connection
# ---------------------------------------------------------------------------

@router.get(
    "/connect",
    response_model=GmailConnectResponse,
    summary="Initiate Gmail OAuth connection",
    description="Generates CSRF state and Google OAuth consent screen URL requesting gmail.readonly.",
)
async def connect_gmail(
    redirect: bool = Query(
        default=False,
        description="If true, immediately issues an HTTP 307 redirect to Google's consent screen",
    ),
    redirect_uri: Optional[str] = Query(
        default=None,
        description="Optional redirect_uri override to match Google Cloud Console",
    ),
    service: GmailService = Depends(get_gmail_service),
) -> Any:
    """Generate OAuth consent screen URL and CSRF state token."""
    try:
        connect_data = service.create_authorization_url(redirect_uri_override=redirect_uri)
        if redirect:
            return RedirectResponse(
                url=connect_data.authorization_url,
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            )
        return connect_data
    except Exception as exc:
        log.error("Failed to generate Gmail OAuth URL: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# 2. OAuth Callback
# ---------------------------------------------------------------------------

@router.get(
    "/callback",
    summary="Handle Google OAuth callback",
    description="Validates state CSRF token and exchanges authorization code for server-side tokens.",
)
async def gmail_callback(
    request: Request,
    code: Optional[str] = Query(default=None, description="Google authorization code"),
    state: Optional[str] = Query(default=None, description="Cryptographic CSRF state token"),
    error: Optional[str] = Query(default=None, description="Error reported by Google OAuth"),
    format: Optional[str] = Query(default=None, description="Set 'json' for JSON response"),
    service: GmailService = Depends(get_gmail_service),
) -> Any:
    """Handle callback from Google OAuth."""
    if error:
        log.warning("Google OAuth authorization denied or failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth error: {error}",
        )

    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required 'code' or 'state' parameters.",
        )

    # Validate CSRF state
    if not service.validate_and_consume_state(state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state token.",
        )

    try:
        email = await service.exchange_code_for_tokens(code, state=state)
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    except Exception as exc:
        log.error("Unexpected error during OAuth token exchange: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token exchange failed: {exc}",
        )

    accept_header = request.headers.get("accept", "")
    if format == "json" or "application/json" in accept_header:
        return GmailCallbackResponse(
            connected=True,
            email=email,
            message="Gmail account connected successfully in read-only mode",
        )

    # Return interactive completion HTML that notifies opener and closes popup
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CYBER HUNT — Gmail Connected</title>
  <style>
    body {{
      background-color: #0a0d14;
      color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }}
    .card {{
      background: #111827;
      border: 1px solid #1f2937;
      padding: 2.5rem;
      border-radius: 1rem;
      text-align: center;
      max-width: 420px;
      box-shadow: 0 0 25px rgba(124, 58, 237, 0.3);
    }}
    .icon {{
      width: 50px;
      height: 50px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
      color: #10b981;
      font-size: 1.5rem;
      font-weight: bold;
    }}
    h2 {{
      color: #f9fafb;
      margin: 0 0 0.5rem;
      font-size: 1.3rem;
    }}
    p.email {{
      color: #a855f7;
      font-weight: 600;
      font-size: 1rem;
      margin: 0.5rem 0 1rem;
    }}
    p.msg {{
      color: #9ca3af;
      font-size: 0.85rem;
      margin: 0;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>Gmail Account Connected</h2>
    <p class="email">{email}</p>
    <p class="msg">Read-only connection active. Returning to dashboard...</p>
  </div>
  <script>
    try {{
      if (window.opener) {{
        window.opener.postMessage({{ type: "GMAIL_CONNECTED", email: "{email}" }}, "*");
        setTimeout(() => window.close(), 1200);
      }} else {{
        setTimeout(() => {{ window.location.href = "http://localhost:3000/dashboard?gmail=connected"; }}, 1200);
      }}
    }} catch(e) {{
      setTimeout(() => {{ window.location.href = "http://localhost:3000/dashboard?gmail=connected"; }}, 1200);
    }}
  </script>
</body>
</html>"""
    return HTMLResponse(content=html_content, status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# 3. Connection Status
# ---------------------------------------------------------------------------

@router.get(
    "/status",
    response_model=GmailStatusResponse,
    summary="Get Gmail connection status",
    description="Reports whether Gmail is connected in read-only mode. Never exposes tokens.",
)
async def get_status(
    service: GmailService = Depends(get_gmail_service),
) -> GmailStatusResponse:
    """Retrieve connection status and metadata."""
    return service.get_connection_status()


# ---------------------------------------------------------------------------
# 4. Disconnect & Revoke
# ---------------------------------------------------------------------------

@router.post(
    "/disconnect",
    response_model=GmailDisconnectResponse,
    summary="Disconnect Gmail account",
    description="Revokes stored tokens with Google OAuth and purges server-side credentials.",
)
async def disconnect_gmail(
    service: GmailService = Depends(get_gmail_service),
) -> GmailDisconnectResponse:
    """Revoke tokens and disconnect account."""
    return await service.disconnect()


# ---------------------------------------------------------------------------
# 5. Inbound Email Sync Hook
# ---------------------------------------------------------------------------

@router.post(
    "/sync",
    response_model=GmailSyncResponse,
    summary="Sync recent Gmail inbox messages into simulation",
    description="Fetches recent emails, sanitizes attachments, and triggers inject_incoming_email().",
)
async def sync_emails(
    payload: GmailSyncRequest,
    service: GmailService = Depends(get_gmail_service),
    manager: SimulationManager = Depends(get_simulation_manager),
) -> GmailSyncResponse:
    """Fetch recent emails and pipe them into the simulation engine."""
    status_info = service.get_connection_status()
    if not status_info.connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot sync emails: Gmail account is not connected.",
        )

    try:
        emails = await service.fetch_recent_emails(max_results=payload.max_emails)
        injected_records = []
        for msg in emails:
            # Prepare payload for SimulationManager
            email_dict = {
                "id": msg.id,
                "from": msg.from_address,
                "to": msg.to_address,
                "subject": msg.subject,
                "body": msg.body_text,
                "snippet": msg.snippet,
                "attachments": [att.model_dump() for att in msg.attachments],
                "received_at": msg.received_at,
                "is_untrusted": True,
            }
            injected = await manager.inject_incoming_email(payload.simulation_id, email_dict)
            injected_records.append(injected)

        return GmailSyncResponse(
            simulation_id=payload.simulation_id,
            emails_processed=len(injected_records),
            emails=injected_records,
        )
    except Exception as exc:
        log.error("Failed to sync emails into simulation %s: %s", payload.simulation_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Email sync failed: {exc}",
        )


# ---------------------------------------------------------------------------
# 6. List Real Gmail Inbox Messages (For Dashboard Display)
# ---------------------------------------------------------------------------

@router.get(
    "/messages",
    response_model=GmailMessagesResponse,
    summary="Fetch real Gmail inbox messages",
    description="Retrieves sanitized real messages from the connected Gmail inbox for dashboard display.",
)
async def list_gmail_messages(
    max_results: int = Query(default=10, ge=1, le=20, description="Max messages to fetch"),
    q: str = Query(default="in:inbox", description="Gmail search query"),
    service: GmailService = Depends(get_gmail_service),
) -> GmailMessagesResponse:
    """Retrieve sanitized emails from the user's real Gmail account."""
    status_info = service.get_connection_status()
    if not status_info.connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail account is not connected. Use /connect to authorize.",
        )

    try:
        messages = await service.fetch_recent_emails(max_results=max_results, query=q)
        return GmailMessagesResponse(
            messages=messages,
            count=len(messages),
            connected_email=status_info.email,
        )
    except Exception as exc:
        log.error("Failed to fetch Gmail messages: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Gmail messages: {exc}",
        )


# ---------------------------------------------------------------------------
# 7. Google Cloud Pub/Sub Push Webhook
# ---------------------------------------------------------------------------

@router.post(
    "/webhook",
    summary="Google Cloud Pub/Sub Push Notification Webhook",
    description="Receives real-time push events from Google Cloud Pub/Sub and ingests new emails.",
)
async def pubsub_push_webhook(
    payload: GmailPubSubPushPayload,
    token: Optional[str] = Query(default=None, description="Verification token"),
    service: GmailService = Depends(get_gmail_service),
    manager: SimulationManager = Depends(get_simulation_manager),
) -> Dict[str, Any]:
    """Handle incoming Pub/Sub push notification from Google Cloud."""
    # Optional token verification if configured
    settings = service._settings
    if settings.google_pubsub_verification_token:
        expected = settings.google_pubsub_verification_token.get_secret_value()
        if token != expected:
            log.warning("Pub/Sub push rejected: invalid verification token")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Pub/Sub verification token",
            )

    log.info("Processing Pub/Sub push message ID %s", payload.message.messageId)
    # Find any active simulation to pipe incoming email into
    active_sim_id: Optional[str] = None
    try:
        active_sims = manager.list_simulations(limit=1)
        if active_sims:
            active_sim_id = active_sims[0]["id"]
    except Exception:
        pass

    injected = await service.process_pubsub_push(
        raw_b64_data=payload.message.data,
        simulation_id=active_sim_id,
        manager=manager,
    )
    return {"status": "success", "injected_count": len(injected)}


# ---------------------------------------------------------------------------
# 8. Setup Gmail API Watch (Pub/Sub)
# ---------------------------------------------------------------------------

@router.post(
    "/watch",
    response_model=GmailWatchResponse,
    summary="Register Gmail API Watch for Pub/Sub notifications",
    description="Instructs Gmail API to send push notifications to the configured Google Cloud Pub/Sub topic.",
)
async def setup_watch(
    service: GmailService = Depends(get_gmail_service),
) -> GmailWatchResponse:
    """Register Gmail watch for Google Cloud Pub/Sub."""
    status_info = service.get_connection_status()
    if not status_info.connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail account is not connected.",
        )

    result = await service.setup_watch()
    return GmailWatchResponse(
        pubsub_configured=result.get("pubsub_configured", False),
        history_id=result.get("history_id"),
        expiration=result.get("expiration"),
        message=result.get("message", ""),
    )
