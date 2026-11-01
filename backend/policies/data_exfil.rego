package cyberhunt.data_exfil

import rego.v1

# ---------------------------------------------------------------------------
# SEC-003: Data Exfiltration Prevention Policy
#
# Blocks outbound transfers containing sensitive data or targeting
# unverified external destinations.
#
# Security Principles:
# - Presidio PII findings are considered but OPA independently validates.
# - Missing or malformed classification data defaults to BLOCK.
# - Sensitive data NEVER leaves the simulated environment.
# ---------------------------------------------------------------------------

default decision := "BLOCK"
default reason_codes := ["EXFIL_DEFAULT_BLOCK"]
default policy_version := "1.0.0"

policy_version := "1.0.0"

# ---------------------------------------------------------------------------
# Sensitive data classification labels that must never be exfiltrated
# ---------------------------------------------------------------------------

sensitive_classifications := {
    "PII",
    "PHI",
    "FINANCIAL",
    "CREDENTIALS",
    "API_KEY",
    "SSN",
    "EMAIL_ADDRESS",
    "CREDIT_CARD",
    "IBAN_CODE",
    "MEDICAL_LICENSE",
    "CONFIDENTIAL",
    "SECRET",
    "INTERNAL",
}

# Verified internal destinations (simulation-internal only)
verified_destinations := {
    "internal://simulation",
    "internal://report",
    "internal://summary",
    "internal://log",
    "inbox",
    "calendar",
    "local",
}

# Operations that can exfiltrate data
exfil_operations := {
    "send_email",
    "navigate",
    "upload",
    "post",
    "transfer",
    "export",
    "send",
}

# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

valid_exfil_input if {
    input.simulation_id != ""
    input.tool != ""
    input.operation != ""
}

operation_can_exfil if {
    input.operation in exfil_operations
}

# ---------------------------------------------------------------------------
# PII detected by Presidio
# ---------------------------------------------------------------------------

presidio_pii_found if {
    input.presidio_pii_detected == true
}

presidio_pii_found if {
    count(input.presidio_findings) > 0
    some finding in input.presidio_findings
    finding.entity_type in sensitive_classifications
}

# ---------------------------------------------------------------------------
# Sensitive classification detected in data payload
# ---------------------------------------------------------------------------

sensitive_data_in_payload if {
    some label in input.data_classifications
    label in sensitive_classifications
}

# ---------------------------------------------------------------------------
# Destination verification check
# ---------------------------------------------------------------------------

destination_unverified if {
    input.destination != ""
    not input.destination in verified_destinations
    input.destination_verified != true
}

destination_unverified if {
    not input.destination
    input.operation in exfil_operations
}

# ---------------------------------------------------------------------------
# BLOCK: PII detected + exfiltrating operation
# ---------------------------------------------------------------------------

decision := "BLOCK" if {
    valid_exfil_input
    operation_can_exfil
    presidio_pii_found
}

reason_codes := ["PRESIDIO_PII_DETECTED_EXFIL_BLOCKED"] if {
    valid_exfil_input
    operation_can_exfil
    presidio_pii_found
}

# BLOCK: Sensitive classification in payload + exfiltrating operation
decision := "BLOCK" if {
    valid_exfil_input
    operation_can_exfil
    sensitive_data_in_payload
}

reason_codes := ["SENSITIVE_DATA_CLASSIFICATION_BLOCKED"] if {
    valid_exfil_input
    operation_can_exfil
    sensitive_data_in_payload
}

# BLOCK: Unverified external destination
decision := "BLOCK" if {
    valid_exfil_input
    operation_can_exfil
    destination_unverified
}

reason_codes := ["UNVERIFIED_DESTINATION_BLOCKED"] if {
    valid_exfil_input
    operation_can_exfil
    destination_unverified
}

# BLOCK: Missing or malformed classification data for exfil operation
decision := "BLOCK" if {
    valid_exfil_input
    operation_can_exfil
    not input.data_classifications
    not input.presidio_pii_detected
}

reason_codes := ["MISSING_CLASSIFICATION_DATA_BLOCKED"] if {
    valid_exfil_input
    operation_can_exfil
    not input.data_classifications
    not input.presidio_pii_detected
}

# ---------------------------------------------------------------------------
# ALLOW: Non-exfiltrating operation or internal verified destination
# ---------------------------------------------------------------------------

decision := "ALLOW" if {
    valid_exfil_input
    not operation_can_exfil
}

reason_codes := ["NON_EXFIL_OPERATION_ALLOWED"] if {
    valid_exfil_input
    not operation_can_exfil
}

decision := "ALLOW" if {
    valid_exfil_input
    operation_can_exfil
    not presidio_pii_found
    not sensitive_data_in_payload
    not destination_unverified
}

reason_codes := ["CLEAN_EXFIL_OPERATION_TO_VERIFIED_DESTINATION"] if {
    valid_exfil_input
    operation_can_exfil
    not presidio_pii_found
    not sensitive_data_in_payload
    not destination_unverified
}

