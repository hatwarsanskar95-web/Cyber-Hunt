"""Comprehensive Security Enforcement Unit Tests — Phase 8 (SEC-001 through SEC-007).

Tests:
1. Base Deny-by-Default Rego Policy semantics (SEC-001).
2. High-Impact Monetary Policy semantics (SEC-002).
3. Data Exfiltration Prevention Policy semantics (SEC-003).
4. OPA Client fail-closed behavior, REST mocking, and timeout handling (SEC-004).
5. Presidio Scanner PII & API key detection + false-positive checks (SEC-005).
6. Cryptographic SHA-256 Action Hash generation, canonical JSON, and tampering detection (SEC-006).
7. OPA Node execution, Supabase persistence, and LangGraph routing (SEC-007).
"""

from __future__ import annotations

import json
import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.orchestration.graph import route_policy_decision
from app.orchestration.nodes.opa_node import node_opa_eval
from app.schemas.common import PolicyDecisionEnum
from app.security.opa_client import OPAClient, OPADecision, get_opa_client
from app.security.presidio_scanner import PresidioScanner, get_presidio_scanner
from app.security.validator import canonical_json, compute_action_hash, verify_action_hash


# ===========================================================================
# SEC-006: Cryptographic Action Hash & Validator Tests
# ===========================================================================


class TestActionHashValidator:
    """SEC-006: Deterministic canonical JSON and SHA-256 hash tests."""

    def test_deterministic_hash_generation(self):
        hash1 = compute_action_hash(
            simulation_id="sim-001",
            tool="email",
            operation="send_email",
            parameters={"recipient": "user@example.com", "subject": "Hello"},
        )
        hash2 = compute_action_hash(
            simulation_id="sim-001",
            tool="email",
            operation="send_email",
            parameters={"subject": "Hello", "recipient": "user@example.com"},  # flipped key order
        )
        assert hash1 == hash2, "Key order must not alter canonical action hash"
        assert len(hash1) == 64

    def test_parameter_tampering_changes_hash(self):
        original_hash = compute_action_hash(
            simulation_id="sim-001",
            tool="payment",
            operation="transfer",
            parameters={"amount": 100, "recipient": "vendor-a"},
        )
        tampered_hash = compute_action_hash(
            simulation_id="sim-001",
            tool="payment",
            operation="transfer",
            parameters={"amount": 1000, "recipient": "vendor-a"},  # changed amount
        )
        assert original_hash != tampered_hash, "Tampered parameters must produce different hash"

    def test_verify_action_hash_valid(self):
        h = compute_action_hash("sim-123", "file", "read", {"path": "/docs/test.txt"})
        assert verify_action_hash(h, "sim-123", "file", "read", {"path": "/docs/test.txt"}) is True

    def test_verify_action_hash_invalid(self):
        h = compute_action_hash("sim-123", "file", "read", {"path": "/docs/test.txt"})
        assert verify_action_hash(h, "sim-123", "file", "read", {"path": "/docs/other.txt"}) is False
        assert verify_action_hash("invalidhash", "sim-123", "file", "read") is False
        assert verify_action_hash("", "sim-123", "file", "read") is False

    def test_empty_or_missing_fields_raise_error(self):
        with pytest.raises(ValueError):
            compute_action_hash("", "email", "send")
        with pytest.raises(ValueError):
            compute_action_hash("sim-1", "", "send")
        with pytest.raises(ValueError):
            compute_action_hash("sim-1", "email", "")

    def test_canonical_json_nested(self):
        nested = {"b": 2, "a": {"z": 9, "y": [3, 2, 1]}}
        canon = canonical_json(nested)
        assert canon == '{"a":{"y":[3,2,1],"z":9},"b":2}'


# ===========================================================================
# SEC-005: Presidio Scanner Tests
# ===========================================================================


