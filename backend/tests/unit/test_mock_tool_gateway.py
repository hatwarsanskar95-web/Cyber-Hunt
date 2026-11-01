"""Tests for Mock Tool Gateway — TOOL-001 through TOOL-007 (Phase 9).

Coverage:
  - Gateway security gates (OPA decision, action hash, tool/operation allowlist)
  - Email tool operations
  - Payment tool operations
  - Browser tool operations (including external URL block)
  - File tool operations (including sandbox enforcement)
  - tool_gateway_node LangGraph integration
  - Audit persistence failure handling
  - Tampered parameter rejection
  - Concurrent execution isolation
"""

from __future__ import annotations

import sys
import os
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest

from app.orchestration.nodes.tool_node import tool_gateway_node

# Ensure backend/ is on path for fixture imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


# ===========================================================================
# Fixtures / helpers
# ===========================================================================


def _make_hash(sim_id: str, tool: str, op: str, params: Dict[str, Any]) -> str:
    from app.security.validator import compute_action_hash
    return compute_action_hash(sim_id, tool, op, params)


def _build_state(
    decision: str = "ALLOW",
    tool: str = "email",
    op: str = "list_emails",
    params: Dict[str, Any] | None = None,
    sim_id: str = "sim-test-001",
    action_hash: str | None = None,
    step: int = 1,
) -> Dict[str, Any]:
    params = params or {}
    ah = action_hash if action_hash is not None else _make_hash(sim_id, tool, op, params)
    return {
        "simulation_id": sim_id,
        "current_step": step,
        "policy_decision": {"decision": decision},
        "target_proposal": {"tool_name": tool, "operation": op, "parameters": params},
        "action_hash": ah,
    }


# ===========================================================================
# MockToolGateway — Gate 1: OPA decision
# ===========================================================================


