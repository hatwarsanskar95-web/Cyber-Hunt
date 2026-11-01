package cyberhunt.high_impact

import rego.v1

# ---------------------------------------------------------------------------
# SEC-002: High-Impact and Monetary Action Policy
#
# Enforces approval gates for financial operations that:
# - Exceed the $500 payment threshold
# - Target unrecognized or unverified vendors
#
# Security Principles:
# - Any malformed or missing payment data defaults to REQUIRE_APPROVAL.
# - The action hash must be preserved for approval binding.
# - LLM recommendations cannot override this policy.
# ---------------------------------------------------------------------------

default decision := "REQUIRE_APPROVAL"
default reason_codes := ["PAYMENT_DEFAULT_REQUIRE_APPROVAL"]
default policy_version := "1.0.0"

policy_version := "1.0.0"

# Payment amount threshold (USD)
payment_threshold := 500

# ---------------------------------------------------------------------------
# Recognized (pre-approved) vendor allowlist for simulation
# ---------------------------------------------------------------------------

recognized_vendors := {
    "acme-corp",
    "globex-inc",
    "initech-llc",
    "umbrella-corp",
    "wayne-enterprises",
    "approved-vendor-001",
    "approved-vendor-002",
}

# ---------------------------------------------------------------------------
# Input validation for payment context
# ---------------------------------------------------------------------------

valid_payment_input if {
    input.tool == "payment"
    input.operation != ""
    input.action_hash != ""
    input.simulation_id != ""
}

has_valid_amount if {
    is_number(input.payment_amount)
    input.payment_amount >= 0
}

has_recognized_vendor if {
    input.vendor_id in recognized_vendors
}

# ---------------------------------------------------------------------------
# BLOCK: Malformed payment data — amount missing or not a number
# ---------------------------------------------------------------------------

decision := "BLOCK" if {
    input.tool == "payment"
    not has_valid_amount
}

reason_codes := ["MALFORMED_PAYMENT_AMOUNT"] if {
    input.tool == "payment"
    not has_valid_amount
}

# BLOCK: Amount exceeds threshold (hard block for very large amounts)
decision := "BLOCK" if {
    valid_payment_input
    has_valid_amount
    input.payment_amount > 10000
}

reason_codes := ["PAYMENT_EXCEEDS_HARD_LIMIT"] if {
    valid_payment_input
    has_valid_amount
    input.payment_amount > 10000
}

# REQUIRE_APPROVAL: Missing or unrecognized vendor
decision := "REQUIRE_APPROVAL" if {
    valid_payment_input
    has_valid_amount
    input.payment_amount <= payment_threshold
    not has_recognized_vendor
}

reason_codes := ["UNRECOGNIZED_OR_MISSING_VENDOR_REQUIRES_APPROVAL"] if {
    valid_payment_input
    has_valid_amount
    input.payment_amount <= payment_threshold
    not has_recognized_vendor
}

# ---------------------------------------------------------------------------
# ALLOW: Below threshold AND recognized vendor
# ---------------------------------------------------------------------------

decision := "ALLOW" if {
    valid_payment_input
    has_valid_amount
    input.payment_amount <= payment_threshold
    has_recognized_vendor
}

reason_codes := ["PAYMENT_WITHIN_POLICY"] if {
    valid_payment_input
    has_valid_amount
    input.payment_amount <= payment_threshold
    has_recognized_vendor
}

# ---------------------------------------------------------------------------
# Approval binding — action hash must match for approved payments
# ---------------------------------------------------------------------------

approval_valid if {
    input.approved_action_hash != ""
    input.action_hash != ""
    input.approved_action_hash == input.action_hash
}

approval_hash_mismatch if {
    input.approved_action_hash != ""
    input.action_hash != ""
    input.approved_action_hash != input.action_hash
}