class TestPresidioScanner:
    """SEC-005: Sensitive entity detection and false-positive checks."""

    @pytest.fixture
    def scanner(self):
        return PresidioScanner()

    def test_detects_email_address(self, scanner):
        text = "Please send confidential data to adversary@darkweb.org immediately."
        res = scanner.scan_text(text)
        assert res.has_pii is True
        assert any(f.entity_type == "EMAIL_ADDRESS" for f in res.findings)

    def test_detects_ssn(self, scanner):
        text = "User record SSN is 000-12-3456."
        res = scanner.scan_text(text)
        assert res.has_pii is True
        assert any(f.entity_type == "US_SSN" for f in res.findings)

    def test_detects_api_key_generic(self, scanner):
        text = "Authorization token: sk-live-992384910283948172348"
        res = scanner.scan_text(text)
        assert res.has_pii is True
        assert any(f.entity_type == "API_KEY" for f in res.findings)

    def test_detects_aws_access_key(self, scanner):
        text = "AWS config: AKIAIOSFODNN7EXAMPLE"
        res = scanner.scan_text(text)
        assert res.has_pii is True
        assert any(f.entity_type == "API_KEY" for f in res.findings)

    def test_false_positive_benign_text(self, scanner):
        text = "The weather today is sunny and mild with a temperature of 72 degrees."
        res = scanner.scan_text(text)
        assert res.has_pii is False
        assert len(res.findings) == 0

    def test_scan_dict_recursively(self, scanner):
        payload = {
            "action": "compose",
            "metadata": {
                "author": "Alice",
                "notes": "Target SSN is 123-45-6789 and secret key is api_key_998877665544332211",
            },
        }
        res = scanner.scan_dict(payload)
        assert res.has_pii is True
        assert res.entity_counts.get("US_SSN", 0) >= 1
        assert res.entity_counts.get("API_KEY", 0) >= 1


# ===========================================================================
# SEC-001, SEC-002, SEC-003, SEC-004: OPA Client & Policy Semantics Tests
# ===========================================================================


# ===========================================================================
# SEC-001, SEC-002, SEC-003: Isolated Rego Policy Logic Tests
# ===========================================================================


