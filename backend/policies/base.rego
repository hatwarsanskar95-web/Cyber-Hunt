package cyberhunt.authz

import rego.v1

# ---------------------------------------------------------------------------
# SEC-001: Base Deny-by-Default Rego Policy
#
# Default decision: BLOCK
# Only explicitly allowlisted tool/operation combinations within recognized
# scenario categories are permitted.
#
# Security Principles:
# - OPA independently evaluates every proposed action.
# - Guardian recommendations are NEVER treated as authorization.
# - Invalid, incomplete, or unknown actions are always blocked.
# ---------------------------------------------------------------------------

# Default decision: BLOCK (fail closed)
default decision := "BLOCK"
default reason_codes := ["DEFAULT_DENY"]
default policy_version := "1.0.0"

policy_version := "1.0.0"

# ---------------------------------------------------------------------------
# Input validation — required fields must be present and non-empty
# ---------------------------------------------------------------------------

valid_input if {
    input.simulation_id != ""
    input.tool != ""
    input.operation != ""
    input.action_hash != ""
    count(input.simulation_id) > 0
    count(input.tool) > 0
    count(input.operation) > 0
}

# ---------------------------------------------------------------------------
# Allowlisted tool/operation combinations
# ---------------------------------------------------------------------------

allowlisted_operations := {
    "email": {"compose", "read", "send_email", "search_inbox", "read_email", "list_emails", "read_inbox", "search"},
    "file":  {"read", "list", "read_file", "list_files", "read_config"},
    "browser": {"navigate", "search", "read_page", "browse_url"},
    "payment": {"transfer", "pay", "send_payment", "transfer_funds", "send_funds"},
    "none": {"none", "respond_only"},
}

operation_allowed if {
    ops := allowlisted_operations[input.tool]
    input.operation in ops
}

# ---------------------------------------------------------------------------
# ALLOW: valid input + allowlisted tool/operation + not blocked by other policies
# ---------------------------------------------------------------------------

decision := "ALLOW" if {
    valid_input
    operation_allowed
    not blocked_by_high_impact
    not blocked_by_exfil
    not missing_required_context
}

reason_codes := ["OPERATION_WITHIN_POLICY_ALLOWLIST"] if {
    decision == "ALLOW"
}

# ---------------------------------------------------------------------------
# BLOCK: missing or invalid input
# ---------------------------------------------------------------------------

decision := "BLOCK" if {
    not valid_input
}

reason_codes := ["INVALID_OR_INCOMPLETE_INPUT"] if {
    not valid_input
}

# BLOCK: unknown tool
decision := "BLOCK" if {
    valid_input
    not allowlisted_operations[input.tool]
}

reason_codes := ["UNKNOWN_TOOL_BLOCKED"] if {
    valid_input
    not allowlisted_operations[input.tool]
}

# BLOCK: known tool but unknown operation
decision := "BLOCK" if {
    valid_input
    allowlisted_operations[input.tool]
    not operation_allowed
}

reason_codes := ["UNKNOWN_OPERATION_BLOCKED"] if {
    valid_input
    allowlisted_operations[input.tool]
    not operation_allowed
}

# BLOCK: high risk score from guardian (>= 0.9) — OPA independently confirms
decision := "BLOCK" if {
    valid_input
    input.guardian_risk_score >= 0.9
}

reason_codes := ["CRITICAL_RISK_SCORE_BLOCKED"] if {
    valid_input
    input.guardian_risk_score >= 0.9
}

# ---------------------------------------------------------------------------
# Missing required context guard
# ---------------------------------------------------------------------------

missing_required_context if {
    not input.scenario_category
}

# ---------------------------------------------------------------------------
# Blocked by other sub-policies (referenced from high_impact and data_exfil)
# These are checked via imports / combined evaluation in the OPA client
# ---------------------------------------------------------------------------

blocked_by_high_impact if {
    input.tool == "payment"
    input.payment_amount > 500
}

blocked_by_high_impact if {
    input.tool == "payment"
    not input.vendor_verified
}

blocked_by_exfil if {
    input.destination_verified == false
    input.has_sensitive_data == true
}

blocked_by_exfil if {
    input.presidio_pii_detected == true
    input.operation in {"send_email", "navigate"}
}

# ---------------------------------------------------------------------------
# REQUIRE_APPROVAL: payment operations requiring sign-off
# ---------------------------------------------------------------------------

decision := "REQUIRE_APPROVAL" if {
    valid_input
    input.tool == "payment"
    not blocked_by_high_impact
    operation_allowed
    not blocked_by_exfil
}

reason_codes := ["PAYMENT_REQUIRES_HUMAN_APPROVAL"] if {
    decision == "REQUIRE_APPROVAL"
}