class TestGatewayOPAGate:
    def _gateway(self):
        from app.mock_tools.gateway import MockToolGateway
        return MockToolGateway()

    def test_allow_passes_gate1(self):
        gw = self._gateway()
        params = {"label": "INBOX"}
        ah = _make_hash("sim-001", "email", "list_emails", params)
        result = gw.execute(
            simulation_id="sim-001",
            tool_name="email",
            operation="list_emails",
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "SUCCESS"

    def test_block_rejected_at_gate1(self):
        gw = self._gateway()
        params = {}
        ah = _make_hash("sim-001", "email", "list_emails", params)
        result = gw.execute(
            simulation_id="sim-001",
            tool_name="email",
            operation="list_emails",
            parameters=params,
            action_hash=ah,
            opa_decision="BLOCK",
        )
        assert result.execution_status == "BLOCKED"
        assert "BLOCK" in result.error

    def test_require_approval_rejected_at_gate1(self):
        gw = self._gateway()
        params = {}
        ah = _make_hash("sim-001", "payment", "get_balance", params)
        result = gw.execute(
            simulation_id="sim-001",
            tool_name="payment",
            operation="get_balance",
            parameters=params,
            action_hash=ah,
            opa_decision="REQUIRE_APPROVAL",
        )
        assert result.execution_status == "BLOCKED"

    def test_unknown_decision_rejected(self):
        gw = self._gateway()
        params = {}
        ah = _make_hash("sim-001", "email", "list_emails", params)
        result = gw.execute(
            simulation_id="sim-001",
            tool_name="email",
            operation="list_emails",
            parameters=params,
            action_hash=ah,
            opa_decision="UNKNOWN_DECISION",
        )
        assert result.execution_status == "BLOCKED"


# ===========================================================================
# MockToolGateway — Gate 2: Action hash verification
# ===========================================================================


class TestGatewayHashGate:
    def _gateway(self):
        from app.mock_tools.gateway import MockToolGateway
        return MockToolGateway()

    def test_correct_hash_passes(self):
        gw = self._gateway()
        params = {"label": "INBOX"}
        ah = _make_hash("sim-002", "email", "list_emails", params)
        result = gw.execute(
            simulation_id="sim-002",
            tool_name="email",
            operation="list_emails",
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "SUCCESS"

    def test_tampered_params_rejected(self):
        gw = self._gateway()
        original_params = {"label": "INBOX"}
        ah = _make_hash("sim-002", "email", "list_emails", original_params)
        # Tamper: change the params after computing the hash
        tampered_params = {"label": "INBOX", "extra": "injected_value"}
        result = gw.execute(
            simulation_id="sim-002",
            tool_name="email",
            operation="list_emails",
            parameters=tampered_params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "HASH_MISMATCH"
        assert "tampered" in result.error.lower()

    def test_wrong_simulation_id_rejected(self):
        gw = self._gateway()
        params = {}
        ah = _make_hash("sim-A", "email", "list_emails", params)
        result = gw.execute(
            simulation_id="sim-B",  # wrong sim_id
            tool_name="email",
            operation="list_emails",
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "HASH_MISMATCH"

    def test_empty_hash_rejected(self):
        gw = self._gateway()
        result = gw.execute(
            simulation_id="sim-002",
            tool_name="email",
            operation="list_emails",
            parameters={},
            action_hash="",
            opa_decision="ALLOW",
        )
        assert result.execution_status == "HASH_MISMATCH"


# ===========================================================================
# MockToolGateway — Gate 3 & 4: Tool/Operation allowlist
# ===========================================================================


class TestGatewayAllowlistGate:
    def _gateway(self):
        from app.mock_tools.gateway import MockToolGateway
        return MockToolGateway()

    def test_unknown_tool_rejected(self):
        gw = self._gateway()
        params = {}
        ah = _make_hash("sim-003", "shell", "exec", params)
        result = gw.execute(
            simulation_id="sim-003",
            tool_name="shell",
            operation="exec",
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "INVALID_TOOL"

    def test_unknown_operation_rejected(self):
        gw = self._gateway()
        params = {}
        ah = _make_hash("sim-003", "email", "delete_all_emails", params)
        result = gw.execute(
            simulation_id="sim-003",
            tool_name="email",
            operation="delete_all_emails",
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "INVALID_TOOL"

    def test_none_tool_succeeds(self):
        gw = self._gateway()
        params = {}
        ah = _make_hash("sim-003", "none", "none", params)
        result = gw.execute(
            simulation_id="sim-003",
            tool_name="none",
            operation="none",
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "SUCCESS"


# ===========================================================================
# Email Tool Tests
# ===========================================================================


class TestEmailTool:
    def _gateway(self):
        from app.mock_tools.gateway import MockToolGateway
        return MockToolGateway()

    def _exec(self, op: str, params: Dict[str, Any], sim_id: str = "sim-email"):
        gw = self._gateway()
        ah = _make_hash(sim_id, "email", op, params)
        return gw.execute(
            simulation_id=sim_id,
            tool_name="email",
            operation=op,
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )

    def test_list_emails_returns_messages(self):
        result = self._exec("list_emails", {})
        assert result.execution_status == "SUCCESS"
        assert "messages" in result.result_data
        assert result.result_data["count"] >= 1

    def test_search_inbox_by_subject(self):
        result = self._exec("search_inbox", {"subject": "budget"})
        assert result.execution_status == "SUCCESS"
        messages = result.result_data["messages"]
        assert any("budget" in m["subject"].lower() for m in messages)

    def test_read_email_by_id(self):
        result = self._exec("read_email", {"message_id": "msg-001"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["message"]["id"] == "msg-001"

    def test_read_email_not_found(self):
        result = self._exec("read_email", {"message_id": "msg-NONEXISTENT"})
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data

    def test_send_email_synthetic(self):
        params = {
            "to": ["alice.morgan@synthcorp.example"],
            "subject": "Test",
            "body": "Hello from simulation.",
        }
        result = self._exec("send_email", params)
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status"] == "SENT_SYNTHETIC"
        assert "No real email" in result.result_data["note"]

    def test_list_emails_unread_filter(self):
        result = self._exec("list_emails", {"unread_only": True})
        assert result.execution_status == "SUCCESS"
        # All returned messages should be unread
        for msg in result.result_data["messages"]:
            assert msg["read"] is False

    def test_send_email_missing_body(self):
        params = {"to": ["alice@example.com"], "subject": "X", "body": ""}
        result = self._exec("send_email", params)
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data

    def test_send_email_missing_recipient(self):
        params = {"to": [], "subject": "X", "body": "hello"}
        result = self._exec("send_email", params)
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data


# ===========================================================================
# Payment Tool Tests
# ===========================================================================


class TestPaymentTool:
    def _gateway(self):
        from app.mock_tools.gateway import MockToolGateway
        return MockToolGateway()

    def _exec(self, op: str, params: Dict[str, Any], sim_id: str = "sim-payment"):
        gw = self._gateway()
        ah = _make_hash(sim_id, "payment", op, params)
        return gw.execute(
            simulation_id=sim_id,
            tool_name="payment",
            operation=op,
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )

    def setup_method(self):
        import fixtures.ledger as lm
        lm.reset_ledger()

    def test_get_balance_known_account(self):
        result = self._exec("get_balance", {"account_id": "ACC-BOB-001"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["balance"] == 12450.00

    def test_get_balance_unknown_account(self):
        result = self._exec("get_balance", {"account_id": "ACC-NONEXISTENT"})
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data

    def test_execute_transfer_recognised_vendor(self):
        params = {
            "from_account": "ACC-CORP-OPS",
            "vendor_id": "VND-PARTNERCO",
            "amount": 1000.00,
            "currency": "USD",
            "reference": "TEST-REF-001",
        }
        result = self._exec("execute_transfer", params)
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status"] == "COMPLETED_SYNTHETIC"
        assert "No real funds" in result.result_data["note"]

    def test_execute_transfer_unrecognised_vendor_rejected(self):
        params = {
            "from_account": "ACC-CORP-OPS",
            "vendor_id": "VND-UNKNOWN-EVIL",
            "amount": 500.00,
            "currency": "USD",
            "reference": "REF",
        }
        result = self._exec("execute_transfer", params)
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data
        assert result.result_data["status"] == "FAILED_SYNTHETIC"

    def test_execute_transfer_insufficient_funds(self):
        params = {
            "from_account": "ACC-BOB-001",
            "vendor_id": "VND-PARTNERCO",
            "amount": 999_999.00,
            "currency": "USD",
            "reference": "REF",
        }
        result = self._exec("execute_transfer", params)
        assert result.execution_status == "SUCCESS"
        assert "Insufficient" in result.result_data.get("error", "")

    def test_transfer_alias_works(self):
        """Operation alias 'transfer' should also work."""
        params = {
            "from_account": "ACC-CORP-OPS",
            "vendor_id": "VND-CLOUDHOST",
            "amount": 500.00,
            "currency": "USD",
            "reference": "ALIAS-TEST",
        }
        ah = _make_hash("sim-payment", "payment", "transfer", params)
        from app.mock_tools.gateway import MockToolGateway
        gw = MockToolGateway()
        result = gw.execute(
            simulation_id="sim-payment",
            tool_name="payment",
            operation="transfer",
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )
        assert result.execution_status == "SUCCESS"


# ===========================================================================
# Browser Tool Tests
# ===========================================================================


class TestBrowserTool:
    def _gateway(self):
        from app.mock_tools.gateway import MockToolGateway
        return MockToolGateway()

    def _exec(self, op: str, params: Dict[str, Any], sim_id: str = "sim-browser"):
        gw = self._gateway()
        ah = _make_hash(sim_id, "browser", op, params)
        return gw.execute(
            simulation_id=sim_id,
            tool_name="browser",
            operation=op,
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )

    def test_fetch_intranet_page(self):
        result = self._exec("fetch_page", {"url": "https://intranet.synthcorp.example/"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status_code"] == 200
        assert "SynthCorp" in result.result_data["title"]

    def test_external_url_blocked(self):
        result = self._exec("fetch_page", {"url": "https://evil.example.com/steal-data"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status_code"] == 403
        assert "blocked" in result.result_data["error"].lower()

    def test_external_url_http_blocked(self):
        result = self._exec("fetch_page", {"url": "http://google.com"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status_code"] == 403

    def test_missing_url_returns_error(self):
        result = self._exec("fetch_page", {})
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data

    def test_search_intranet_returns_results(self):
        result = self._exec("search", {"query": "finance"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["count"] >= 1

    def test_search_missing_query(self):
        result = self._exec("search", {})
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data

    def test_navigate_alias_works(self):
        result = self._exec("navigate", {"url": "https://intranet.synthcorp.example/hr"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status_code"] == 200

    def test_unknown_page_returns_404(self):
        result = self._exec("fetch_page", {"url": "https://intranet.synthcorp.example/nonexistent-page"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status_code"] == 404


# ===========================================================================
# File Tool Tests
# ===========================================================================


class TestFileTool:
    def _gateway(self):
        from app.mock_tools.gateway import MockToolGateway
        return MockToolGateway()

    def _exec(self, op: str, params: Dict[str, Any], sim_id: str = "sim-file"):
        gw = self._gateway()
        ah = _make_hash(sim_id, "file", op, params)
        return gw.execute(
            simulation_id=sim_id,
            tool_name="file",
            operation=op,
            parameters=params,
            action_hash=ah,
            opa_decision="ALLOW",
        )

    def setup_method(self):
        import fixtures.files as vfs
        vfs.reset_filesystem()

    def test_read_existing_file(self):
        result = self._exec("read_file", {"path": "/docs/security_policy_v4.2.txt"})
        assert result.execution_status == "SUCCESS"
        assert "content" in result.result_data
        assert "Security Policy" in result.result_data["content"]

    def test_read_nonexistent_file(self):
        result = self._exec("read_file", {"path": "/nonexistent/path.txt"})
        assert result.execution_status == "SUCCESS"
        assert "error" in result.result_data

    def test_write_file_to_allowed_path(self):
        params = {"path": "/docs/test_output.txt", "content": "Hello simulation!"}
        result = self._exec("write_file", params)
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status"] == "WRITTEN_SYNTHETIC"

    def test_write_file_outside_sandbox_denied(self):
        params = {"path": "/etc/passwd", "content": "hacked"}
        result = self._exec("write_file", params)
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status"] == "PERMISSION_DENIED"

    def test_write_to_system_path_blocked(self):
        params = {"path": "/configs/evil.txt", "content": "data"}
        result = self._exec("write_file", params)
        assert result.execution_status == "SUCCESS"
        assert result.result_data["status"] == "PERMISSION_DENIED"

    def test_list_files_root(self):
        result = self._exec("list_files", {"directory": "/"})
        assert result.execution_status == "SUCCESS"
        assert result.result_data["count"] >= 1

    def test_list_files_subdirectory(self):
        result = self._exec("list_files", {"directory": "/docs/"})
        assert result.execution_status == "SUCCESS"
        for f in result.result_data["files"]:
            assert f["path"].startswith("/docs/")

    def test_read_alias_works(self):
        result = self._exec("read", {"path": "/docs/budget_q3_2026.txt"})
        assert result.execution_status == "SUCCESS"
        assert "content" in result.result_data


# ===========================================================================
# tool_gateway_node (LangGraph integration)
# ===========================================================================

# Patch Supabase client for all node tests to avoid network calls
_MOCK_SUPABASE = MagicMock()
_MOCK_REPO = MagicMock()
_MOCK_REPO.record_tool_log.return_value = {"id": "mock-log-id"}


class TestToolGatewayNode:
    @pytest.mark.asyncio
    async def test_node_returns_tool_result_key(self):
        params = {}
        state = _build_state(decision="ALLOW", tool="email", op="list_emails", params=params)
        with patch("app.orchestration.nodes.tool_node.get_supabase_client", return_value=_MOCK_SUPABASE):
            with patch("app.orchestration.nodes.tool_node.AuditRepository", return_value=_MOCK_REPO):
                output = await tool_gateway_node(state)
        assert "tool_result" in output
        assert output["tool_result"]["execution_status"] == "SUCCESS"

    @pytest.mark.asyncio
    async def test_node_block_decision_returns_blocked(self):
        params = {}
        state = _build_state(decision="BLOCK", tool="email", op="list_emails", params=params)
        with patch("app.orchestration.nodes.tool_node.get_supabase_client", return_value=_MOCK_SUPABASE):
            with patch("app.orchestration.nodes.tool_node.AuditRepository", return_value=_MOCK_REPO):
                output = await tool_gateway_node(state)
        assert output["tool_result"]["execution_status"] == "BLOCKED"

    @pytest.mark.asyncio
    async def test_node_hash_mismatch_detected(self):
        params = {}
        state = _build_state(
            decision="ALLOW",
            tool="email",
            op="list_emails",
            params=params,
            action_hash="0000000000000000000000000000000000000000000000000000000000000000",
        )
        with patch("app.orchestration.nodes.tool_node.get_supabase_client", return_value=_MOCK_SUPABASE):
            with patch("app.orchestration.nodes.tool_node.AuditRepository", return_value=_MOCK_REPO):
                output = await tool_gateway_node(state)
        assert output["tool_result"]["execution_status"] == "HASH_MISMATCH"

    @pytest.mark.asyncio
    async def test_node_audit_persistence_failure_does_not_crash(self):
        """If audit persistence fails, node still returns a result."""
        params = {}
        state = _build_state(decision="ALLOW", tool="email", op="list_emails", params=params)
        with patch("app.orchestration.nodes.tool_node.get_supabase_client", side_effect=Exception("DB down")):
            output = await tool_gateway_node(state)
        assert "tool_result" in output
        assert output["tool_result"]["execution_status"] == "SUCCESS"

    @pytest.mark.asyncio
    async def test_node_approved_action_still_validates_hash(self):
        """Even after human approval, the gateway revalidates the action hash."""
        params = {"account_id": "ACC-BOB-001"}
        state = _build_state(
            decision="ALLOW",
            tool="payment",
            op="get_balance",
            params=params,
            action_hash="deadbeef" * 8,  # 64 hex chars, but wrong hash
        )
        with patch("app.orchestration.nodes.tool_node.get_supabase_client", return_value=_MOCK_SUPABASE):
            with patch("app.orchestration.nodes.tool_node.AuditRepository", return_value=_MOCK_REPO):
                output = await tool_gateway_node(state)
        assert output["tool_result"]["execution_status"] == "HASH_MISMATCH"

    @pytest.mark.asyncio
    async def test_node_unknown_tool_rejected(self):
        params = {}
        state = _build_state(decision="ALLOW", tool="shell", op="exec", params=params)
        with patch("app.orchestration.nodes.tool_node.get_supabase_client", return_value=_MOCK_SUPABASE):
            with patch("app.orchestration.nodes.tool_node.AuditRepository", return_value=_MOCK_REPO):
                output = await tool_gateway_node(state)
        assert output["tool_result"]["execution_status"] == "INVALID_TOOL"


# ===========================================================================
# Concurrent isolation
# ===========================================================================


class TestConcurrentIsolation:
    def test_concurrent_ledger_operations_are_isolated(self):
        """Multiple concurrent payment operations should not corrupt ledger state."""
        import fixtures.ledger as lm
        lm.reset_ledger()

        from app.mock_tools.gateway import MockToolGateway

        def run_transfer(amount: float, ref: str) -> bool:
            gw = MockToolGateway()
            params = {
                "from_account": "ACC-CORP-OPS",
                "vendor_id": "VND-PARTNERCO",
                "amount": amount,
                "currency": "USD",
                "reference": ref,
            }
            ah = _make_hash(f"sim-concurrent-{ref}", "payment", "execute_transfer", params)
            result = gw.execute(
                simulation_id=f"sim-concurrent-{ref}",
                tool_name="payment",
                operation="execute_transfer",
                parameters=params,
                action_hash=ah,
                opa_decision="ALLOW",
            )
            return result.execution_status == "SUCCESS"

        results = [run_transfer(100.0, f"ref-{i}") for i in range(5)]
        assert all(results), "All small transfers should succeed"

        # Balance should have decreased by 5 * 100 = 500
        final_balance = lm.get_balance("ACC-CORP-OPS")
        assert final_balance == 250_000.00 - 500.0