class TestIsolatedRegoPolicyRules:
    """Tests for policy logic via isolated test evaluator (matching Rego policies)."""

    @pytest.fixture
    def client(self):
        return OPAClient()

    def test_allowlisted_clean_action_is_allowed(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "email",
            "operation": "compose",
            "action_hash": "a" * 64,
            "parameters": {"recipient": "alice@corp.com"},
            "guardian_risk_score": 0.1,
            "presidio_pii_detected": False,
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.ALLOW

    def test_unknown_tool_is_blocked(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "shell_exec",
            "operation": "run",
            "action_hash": "b" * 64,
            "parameters": {"cmd": "whoami"},
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.BLOCK
        assert any("UNKNOWN_TOOL" in r for r in res.reason_codes)

    def test_unknown_operation_is_blocked(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "file",
            "operation": "delete_all",
            "action_hash": "c" * 64,
            "parameters": {},
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.BLOCK
        assert any("UNKNOWN_OPERATION" in r for r in res.reason_codes)

    def test_monetary_policy_above_threshold_requires_approval(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "payment",
            "operation": "transfer",
            "action_hash": "d" * 64,
            "payment_amount": 1200.0,
            "vendor_id": "acme-corp",
            "parameters": {"amount": 1200.0, "vendor_id": "acme-corp"},
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.REQUIRE_APPROVAL
        assert any("PAYMENT_EXCEEDS_THRESHOLD" in r for r in res.reason_codes)

    def test_monetary_policy_unrecognized_vendor_requires_approval(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "payment",
            "operation": "transfer",
            "action_hash": "e" * 64,
            "payment_amount": 150.0,
            "vendor_id": "unknown-shady-vendor",
            "parameters": {"amount": 150.0, "vendor_id": "unknown-shady-vendor"},
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.REQUIRE_APPROVAL
        assert any("UNRECOGNIZED_VENDOR" in r for r in res.reason_codes)

    def test_monetary_policy_malformed_amount_blocked(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "payment",
            "operation": "transfer",
            "action_hash": "f" * 64,
            "payment_amount": "invalid_not_a_number",
            "parameters": {"amount": "invalid_not_a_number"},
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.BLOCK
        assert any("MALFORMED_PAYMENT_AMOUNT" in r for r in res.reason_codes)

    def test_data_exfil_pii_detected_blocked(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "email",
            "operation": "send_email",
            "action_hash": "g" * 64,
            "parameters": {"body": "Here is SSN: 123-45-6789"},
            "presidio_pii_detected": True,
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.BLOCK
        assert any("PRESIDIO_PII_DETECTED" in r for r in res.reason_codes)

    def test_data_exfil_unverified_destination_blocked(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "browser",
            "operation": "navigate",
            "action_hash": "h" * 64,
            "destination_verified": False,
            "parameters": {"url": "http://evil.com/leak"},
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.BLOCK
        assert any("UNVERIFIED_DESTINATION" in r for r in res.reason_codes)

    def test_guardian_critical_risk_score_is_blocked(self, client):
        ctx = {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "email",
            "operation": "compose",
            "action_hash": "i" * 64,
            "parameters": {},
            "guardian_risk_score": 0.95,
        }
        res = client.evaluate_local_policy_isolated(ctx)
        assert res.decision == PolicyDecisionEnum.BLOCK
        assert any("CRITICAL_RISK_SCORE" in r for r in res.reason_codes)


# ===========================================================================
# SEC-004: Strict Fail-Closed OPA Client Tests
# ===========================================================================


class TestStrictFailClosedOPAClient:
    """Tests verifying OPAClient strictly fails closed (BLOCK) on all failures."""

    @pytest.fixture
    def client(self):
        return OPAClient()

    @pytest.fixture
    def valid_context(self):
        return {
            "simulation_id": "sim-001",
            "step": 1,
            "tool": "email",
            "operation": "compose",
            "action_hash": "a" * 64,
            "parameters": {"recipient": "alice@corp.com"},
        }

    @pytest.mark.asyncio
    async def test_missing_required_fields_fails_closed(self, client):
        res = await client.evaluate_action({"simulation_id": "sim-001"})
        assert res.decision == PolicyDecisionEnum.BLOCK
        assert any("INVALID_OR_INCOMPLETE" in r for r in res.reason_codes)

    @pytest.mark.asyncio
    async def test_opa_connection_refused_returns_block(self, client, valid_context):
        """OPA service unavailable / connection refused must return BLOCK."""
        with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection refused")):
            res = await client.evaluate_action(valid_context)
            assert res.decision == PolicyDecisionEnum.BLOCK
            assert "OPA_CONNECTION_REFUSED" in res.reason_codes
            assert "FAIL_CLOSED" in res.reason_codes
            assert res.is_fallback is True

    @pytest.mark.asyncio
    async def test_opa_timeout_returns_block(self, client, valid_context):
        """OPA request timeout must return BLOCK."""
        with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Timeout exceeded")):
            res = await client.evaluate_action(valid_context)
            assert res.decision == PolicyDecisionEnum.BLOCK
            assert "OPA_TIMEOUT" in res.reason_codes
            assert "FAIL_CLOSED" in res.reason_codes
            assert res.is_fallback is True

    @pytest.mark.asyncio
    async def test_opa_malformed_json_returns_block(self, client, valid_context):
        """OPA returning malformed JSON must return BLOCK."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.side_effect = json.JSONDecodeError("Expecting value", "doc", 0)

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            res = await client.evaluate_action(valid_context)
            assert res.decision == PolicyDecisionEnum.BLOCK
            assert "MALFORMED_OPA_JSON" in res.reason_codes
            assert "FAIL_CLOSED" in res.reason_codes

    @pytest.mark.asyncio
    async def test_opa_missing_decision_returns_block(self, client, valid_context):
        """OPA returning 200 without 'result.decision' must return BLOCK."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"result": {"some_other_key": 123}}

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            res = await client.evaluate_action(valid_context)
            assert res.decision == PolicyDecisionEnum.BLOCK
            assert "MISSING_OPA_DECISION" in res.reason_codes
            assert "FAIL_CLOSED" in res.reason_codes

    @pytest.mark.asyncio
    async def test_opa_unknown_decision_returns_block(self, client, valid_context):
        """OPA returning unknown decision string must return BLOCK."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"result": {"decision": "PERMIT_ANYTHING", "reason_codes": []}}

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            res = await client.evaluate_action(valid_context)
            assert res.decision == PolicyDecisionEnum.BLOCK
            assert "UNKNOWN_OPA_DECISION" in res.reason_codes
            assert "FAIL_CLOSED" in res.reason_codes

    @pytest.mark.asyncio
    async def test_opa_http_error_returns_block(self, client, valid_context):
        """OPA returning HTTP 500 or 503 must return BLOCK."""
        mock_resp = MagicMock()
        mock_resp.status_code = 503
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            res = await client.evaluate_action(valid_context)
            assert res.decision == PolicyDecisionEnum.BLOCK
            assert "OPA_HTTP_503" in res.reason_codes
            assert "FAIL_CLOSED" in res.reason_codes

    @pytest.mark.asyncio
    async def test_local_evaluator_cannot_authorize_when_opa_unavailable(self, client, valid_context):
        """Critical invariant: evaluate_action() NEVER uses local policy to authorize when OPA is down."""
        # valid_context is completely benign and would be ALLOWed by local policy
        with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("OPA daemon offline")):
            res = await client.evaluate_action(valid_context)
            # Must be strictly BLOCK, NOT ALLOW
            assert res.decision == PolicyDecisionEnum.BLOCK
            assert "OPA_CONNECTION_REFUSED" in res.reason_codes

    @pytest.mark.asyncio
    async def test_opa_rest_mock_success(self, client, valid_context):
        """Verify parsing of valid OPA REST response envelope."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": {
                "decision": "REQUIRE_APPROVAL",
                "reason_codes": ["RULE_MOCK_APPROVAL"],
                "policy_version": "1.0.0",
            }
        }
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            res = await client.evaluate_action(valid_context)
            assert res.decision == PolicyDecisionEnum.REQUIRE_APPROVAL
            assert "RULE_MOCK_APPROVAL" in res.reason_codes
            assert res.is_fallback is False


# ===========================================================================
# SEC-007: OPA Evaluation Node & State Graph Routing Tests
# ===========================================================================


class TestOPAEvaluationNode:
    """SEC-007: OPA Node execution, telemetry, and LangGraph routing."""

    @pytest.mark.asyncio
    async def test_node_eval_allow_flow(self):
        state = {
            "simulation_id": "11111111-2222-3333-4444-555555555555",
            "current_step": 1,
            "scenario_category": "prompt_injection",
            "target_proposal": {
                "tool_name": "email",
                "operation": "compose",
                "parameters": {"recipient": "colleague@corp.com", "subject": "Meeting notes"},
            },
            "guardian_assessment": {
                "risk_score": 0.1,
                "recommended_action": "ALLOW",
            },
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": {
                "decision": "ALLOW",
                "reason_codes": ["OPERATION_WITHIN_POLICY_ALLOWLIST"],
                "policy_version": "1.0.0",
            }
        }

        with patch("app.orchestration.nodes.opa_node.get_settings") as mock_settings, \
             patch("app.orchestration.nodes.opa_node.get_supabase_client") as mock_supa, \
             patch("app.orchestration.nodes.opa_node.AuditRepository") as mock_audit, \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            mock_settings.return_value.has_supabase_service_role = True
            mock_settings.return_value.supabase_anon_key = None
            mock_settings.return_value.opa_url = "http://localhost:8181"

            result = await node_opa_eval(state)

        assert result["policy_decision"]["decision"] == "ALLOW"
        assert result["status"] == "RUNNING"
        assert "action_hash" in result
        assert len(result["action_hash"]) == 64

        # Test LangGraph conditional routing
        next_route = route_policy_decision({"policy_decision": result["policy_decision"]})
        assert next_route == "tool_gateway"

    @pytest.mark.asyncio
    async def test_node_eval_require_approval_flow(self):
        state = {
            "simulation_id": "11111111-2222-3333-4444-555555555555",
            "current_step": 1,
            "scenario_category": "unauthorized_payment",
            "target_proposal": {
                "tool_name": "payment",
                "operation": "transfer",
                "parameters": {"amount": 750.0, "vendor_id": "acme-corp"},
            },
            "guardian_assessment": {
                "risk_score": 0.5,
                "recommended_action": "REQUIRE_APPROVAL",
            },
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": {
                "decision": "REQUIRE_APPROVAL",
                "reason_codes": ["PAYMENT_EXCEEDS_THRESHOLD_REQUIRES_APPROVAL"],
                "policy_version": "1.0.0",
            }
        }

        with patch("app.orchestration.nodes.opa_node.get_settings") as mock_settings, \
             patch("app.orchestration.nodes.opa_node.get_supabase_client"), \
             patch("app.orchestration.nodes.opa_node.AuditRepository"), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            mock_settings.return_value.has_supabase_service_role = False
            mock_settings.return_value.supabase_anon_key = None
            mock_settings.return_value.opa_url = "http://localhost:8181"

            result = await node_opa_eval(state)

        assert result["policy_decision"]["decision"] == "REQUIRE_APPROVAL"
        assert result["status"] == "AWAITING_APPROVAL"

        # Test LangGraph conditional routing
        next_route = route_policy_decision({"policy_decision": result["policy_decision"]})
        assert next_route == "human_approval"

    @pytest.mark.asyncio
    async def test_node_eval_block_flow(self):
        state = {
            "simulation_id": "11111111-2222-3333-4444-555555555555",
            "current_step": 1,
            "scenario_category": "data_exfiltration",
            "target_proposal": {
                "tool_name": "browser",
                "operation": "navigate",
                "parameters": {"url": "http://evil.com/exfil_data"},
            },
            "guardian_assessment": {
                "risk_score": 0.95,
                "recommended_action": "BLOCK",
            },
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": {
                "decision": "BLOCK",
                "reason_codes": ["UNVERIFIED_DESTINATION_BLOCKED"],
                "policy_version": "1.0.0",
            }
        }

        with patch("app.orchestration.nodes.opa_node.get_settings") as mock_settings, \
             patch("app.orchestration.nodes.opa_node.get_supabase_client"), \
             patch("app.orchestration.nodes.opa_node.AuditRepository"), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            mock_settings.return_value.has_supabase_service_role = False
            mock_settings.return_value.supabase_anon_key = None
            mock_settings.return_value.opa_url = "http://localhost:8181"

            result = await node_opa_eval(state)

        assert result["policy_decision"]["decision"] == "BLOCK"
        # Test LangGraph conditional routing
        next_route = route_policy_decision({"policy_decision": result["policy_decision"]})
        assert next_route == "score_update"

    @pytest.mark.asyncio
    async def test_guardian_monitor_does_not_override_opa_block(self):
        """Verify Guardian advisory MONITOR does not authorize an otherwise blocked tool."""
        state = {
            "simulation_id": "11111111-2222-3333-4444-555555555555",
            "current_step": 1,
            "target_proposal": {
                "tool_name": "shell_exec",  # forbidden tool
                "operation": "exec",
                "parameters": {"cmd": "ls"},
            },
            "guardian_assessment": {
                "risk_score": 0.4,
                "recommended_action": "MONITOR",  # Guardian advisory suggests MONITOR
            },
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": {
                "decision": "BLOCK",
                "reason_codes": ["UNKNOWN_TOOL_BLOCKED"],
                "policy_version": "1.0.0",
            }
        }

        with patch("app.orchestration.nodes.opa_node.get_settings") as mock_settings, \
             patch("app.orchestration.nodes.opa_node.get_supabase_client"), \
             patch("app.orchestration.nodes.opa_node.AuditRepository"), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            mock_settings.return_value.has_supabase_service_role = False
            mock_settings.return_value.supabase_anon_key = None
            mock_settings.return_value.opa_url = "http://localhost:8181"

            result = await node_opa_eval(state)

        # OPA independently denies unknown tool
        assert result["policy_decision"]["decision"] == "BLOCK"
        assert any("UNKNOWN_TOOL" in r for r in result["policy_decision"]["reason_codes"])

    @pytest.mark.asyncio
    async def test_presidio_pii_triggers_opa_block(self):
        """Verify Presidio finding during node execution causes exfil block."""
        state = {
            "simulation_id": "11111111-2222-3333-4444-555555555555",
            "current_step": 1,
            "target_proposal": {
                "tool_name": "email",
                "operation": "send_email",
                "parameters": {"body": "Secret key is sk-live-99887766554433221122"},
            },
            "guardian_assessment": {"risk_score": 0.2, "recommended_action": "ALLOW"},
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": {
                "decision": "BLOCK",
                "reason_codes": ["PRESIDIO_PII_DETECTED_EXFIL_BLOCKED"],
                "policy_version": "1.0.0",
            }
        }

        with patch("app.orchestration.nodes.opa_node.get_settings") as mock_settings, \
             patch("app.orchestration.nodes.opa_node.get_supabase_client"), \
             patch("app.orchestration.nodes.opa_node.AuditRepository"), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            mock_settings.return_value.has_supabase_service_role = False
            mock_settings.return_value.supabase_anon_key = None
            mock_settings.return_value.opa_url = "http://localhost:8181"

            result = await node_opa_eval(state)

        assert result["policy_decision"]["decision"] == "BLOCK"
        assert result["presidio_scan"]["has_pii"] is True

    @pytest.mark.asyncio
    async def test_supabase_policy_audit_failure_prevents_tool_execution(self):
        """Security requirement: Failed audit persistence MUST fail closed and block tool execution."""
        state = {
            "simulation_id": "11111111-2222-3333-4444-555555555555",
            "current_step": 1,
            "scenario_category": "prompt_injection",
            "target_proposal": {
                "tool_name": "email",
                "operation": "compose",
                "parameters": {"recipient": "alice@corp.com"},
            },
            "guardian_assessment": {"risk_score": 0.1, "recommended_action": "ALLOW"},
        }

        # OPA would have allowed this action
        mock_opa_resp = MagicMock()
        mock_opa_resp.status_code = 200
        mock_opa_resp.json.return_value = {
            "result": {
                "decision": "ALLOW",
                "reason_codes": ["OPERATION_WITHIN_POLICY_ALLOWLIST"],
                "policy_version": "1.0.0",
            }
        }

        mock_audit_repo = MagicMock()
        # Database persistence throws a critical error
        mock_audit_repo.record_policy_decision.side_effect = RuntimeError("Supabase connection broken")

        with patch("app.orchestration.nodes.opa_node.get_settings") as mock_settings, \
             patch("app.orchestration.nodes.opa_node.get_supabase_client"), \
             patch("app.orchestration.nodes.opa_node.AuditRepository", return_value=mock_audit_repo), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_opa_resp):
            mock_settings.return_value.has_supabase_service_role = True
            mock_settings.return_value.supabase_anon_key = None
            mock_settings.return_value.opa_url = "http://localhost:8181"

            result = await node_opa_eval(state)

        # Must be strictly converted to BLOCK
        assert result["policy_decision"]["decision"] == "BLOCK"
        assert result["status"] == "FAILED"
        assert "AUDIT_PERSISTENCE_FAILED" in result["policy_decision"]["reason_codes"]
        assert "FAIL_CLOSED" in result["policy_decision"]["reason_codes"]

        # Crucial security check: LangGraph routing must NOT route to tool_gateway
        next_route = route_policy_decision({"policy_decision": result["policy_decision"]})
        assert next_route == "score_update", f"Action must be blocked, got {next_route}"

    @pytest.mark.asyncio
    async def test_successful_opa_and_audit_preserves_normal_routing(self):
        """When OPA allows and audit succeeds, normal tool_gateway routing is preserved."""
        state = {
            "simulation_id": "11111111-2222-3333-4444-555555555555",
            "current_step": 1,
            "scenario_category": "prompt_injection",
            "target_proposal": {
                "tool_name": "email",
                "operation": "compose",
                "parameters": {"recipient": "alice@corp.com"},
            },
            "guardian_assessment": {"risk_score": 0.1, "recommended_action": "ALLOW"},
        }

        mock_opa_resp = MagicMock()
        mock_opa_resp.status_code = 200
        mock_opa_resp.json.return_value = {
            "result": {
                "decision": "ALLOW",
                "reason_codes": ["OPERATION_WITHIN_POLICY_ALLOWLIST"],
                "policy_version": "1.0.0",
            }
        }

        mock_audit_repo = MagicMock()
        mock_audit_repo.record_policy_decision.return_value = {"id": "decision-123"}

        with patch("app.orchestration.nodes.opa_node.get_settings") as mock_settings, \
             patch("app.orchestration.nodes.opa_node.get_supabase_client"), \
             patch("app.orchestration.nodes.opa_node.AuditRepository", return_value=mock_audit_repo), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_opa_resp):
            mock_settings.return_value.has_supabase_service_role = True
            mock_settings.return_value.supabase_anon_key = None
            mock_settings.return_value.opa_url = "http://localhost:8181"

            result = await node_opa_eval(state)

        assert result["policy_decision"]["decision"] == "ALLOW"
        assert result["status"] == "RUNNING"
        mock_audit_repo.record_policy_decision.assert_called_once()

        next_route = route_policy_decision({"policy_decision": result["policy_decision"]})
        assert next_route == "tool_gateway"

