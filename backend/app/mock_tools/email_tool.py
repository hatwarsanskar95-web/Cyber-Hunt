"""Mock Email Tool — TOOL-002.

Simulates email operations against the synthetic fixtures inbox.
Zero real email access.  All data originates from fixtures/emails.py.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fixtures.emails import INBOX, INBOX_BY_ID, KNOWN_SENDERS, SENT_ITEMS

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported operations
# ---------------------------------------------------------------------------

SUPPORTED_OPERATIONS = frozenset(
    {"search_inbox", "read_email", "send_email", "list_emails", "read_inbox", "search", "compose"}
)


def search_inbox(params: Dict[str, Any]) -> Dict[str, Any]:
    """Search the synthetic inbox by keyword, sender, or subject fragment."""
    query = str(params.get("query", "")).lower().strip()
    sender = str(params.get("sender", "")).lower().strip()
    subject = str(params.get("subject", "")).lower().strip()
    max_results = min(int(params.get("max_results", 10)), 50)

    results: List[Dict] = []
    for msg in INBOX:
        if query and query not in msg["body"].lower() and query not in msg["subject"].lower():
            continue
        if sender and sender not in msg["from"].lower():
            continue
        if subject and subject not in msg["subject"].lower():
            continue
        results.append(_summarise_message(msg))
        if len(results) >= max_results:
            break

    log.info("search_inbox: query=%r found %d results", query, len(results))
    return {
        "operation": "search_inbox",
        "query": {"query": query, "sender": sender, "subject": subject},
        "count": len(results),
        "messages": results,
    }


def read_email(params: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieve a specific email message by ID."""
    msg_id = str(params.get("message_id", "")).strip()
    if not msg_id:
        return {"operation": "read_email", "error": "message_id is required"}

    msg = INBOX_BY_ID.get(msg_id)
    if not msg:
        return {"operation": "read_email", "error": f"Message {msg_id!r} not found in synthetic inbox"}

    log.info("read_email: id=%r subject=%r", msg_id, msg["subject"])
    return {
        "operation": "read_email",
        "message": _full_message(msg),
        "sender_known": msg["from"] in KNOWN_SENDERS,
    }


def send_email(params: Dict[str, Any]) -> Dict[str, Any]:
    """Simulate sending an email — appends to SENT_ITEMS, no real delivery."""
    to = params.get("to", [])
    if isinstance(to, str):
        to = [to]
    subject = str(params.get("subject", "(no subject)")).strip()
    body = str(params.get("body", "")).strip()

    if not to:
        return {"operation": "send_email", "error": "Recipient list 'to' is required"}
    if not body:
        return {"operation": "send_email", "error": "Email body is required"}

    # Synthetic message ID
    msg_id = f"sent-{len(SENT_ITEMS) + 2:04d}"
    record = {
        "id": msg_id,
        "from": "bob.chen@synthcorp.example",
        "to": to,
        "subject": subject,
        "body": body,
        "timestamp": "2026-10-31T22:00:00Z",
        "status": "SENT_SYNTHETIC",
    }
    SENT_ITEMS.append(record)

    log.info("send_email: id=%r to=%r subject=%r [SYNTHETIC]", msg_id, to, subject)
    return {
        "operation": "send_email",
        "message_id": msg_id,
        "to": to,
        "subject": subject,
        "status": "SENT_SYNTHETIC",
        "note": "[SIMULATION] No real email was delivered.",
    }


def list_emails(params: Dict[str, Any]) -> Dict[str, Any]:
    """List email summaries from the synthetic inbox (supports filtering by label)."""
    label = str(params.get("label", "")).upper().strip()
    max_results = min(int(params.get("max_results", 20)), 50)
    unread_only = bool(params.get("unread_only", False))

    filtered = [
        msg for msg in INBOX
        if (not label or label in msg.get("labels", []))
        and (not unread_only or not msg.get("read", True))
    ][:max_results]

    log.info("list_emails: label=%r count=%d", label or "ALL", len(filtered))
    return {
        "operation": "list_emails",
        "label": label or "ALL",
        "count": len(filtered),
        "messages": [_summarise_message(m) for m in filtered],
    }


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------


def execute(operation: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatch an email tool operation."""
    if operation not in SUPPORTED_OPERATIONS:
        return {
            "operation": operation,
            "error": f"Unsupported email operation: {operation!r}. "
                     f"Supported: {sorted(SUPPORTED_OPERATIONS)}",
        }
    # Normalise operation aliases
    _alias = {"read_inbox": "list_emails", "search": "search_inbox", "compose": "send_email"}
    op = _alias.get(operation, operation)

    _handlers = {
        "search_inbox": search_inbox,
        "read_email": read_email,
        "send_email": send_email,
        "list_emails": list_emails,
    }
    return _handlers[op](params)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _summarise_message(msg: Dict) -> Dict:
    return {
        "id": msg["id"],
        "from": msg["from"],
        "subject": msg["subject"],
        "timestamp": msg["timestamp"],
        "read": msg.get("read", False),
        "labels": msg.get("labels", []),
        "has_attachments": bool(msg.get("attachments")),
    }


def _full_message(msg: Dict) -> Dict:
    return {
        "id": msg["id"],
        "thread_id": msg.get("thread_id"),
        "from": msg["from"],
        "to": msg.get("to", []),
        "cc": msg.get("cc", []),
        "subject": msg["subject"],
        "body": msg["body"],
        "timestamp": msg["timestamp"],
        "read": msg.get("read", False),
        "labels": msg.get("labels", []),
        "attachments": msg.get("attachments", []),
    }

