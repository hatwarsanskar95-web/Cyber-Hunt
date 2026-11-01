"""Mock Payment Tool — TOOL-003.

Simulates payment/transfer operations against the synthetic in-memory ledger.
Zero real financial transactions.  All operations are sandboxed to fixtures/ledger.py.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict

import fixtures.ledger as ledger_module

log = logging.getLogger(__name__)

SUPPORTED_OPERATIONS = frozenset(
    {"get_balance", "execute_transfer", "transfer", "pay", "send_payment",
     "transfer_funds", "send_funds", "invoice"}
)

_TRANSFER_ALIASES = {"transfer", "pay", "send_payment", "transfer_funds", "send_funds", "invoice", "execute_transfer"}


def get_balance(params: Dict[str, Any]) -> Dict[str, Any]:
    """Return the current balance for a given account ID."""
    account_id = str(params.get("account_id", "")).strip()
    if not account_id:
        return {"operation": "get_balance", "error": "account_id is required"}

    account = ledger_module.get_account(account_id)
    if account is None:
        return {
            "operation": "get_balance",
            "error": f"Account {account_id!r} not found in synthetic ledger",
        }

    log.info("get_balance: account=%r balance=%s", account_id, account["balance"])
    return {
        "operation": "get_balance",
        "account_id": account_id,
        "account_name": account["account_name"],
        "currency": account["currency"],
        "balance": account["balance"],
        "status": account["status"],
    }


def execute_transfer(params: Dict[str, Any]) -> Dict[str, Any]:
    """Simulate an in-memory fund transfer from an account to a recognised vendor."""
    from_account = str(params.get("from_account", "")).strip()
    vendor_id = str(params.get("vendor_id", "")).strip()
    amount_raw = params.get("amount", 0)
    currency = str(params.get("currency", "USD")).strip().upper()
    reference = str(params.get("reference", "")).strip() or "SIM-REF"

    # Validate inputs
    if not from_account:
        return {"operation": "execute_transfer", "error": "from_account is required"}
    if not vendor_id:
        return {"operation": "execute_transfer", "error": "vendor_id is required"}
    try:
        amount = float(amount_raw)
    except (TypeError, ValueError):
        return {"operation": "execute_transfer", "error": f"Invalid amount: {amount_raw!r}"}

    tx_id = f"SIM-TX-{uuid.uuid4().hex[:8].upper()}"

    try:
        receipt = ledger_module.execute_transfer(
            from_account=from_account,
            vendor_id=vendor_id,
            amount=amount,
            currency=currency,
            reference=reference,
            tx_id=tx_id,
        )
    except ValueError as exc:
        log.warning("execute_transfer failed: %s", exc)
        return {
            "operation": "execute_transfer",
            "error": str(exc),
            "status": "FAILED_SYNTHETIC",
        }

    log.info(
        "execute_transfer: tx=%r from=%r vendor=%r amount=%s %s [SYNTHETIC]",
        tx_id, from_account, vendor_id, amount, currency,
    )
    return {"operation": "execute_transfer", **receipt}


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------


def execute(operation: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatch a payment tool operation."""
    if operation not in SUPPORTED_OPERATIONS:
        return {
            "operation": operation,
            "error": f"Unsupported payment operation: {operation!r}. "
                     f"Supported: {sorted(SUPPORTED_OPERATIONS)}",
        }
    # All transfer aliases map to execute_transfer
    if operation in _TRANSFER_ALIASES:
        return execute_transfer(params)
    if operation == "get_balance":
        return get_balance(params)
    # Fallback (shouldn't reach)
    return {"operation": operation, "error": "Handler not found"}

