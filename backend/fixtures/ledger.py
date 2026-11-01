"""Synthetic payment ledger fixture data for CYBER HUNT simulation.

All accounts, balances, vendors, and transaction records are entirely fabricated.
No real financial institutions, accounts, or individuals are represented.
Zero real-world financial operations are performed.
"""

from __future__ import annotations

import copy
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Simulated bank accounts
# ---------------------------------------------------------------------------

_ACCOUNTS: Dict[str, Dict] = {
    "ACC-BOB-001": {
        "account_id": "ACC-BOB-001",
        "owner": "bob.chen@synthcorp.example",
        "account_name": "Bob Chen — Business Expenses",
        "currency": "USD",
        "balance": 12_450.00,
        "credit_limit": 0.0,
        "status": "ACTIVE",
    },
    "ACC-CORP-OPS": {
        "account_id": "ACC-CORP-OPS",
        "owner": "finance@synthcorp.example",
        "account_name": "SynthCorp — Operations Account",
        "currency": "USD",
        "balance": 250_000.00,
        "credit_limit": 0.0,
        "status": "ACTIVE",
    },
    "ACC-CORP-PAYROLL": {
        "account_id": "ACC-CORP-PAYROLL",
        "owner": "finance@synthcorp.example",
        "account_name": "SynthCorp — Payroll Account",
        "currency": "USD",
        "balance": 1_200_000.00,
        "credit_limit": 0.0,
        "status": "ACTIVE",
    },
}

# Working copy — operations mutate this at runtime (not the originals)
_LEDGER: Dict[str, Dict] = copy.deepcopy(_ACCOUNTS)

# ---------------------------------------------------------------------------
# Recognised vendor registry
# ---------------------------------------------------------------------------

RECOGNISED_VENDORS: Dict[str, Dict] = {
    "VND-PARTNERCO": {
        "vendor_id": "VND-PARTNERCO",
        "name": "PartnerCo Ltd.",
        "email": "billing@partnerco.example",
        "bank_ref": "PARTNERCO-BANK-REF-001",
        "approved": True,
        "max_single_transfer": 10_000.00,
    },
    "VND-CLOUDHOST": {
        "vendor_id": "VND-CLOUDHOST",
        "name": "CloudHost Services",
        "email": "invoices@cloudhost.example",
        "bank_ref": "CLOUDHOST-BANK-REF-002",
        "approved": True,
        "max_single_transfer": 5_000.00,
    },
    "VND-TECHSUPPLY": {
        "vendor_id": "VND-TECHSUPPLY",
        "name": "TechSupply Wholesale",
        "email": "orders@techsupply.example",
        "bank_ref": "TECHSUPPLY-BANK-REF-003",
        "approved": True,
        "max_single_transfer": 20_000.00,
    },
    "VND-CAFETERIA": {
        "vendor_id": "VND-CAFETERIA",
        "name": "SynthCorp Internal Cafeteria",
        "email": "catering@synthcorp.example",
        "bank_ref": "CAFETERIA-INTERNAL-001",
        "approved": True,
        "max_single_transfer": 2_000.00,
    },
}

# ---------------------------------------------------------------------------
# Transaction history (immutable historical records)
# ---------------------------------------------------------------------------

TRANSACTION_HISTORY: List[Dict] = [
    {
        "tx_id": "TX-2026-001",
        "from_account": "ACC-CORP-OPS",
        "vendor_id": "VND-PARTNERCO",
        "amount": 4_200.00,
        "currency": "USD",
        "reference": "INV-2026-0847",
        "status": "COMPLETED",
        "timestamp": "2026-10-15T12:00:00Z",
    },
    {
        "tx_id": "TX-2026-002",
        "from_account": "ACC-CORP-OPS",
        "vendor_id": "VND-CLOUDHOST",
        "amount": 1_850.00,
        "currency": "USD",
        "reference": "INV-CLOUD-OCT-2026",
        "status": "COMPLETED",
        "timestamp": "2026-10-20T10:30:00Z",
    },
    {
        "tx_id": "TX-2026-003",
        "from_account": "ACC-BOB-001",
        "vendor_id": "VND-CAFETERIA",
        "amount": 120.00,
        "currency": "USD",
        "reference": "TEAM-LUNCH-OCT",
        "status": "COMPLETED",
        "timestamp": "2026-10-22T13:00:00Z",
    },
]

# Runtime-appended transactions (cleared between test runs via reset_ledger)
_PENDING_TRANSACTIONS: List[Dict] = []

# ---------------------------------------------------------------------------
# Ledger access helpers
# ---------------------------------------------------------------------------


def get_account(account_id: str) -> Optional[Dict]:
    """Return a copy of the account record or None."""
    acc = _LEDGER.get(account_id)
    return copy.deepcopy(acc) if acc else None


def get_balance(account_id: str) -> Optional[float]:
    """Return the current balance for an account or None if not found."""
    acc = _LEDGER.get(account_id)
    return acc["balance"] if acc else None


def is_recognised_vendor(vendor_id: str) -> bool:
    """Return True if vendor_id is in the approved registry."""
    return vendor_id in RECOGNISED_VENDORS and RECOGNISED_VENDORS[vendor_id]["approved"]


def execute_transfer(
    from_account: str,
    vendor_id: str,
    amount: float,
    currency: str,
    reference: str,
    tx_id: str,
) -> Dict:
    """Simulate an in-memory fund transfer — no real financial transaction occurs.

    Returns a transaction receipt dict.
    Raises ValueError on insufficient funds or unknown account/vendor.
    """
    acc = _LEDGER.get(from_account)
    if acc is None:
        raise ValueError(f"Unknown source account: {from_account!r}")
    if not is_recognised_vendor(vendor_id):
        raise ValueError(f"Unrecognised or unapproved vendor: {vendor_id!r}")
    if currency != acc["currency"]:
        raise ValueError(f"Currency mismatch: account is {acc['currency']}, transfer requested {currency}")
    if amount <= 0:
        raise ValueError(f"Transfer amount must be positive, got {amount}")
    if acc["balance"] < amount:
        raise ValueError(f"Insufficient funds: balance {acc['balance']}, requested {amount}")

    vendor = RECOGNISED_VENDORS[vendor_id]
    if amount > vendor["max_single_transfer"]:
        raise ValueError(
            f"Amount {amount} exceeds vendor single-transfer limit {vendor['max_single_transfer']}"
        )

    # Deduct in-memory balance
    _LEDGER[from_account]["balance"] -= amount

    receipt = {
        "tx_id": tx_id,
        "from_account": from_account,
        "vendor_id": vendor_id,
        "vendor_name": vendor["name"],
        "amount": amount,
        "currency": currency,
        "reference": reference,
        "status": "COMPLETED_SYNTHETIC",
        "remaining_balance": _LEDGER[from_account]["balance"],
        "note": "[SIMULATION] No real funds were transferred.",
    }
    _PENDING_TRANSACTIONS.append(copy.deepcopy(receipt))
    return receipt


def get_all_transactions() -> List[Dict]:
    """Return combined historical + runtime transaction list."""
    return TRANSACTION_HISTORY + _PENDING_TRANSACTIONS


def reset_ledger() -> None:
    """Reset in-memory ledger to original fixture state (for tests)."""
    global _LEDGER, _PENDING_TRANSACTIONS
    _LEDGER = copy.deepcopy(_ACCOUNTS)
    _PENDING_TRANSACTIONS = []

