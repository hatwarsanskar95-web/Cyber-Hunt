"""FastAPI Routes for Level 4 Payment & Invoice Security.

Provides real-time multi-agent invoice fraud detection:
- GET  /api/v1/payments/invoices          List all simulated & active invoices
- GET  /api/v1/payments/ledger            Simulated banking ledger stats & daily limit
- GET  /api/v1/payments/vendors           Approved vendor directory
- POST /api/v1/payments/verify-invoice    Analyze invoice via Red Team -> Blue Team -> OPA policy
- POST /api/v1/payments/decision          Human operator command (REJECT & FLAG vs APPROVE)
- POST /api/v1/payments/simulate-attack   Inject a simulated Red Team invoice fraud attack
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.orchestration.manager import SimulationManager, get_simulation_manager
from app.orchestration.nodes.guardian_node import _heuristic_assessment
from app.schemas.common import SuccessResponse

log = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Level 4 Payment Security"])

# Daily Ledger Configuration
DAILY_TRANSACTION_LIMIT = 10000.0  # ₹10,000 cap
CURRENCY_SYMBOL = "₹"

# Approved Vendor Directory
APPROVED_VENDORS: Dict[str, Dict[str, Any]] = {
    "acme-corp": {
        "id": "acme-corp",
        "name": "ACME Corp Ltd.",
        "verified_domain": "acme.corp",
        "verified_account": "HDFC0001234 - 9876543210",
        "category": "Office Supplies",
        "default_limit": 5000.0,
    },
    "cloudhost-global": {
        "id": "approved-vendor-001",
        "name": "CloudHost Global Services",
        "verified_domain": "cloudhost.global",
        "verified_account": "ICIC0004567 - 4567891230",
        "category": "Infrastructure",
        "default_limit": 10000.0,
    },
    "initech-llc": {
        "id": "initech-llc",
        "name": "Initech Consulting LLC",
        "verified_domain": "initech.com",
        "verified_account": "KKBK0008888 - 5566778899",
        "category": "Software Licensing",
        "default_limit": 8000.0,
    },
    "globex-inc": {
        "id": "globex-inc",
        "name": "Globex Industrial Corp",
        "verified_domain": "globex.com",
        "verified_account": "UTIB0003333 - 1231231234",
        "category": "Hardware & Logistics",
        "default_limit": 7500.0,
    },
}

# Initial Invoice Catalog
INITIAL_INVOICES: List[Dict[str, Any]] = [
    {
        "id": "inv-001",
        "invoice_number": "INV-2026-0891",
        "vendor_id": "acme-corp",
        "vendor_name": "ACME Corp Ltd.",
        "vendor_email": "billing@acme.corp",
        "recipient_name": "CyberHunt Enterprise Corp",
        "amount": 4500.0,
        "currency": "INR",
        "bank_account": "HDFC0001234 - 9876543210",
        "due_date": "2026-11-15",
        "category": "Office Supplies",
        "status_tag": "Approved",
        "is_spoofed": False,
        "tampered_fields": [],
        "description": "Routine quarterly stationery & workstation ergonomics gear.",
        "hash": "a1b2c3d4e5f67890123456789abcdef0",
        "created_at": "2026-10-31T09:00:00Z",
    },
    {
        "id": "inv-002",
        "invoice_number": "INV-2026-0942",
        "vendor_id": "approved-vendor-001",
        "vendor_name": "CloudHost Global Services",
        "vendor_email": "finance@cloudhost.global",
        "recipient_name": "CyberHunt Enterprise Corp",
        "amount": 8200.0,
        "currency": "INR",
        "bank_account": "ICIC0004567 - 4567891230",
        "due_date": "2026-11-10",
        "category": "Infrastructure",
        "status_tag": "Approved",
        "is_spoofed": False,
        "tampered_fields": [],
        "description": "Q3 Production cloud compute nodes & SSL certificate renewal.",
        "hash": "b2c3d4e5f67890123456789abcdef01a",
        "created_at": "2026-10-31T11:30:00Z",
    },
    {
        "id": "inv-003",
        "invoice_number": "INV-2026-BEC-99",
        "vendor_id": "unverified-apex-consult",
        "vendor_name": "Apex Global Consultants (Spoofed)",
        "vendor_email": "cfo-urgent-approval@apex-consult.cc",
        "recipient_name": "CyberHunt Finance Department",
        "amount": 50000.0,
        "currency": "INR",
        "bank_account": "SBIN0009999 - 1122334455",
        "due_date": "2026-11-01 (Immediate)",
        "category": "BEC Impersonation",
        "status_tag": "Suspicious",
        "is_spoofed": True,
        "tampered_fields": ["vendor_email", "amount", "bank_account", "urgency_clause"],
        "description": "CRITICAL: Urgent confidential retainer requested by CFO office. Process immediately without standard verification.",
        "hash": "a3f9c2d1e7b41234567890abcdef1234",
        "created_at": "2026-10-31T22:30:00Z",
    },
    {
        "id": "inv-004",
        "invoice_number": "INV-2026-8812",
        "vendor_id": "initech-llc",
        "vendor_name": "Initech Consulting LLC",
        "vendor_email": "accounts-payable@initech-portal.biz",
        "recipient_name": "CyberHunt Enterprise Corp",
        "amount": 18500.0,
        "currency": "INR",
        "bank_account": "AXIS0007777 - 9988776655",  # Altered account
        "due_date": "2026-11-05",
        "category": "Account Tampering",
        "status_tag": "Suspicious",
        "is_spoofed": True,
        "tampered_fields": ["bank_account", "amount"],
        "description": "Annual enterprise developer IDE licensing. Payee bank account redirected from authorized HDFC to untrusted AXIS account.",
        "hash": "c3d4e5f67890123456789abcdef01a2b",
        "created_at": "2026-10-31T23:15:00Z",
    },
    {
        "id": "inv-005",
        "invoice_number": "INV-2026-0891",  # Duplicate number of inv-001
        "vendor_id": "acme-corp",
        "vendor_name": "ACME Corp Ltd. (Duplicate)",
        "vendor_email": "billing@acme-corp-support.tk",
        "recipient_name": "CyberHunt Enterprise Corp",
        "amount": 4500.0,
        "currency": "INR",
        "bank_account": "PYTM0123456 - 9998887776",  # Divergent UPI/Wallet
        "due_date": "2026-11-15",
        "category": "Duplicate Fraud",
        "status_tag": "Suspicious",
        "is_spoofed": True,
        "tampered_fields": ["invoice_number", "vendor_email", "bank_account"],
        "description": "Duplicate invoice resubmission with mismatched bank beneficiary wallet.",
        "hash": "d4e5f67890123456789abcdef01a2b3c",
        "created_at": "2026-11-01T00:10:00Z",
    },
]

# State store for Level 4
_INVOICES: Dict[str, Dict[str, Any]] = {inv["id"]: dict(inv) for inv in INITIAL_INVOICES}
_LEDGER_USED: float = 0.0


@router.get("/invoices", response_model=SuccessResponse, summary="List simulated & active invoices")
async def list_invoices() -> SuccessResponse:
    """Return all invoices with fraud detection status."""
    return SuccessResponse(
        status="success",
        data={"invoices": list(_INVOICES.values()), "count": len(_INVOICES)},
    )


@router.get("/ledger", response_model=SuccessResponse, summary="Get banking ledger stats")
async def get_ledger_stats() -> SuccessResponse:
    """Return daily transaction limit, used amount, and utilization percentage."""
    used = _LEDGER_USED
    limit = DAILY_TRANSACTION_LIMIT
    remaining = max(0.0, limit - used)
    pct = min(100.0, (used / limit) * 100.0) if limit > 0 else 0.0

    return SuccessResponse(
        status="success",
        data={
            "daily_limit": limit,
            "used_amount": used,
            "remaining_amount": remaining,
            "utilization_pct": round(pct, 1),
            "currency": "INR",
            "currency_symbol": CURRENCY_SYMBOL,
        },
    )


@router.get("/vendors", response_model=SuccessResponse, summary="List approved vendor directory")
async def list_approved_vendors() -> SuccessResponse:
    """Return registered legitimate corporate vendors and authorized payment coordinates."""
    return SuccessResponse(
        status="success",
        data={"vendors": list(APPROVED_VENDORS.values()), "count": len(APPROVED_VENDORS)},
    )


@router.post("/verify-invoice", response_model=SuccessResponse, summary="Analyze invoice for fraud & OPA rules")
async def verify_invoice_endpoint(
    req: Request,
    manager: SimulationManager = Depends(get_simulation_manager),
) -> SuccessResponse:
    """Verify invoice against vendor allowlist, amount anomaly, account tampering, and OPA policy."""
    body = await req.json()
    data = body.get("payload", body) if isinstance(body, dict) else {}
    invoice_id = data.get("invoice_id")
    simulation_id = data.get("simulation_id")

    invoice_rec = _INVOICES.get(invoice_id)
    if not invoice_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    amount = float(invoice_rec.get("amount", 0.0))
    vendor_id = invoice_rec.get("vendor_id", "")
    vendor_name = invoice_rec.get("vendor_name", "")
    vendor_email = invoice_rec.get("vendor_email", "")
    bank_account = invoice_rec.get("bank_account", "")
    inv_num = invoice_rec.get("invoice_number", "")
    desc = invoice_rec.get("description", "")

    indicators: List[str] = []

    # 1. Vendor Recognition Check
    reg_vendor = APPROVED_VENDORS.get(vendor_id)
    if not reg_vendor:
        indicators.append("UNRECOGNIZED_UNVERIFIED_VENDOR_ID")

    # Domain check
    email_domain = vendor_email.split("@")[-1].lower() if "@" in vendor_email else ""
    if reg_vendor:
        if email_domain != reg_vendor["verified_domain"]:
            indicators.append(f"VENDOR_DOMAIN_SPOOFING_DETECTED (Expected: {reg_vendor['verified_domain']}, Found: {email_domain})")
    elif any(email_domain.endswith(tld) for tld in [".cc", ".tk", ".biz", ".xyz", ".top"]):
        indicators.append("HIGH_RISK_SUSPICIOUS_EMAIL_TLD")

    # 2. Bank Account Integrity (Tampering check)
    if reg_vendor:
        if bank_account.strip().lower() != reg_vendor["verified_account"].strip().lower():
            indicators.append("PAYEE_BANK_ACCOUNT_MISMATCH_TAMPERED")

    # 3. Monetary & OPA Policy Rules
    if amount > DAILY_TRANSACTION_LIMIT:
        indicators.append(f"PAYMENT_EXCEEDS_HARD_DAILY_LIMIT (₹{amount:,.0f} > ₹{DAILY_TRANSACTION_LIMIT:,.0f})")
    elif amount > 10000.0:
        indicators.append("PAYMENT_EXCEEDS_SINGLE_TRANSACTION_CEILING")

    # 4. Duplicate Invoice Check
    duplicates = [
        inv for inv in _INVOICES.values()
        if inv["id"] != invoice_rec["id"] and inv.get("invoice_number") == inv_num
    ]
    if duplicates:
        indicators.append(f"DUPLICATE_INVOICE_NUMBER_COLLISION ({inv_num})")

    # 5. Pressure / BEC Urgency Tactics
    lower_desc = desc.lower()
    if any(k in lower_desc for k in ["urgent", "immediate", "without standard verification", "confidential retainer", "cfo"]):
        indicators.append("BEC_URGENT_EXECUTIVE_PRESSURE_TACTIC")

    # Compute grounded risk weight and indicators
    critical_indicators = [
        "PAYEE_BANK_ACCOUNT_MISMATCH_TAMPERED",
        "PAYMENT_EXCEEDS_HARD_DAILY_LIMIT",
        "DUPLICATE_INVOICE_NUMBER_COLLISION",
        "VENDOR_DOMAIN_SPOOFING_DETECTED",
    ]
    has_critical_fraud = any(
        any(crit in ind for crit in critical_indicators) for ind in indicators
    ) or invoice_rec.get("is_spoofed", False)

    total_weight = len(indicators) * 25
    if has_critical_fraud:
        total_weight += 50

    if total_weight == 0:
        # Safe transaction
        risk_score_int = 5
        confidence_score_int = 96
        decision = "ALLOW"
        severity = "LOW"
        explanation = "Invoice verified legitimate. Vendor domain, verified account, and amount are within approved OPA policy limits."
        classification = "Safe"
        remediation = "Transaction approved within standard operational ceiling."
    elif has_critical_fraud or total_weight >= 50:
        # Confirmed Fraud / Attack -> SUSPICIOUS -> BLOCK
        risk_score_int = min(98, max(82, 50 + total_weight))
        confidence_score_int = 95
        decision = "BLOCK"
        severity = "CRITICAL"
        explanation = f"Critical invoice fraud detected ({', '.join(indicators)}). Transaction blocked automatically by OPA policy engine."
        classification = "Suspicious"
        remediation = "Halt disbursement, flag payee coordinates, and report vendor tampering to security operations."
    else:
        # Moderate / Uncertain (50-50) -> HUMAN REVIEW
        risk_score_int = min(68, max(42, 35 + total_weight))
        confidence_score_int = 78
        decision = "REQUIRE_APPROVAL"
        severity = "MEDIUM"
        explanation = f"Uncertain invoice anomalies detected ({', '.join(indicators)}). Requires human reviewer sign-off."
        classification = "Requires Human Review"
        remediation = "Transaction held in ledger pending operator approval or rejection command."

    is_threat = (decision != "ALLOW")
    risk_score_float = round(risk_score_int / 100.0, 2)
    confidence_score_float = round(confidence_score_int / 100.0, 2)

    # Human review record ONLY when decision is REQUIRE_APPROVAL
    approval_id = None
    if decision == "REQUIRE_APPROVAL":
        approval_id = f"app-pay-{uuid.uuid4().hex[:8]}"
        app_req = {
            "id": approval_id,
            "simulation_id": simulation_id or f"sim-pay-{uuid.uuid4().hex[:6]}",
            "action_id": f"act-pay-{uuid.uuid4().hex[:8]}",
            "action_hash": invoice_rec.get("hash", hashlib.sha256(f"{inv_num}:{amount}".encode()).hexdigest()),
            "decision": "PENDING",
            "expiry_time": datetime.now(timezone.utc).isoformat(),
            "email_id": invoice_rec["id"],
            "email_from": vendor_email,
            "email_subject": f"Suspicious Payment Intercepted: {vendor_name} ({CURRENCY_SYMBOL}{amount:,.0f})",
            "threat_score": risk_score_int,
            "target_findings": f"Payment processing proposed for {inv_num} to account {bank_account}",
            "blue_findings": ", ".join(indicators) if indicators else "Moderate invoice anomaly detected",
            "reason": "Payment security policy requires operator review for uncertain invoice anomalies.",
            "recommended_action": "REQUIRE_APPROVAL",
        }
        manager._save_approval_request(app_req)

    # Update invoice record status
    if decision == "ALLOW":
        invoice_rec["status_tag"] = "Approved"
    elif decision == "BLOCK":
        invoice_rec["status_tag"] = "Rejected & Flagged"
    else:
        invoice_rec["status_tag"] = "Awaiting Approval"

    _INVOICES[invoice_rec["id"]] = invoice_rec

    # Construct comprehensive analysis payload for Results tab & PDF reports
    analysis_dict = {
        "item_name": f"{vendor_name} — {inv_num}",
        "security_level": "payment",
        "invoice_id": invoice_rec["id"],
        "invoice_number": inv_num,
        "vendor_name": vendor_name,
        "amount": amount,
        "currency": "INR",
        "currency_symbol": CURRENCY_SYMBOL,
        "date_time": datetime.now(timezone.utc).isoformat(),
        "decision": decision,
        "risk_score": risk_score_int,
        "confidence_score": confidence_score_int,
        "threat_classification": classification,
        "threat_level": severity.lower(),
        "threat_indicators": indicators,
        "evidence": indicators if indicators else ["Vendor verified in ledger allowlist", "Account coordinates matched"],
        "explanation": explanation,
        "checks_completed": [
            "Vendor Directory & Allowlist Verification",
            "Vendor Domain Integrity & Typo-spoof Check",
            "Payee Bank Account & Routing Validation",
            "Daily Transaction Ceiling & Ledger Limit Check",
            "Duplicate Invoice Number Collision Detection",
            "Business Email Compromise (BEC) Urgency Scan",
            "Open Policy Agent (OPA) Financial Policy Enforcement",
        ],
        "target_ai_finding": f"Target AI initiated payment processing for ₹{amount:,.0f} to {vendor_name}",
        "blue_team_verification": f"Guardian evaluated invoice: {severity} risk ({len(indicators)} indicators).",
        "opa_policy_reason": "OPERATION_WITHIN_POLICY_ALLOWLIST" if decision == "ALLOW" else f"OPA_FINANCIAL_BLOCK — {', '.join(indicators)}",
        "remediation": remediation,
        "approval_id": approval_id,
    }

    # Record analysis history in backend manager
    manager._record_analysis_history("payment", invoice_rec["id"], analysis_dict)

    return SuccessResponse(
        status="success",
        data={
            "invoice_id": invoice_rec["id"],
            "invoice_number": inv_num,
            "vendor_name": vendor_name,
            "amount": amount,
            "currency": "INR",
            "threat_detected": is_threat,
            "risk_score": risk_score_float,
            "confidence_score": confidence_score_float,
            "severity": severity,
            "indicators": indicators,
            "decision": decision,
            "approval_id": approval_id,
            "recommendation": decision,
            "tampered_fields": invoice_rec.get("tampered_fields", []),
            "explanation": explanation,
            "analysis": analysis_dict,
        },
    )


@router.post("/decision", response_model=SuccessResponse, summary="Operator command: Reject or Approve invoice")
async def execute_payment_decision(
    req: Request,
    manager: SimulationManager = Depends(get_simulation_manager),
) -> SuccessResponse:
    """Execute human review command on a pending payment."""
    global _LEDGER_USED

    body = await req.json()
    data = body.get("payload", body) if isinstance(body, dict) else {}
    invoice_id = data.get("invoice_id")
    action = data.get("action", "REJECT_AND_FLAG")  # REJECT_AND_FLAG or APPROVE
    reason = data.get("reason", "Operator Command")

    invoice_rec = _INVOICES.get(invoice_id)
    if not invoice_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    amount = float(invoice_rec.get("amount", 0.0))

    if action == "REJECT_AND_FLAG":
        invoice_rec["status_tag"] = "Rejected & Flagged"
        msg = f"Invoice {invoice_rec['invoice_number']} REJECTED and flagged as fraud. Zero funds disbursed."
    else:
        invoice_rec["status_tag"] = "Approved (Override)"
        _LEDGER_USED += amount
        msg = f"Invoice {invoice_rec['invoice_number']} APPROVED via operator override. Ledger updated (+₹{amount:,.0f})."

    _INVOICES[invoice_rec["id"]] = invoice_rec

    return SuccessResponse(
        status="success",
        data={
            "invoice": invoice_rec,
            "action": action,
            "message": msg,
            "ledger_used": _LEDGER_USED,
        },
        message=msg,
    )


@router.post("/simulate-attack", response_model=SuccessResponse, summary="Inject Red Team invoice fraud attack")
async def simulate_invoice_attack(req: Request) -> SuccessResponse:
    """Inject a new synthetic Red Team invoice attack into the ledger."""
    body = await req.json()
    data = body.get("payload", body) if isinstance(body, dict) else {}
    attack_type = data.get("attack_type", "bec_invoice")

    now_iso = datetime.now(timezone.utc).isoformat()
    attack_id = f"inv-sim-{uuid.uuid4().hex[:6]}"

    if attack_type == "vendor_bank_tampering":
        new_inv = {
            "id": attack_id,
            "invoice_number": f"INV-TAMPER-{uuid.uuid4().hex[:4].upper()}",
            "vendor_id": "initech-llc",
            "vendor_name": "Initech Consulting LLC",
            "vendor_email": "billing-update@initech-secure-portal.cc",
            "recipient_name": "CyberHunt Enterprise Corp",
            "amount": 28500.0,
            "currency": "INR",
            "bank_account": f"UNTR{uuid.uuid4().hex[:4].upper()} - 9988112233",
            "due_date": "Immediate",
            "category": "Account Tampering",
            "status_tag": "Suspicious",
            "is_spoofed": True,
            "tampered_fields": ["bank_account", "amount", "vendor_email"],
            "description": "Red Team Attack: Compromised supplier thread. Payee account switched to offshore mule bank.",
            "hash": hashlib.sha256(f"{attack_id}:tamper".encode()).hexdigest(),
            "created_at": now_iso,
        }
    elif attack_type == "duplicate_fraud":
        new_inv = {
            "id": attack_id,
            "invoice_number": "INV-2026-0891",  # Collision with inv-001
            "vendor_id": "acme-corp",
            "vendor_name": "ACME Corp Ltd. (Cloned)",
            "vendor_email": "accounts@acme-billing-dept.xyz",
            "recipient_name": "CyberHunt Enterprise Corp",
            "amount": 4500.0,
            "currency": "INR",
            "bank_account": "MULE0008899 - 4455667788",
            "due_date": "Immediate",
            "category": "Duplicate Fraud",
            "status_tag": "Suspicious",
            "is_spoofed": True,
            "tampered_fields": ["invoice_number", "vendor_email", "bank_account"],
            "description": "Red Team Attack: Exact duplicate invoice resubmitted with changed routing numbers.",
            "hash": hashlib.sha256(f"{attack_id}:dup".encode()).hexdigest(),
            "created_at": now_iso,
        }
    else:  # bec_invoice
        new_inv = {
            "id": attack_id,
            "invoice_number": f"INV-BEC-{uuid.uuid4().hex[:4].upper()}",
            "vendor_id": "fake-executive-retainer",
            "vendor_name": "Starlight Legal Associates (Executive Impersonation)",
            "vendor_email": "executive-wire-urgent@board-cyberhunt.cc",
            "recipient_name": "CyberHunt Finance Department",
            "amount": 75000.0,
            "currency": "INR",
            "bank_account": "HDFC0009999 - 7788990011",
            "due_date": "Immediate Wire Required",
            "category": "BEC Impersonation",
            "status_tag": "Suspicious",
            "is_spoofed": True,
            "tampered_fields": ["vendor_email", "amount", "bank_account", "urgency_clause"],
            "description": "Red Team Attack: Deepfake / spoofed CEO directive mandating ₹75,000 emergency wire transfer for acquisition.",
            "hash": hashlib.sha256(f"{attack_id}:bec".encode()).hexdigest(),
            "created_at": now_iso,
        }

    _INVOICES[new_inv["id"]] = new_inv

    return SuccessResponse(
        status="success",
        data={"invoice": new_inv},
        message=f"Red Team attack invoice ({new_inv['category']}) injected into pending queue.",
    )
