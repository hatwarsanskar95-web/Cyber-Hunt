"""Schemas for Google Gmail OAuth 2.0 and Inbound Email Ingestion.

Ensures:
- Strict server-side token management (tokens are never returned in schemas).
- Enforcement of Gmail read-only scope.
- Structured untrusted email and attachment payloads.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Strict minimum Gmail scope required by CYBER HUNT
GMAIL_READONLY_SCOPE: str = "https://www.googleapis.com/auth/gmail.readonly"


class GmailConnectResponse(BaseModel):
    """Response returned when initiating Gmail OAuth connection."""

    authorization_url: str = Field(description="Google OAuth consent screen URL")
    state: str = Field(description="Cryptographic CSRF state token")


class GmailStatusResponse(BaseModel):
    """Public Gmail connection status. Zero secrets or tokens exposed."""

    connected: bool = Field(description="True if Gmail account is actively connected")
    email: Optional[str] = Field(default=None, description="Connected Google account email")
    scopes: List[str] = Field(default_factory=list, description="Granted OAuth scopes")
    expires_at: Optional[str] = Field(default=None, description="ISO timestamp of token expiry")
    is_expired: bool = Field(default=False, description="True if access token is currently expired")
    message: Optional[str] = Field(default=None, description="Descriptive status message")


class GmailCallbackResponse(BaseModel):
    """Response returned after successful OAuth callback authorization."""

    connected: bool = Field(default=True, description="Connection success flag")
    email: str = Field(description="Connected Google email address")
    message: str = Field(default="Gmail account connected successfully in read-only mode")


class GmailDisconnectResponse(BaseModel):
    """Response returned after disconnecting Gmail account."""

    status: str = Field(default="disconnected", description="Operation status")
    message: str = Field(default="Gmail account disconnected and tokens revoked")


class EmailAttachment(BaseModel):
    """Processed email attachment with untrusted content validation."""

    filename: str = Field(description="Sanitized attachment filename")
    content_type: str = Field(default="application/octet-stream", description="MIME content type")
    size_bytes: int = Field(default=0, ge=0, description="Attachment size in bytes")
    is_safe: bool = Field(default=True, description="False if file extension or structure is hazardous")
    rejection_reason: Optional[str] = Field(default=None, description="Reason if attachment is deemed unsafe")
    extracted_text: Optional[str] = Field(default=None, description="Safely extracted text from PDF/TXT")


class IncomingEmailPayload(BaseModel):
    """Untrusted incoming email structure delivered to simulation pipeline."""

    id: str = Field(description="Gmail message ID")
    thread_id: Optional[str] = Field(default=None, description="Gmail thread ID")
    from_address: str = Field(description="Sender email address")
    to_address: Optional[str] = Field(default=None, description="Recipient email address")
    subject: str = Field(default="(no subject)", description="Email subject")
    body_text: str = Field(default="", description="Sanitized plain text email body")
    snippet: str = Field(default="", description="Brief email snippet")
    attachments: List[EmailAttachment] = Field(default_factory=list, description="Parsed attachments")
    received_at: str = Field(description="ISO timestamp of email receipt")
    is_untrusted: bool = Field(default=False, description="Security marker: True if threat indicators detected")
    status_tag: Optional[str] = Field(default="Not Analyzed", description="Security lifecycle tag: Not Analyzed, Analyzing, Safe, Suspicious, Blocked, Requires Human Review, Analysis Failed")
    risk_score: Optional[int] = Field(default=None, description="Calculated risk score 0-100")


class GmailSyncRequest(BaseModel):
    """Request payload to sync incoming Gmail messages into a simulation."""

    simulation_id: str = Field(description="Target simulation UUID")
    max_emails: int = Field(default=3, ge=1, le=10, description="Max recent emails to fetch")


class GmailSyncResponse(BaseModel):
    """Summary of emails synchronized into the simulation engine."""

    simulation_id: str = Field(description="Target simulation UUID")
    emails_processed: int = Field(default=0, ge=0, description="Number of emails retrieved and injected")
    emails: List[Dict[str, Any]] = Field(default_factory=list, description="Sanitized email payloads injected")


class GmailMessagesResponse(BaseModel):
    """List of sanitized real Gmail messages for UI display."""

    messages: List[IncomingEmailPayload] = Field(default_factory=list, description="Sanitized Gmail messages")
    count: int = Field(default=0, ge=0, description="Total count of retrieved messages")
    connected_email: Optional[str] = Field(default=None, description="Connected Gmail email address")


class PubSubMessageData(BaseModel):
    """Google Cloud Pub/Sub push message structure."""

    data: str = Field(description="Base64-encoded notification JSON payload")
    messageId: Optional[str] = Field(default=None, description="Pub/Sub message ID")
    publishTime: Optional[str] = Field(default=None, description="Publish timestamp")


class GmailPubSubPushPayload(BaseModel):
    """Inbound push payload from Google Cloud Pub/Sub webhook."""

    message: PubSubMessageData = Field(description="Pub/Sub message container")
    subscription: Optional[str] = Field(default=None, description="Pub/Sub subscription name")


class GmailWatchResponse(BaseModel):
    """Status of Gmail API Watch push notification registration."""

    pubsub_configured: bool = Field(description="True if Google Cloud Pub/Sub is configured and watch is active")
    history_id: Optional[str] = Field(default=None, description="Current Gmail mailbox history ID")
    expiration: Optional[str] = Field(default=None, description="Watch expiration timestamp")
    message: str = Field(description="Status description or remaining configuration instructions")


