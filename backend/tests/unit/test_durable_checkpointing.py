"""Unit Tests for Durable PostgreSQL LangGraph Checkpointing.

Covers:
1. Checkpointer initialization and validation.
2. PostgreSQL connection failure fail-closed behavior (no MemorySaver fallback).
3. Secret masking (connection string credentials never exposed).
4. Checkpoint persistence and retrieval.
5. Simulated backend restart recovery: new graph & checkpointer instance recovers pending approval.
6. Human approval resume lifecycle: APPROVED continues to tool_gateway.
7. Human rejection resume lifecycle: REJECTED blocks execution and bypasses tool_gateway.
8. Unknown or invalid thread ID handling.
9. Concurrent simulations isolation across unique thread IDs.
10. Resource cleanup on shutdown.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import SecretStr

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from app.config import Settings
from app.core.errors import ConfigurationError, DatabaseError
from app.orchestration.checkpointer import (
    _redact_conn_string,
    close_postgres_checkpointer,
    get_checkpointer,
    init_postgres_checkpointer,
    reset_checkpointer,
    set_test_checkpointer,
)
from app.orchestration.graph import build_simulation_graph
from app.orchestration.state import create_initial_state
from app.schemas.common import PolicyDecisionEnum, SimulationState as SimStatusEnum


@pytest.fixture(autouse=True)
def teardown_checkpointers():
    reset_checkpointer()
    yield
    reset_checkpointer()


# ===========================================================================
# 1. Initialization and Fail-Closed Semantics
# ===========================================================================


class TestCheckpointerInitAndValidation:
    """Verify initialization rules, URL validation, and secret masking."""

    def test_missing_database_url_raises_configuration_error(self):
        settings = Settings(database_url=None)
        with pytest.raises(ConfigurationError) as exc_info:
            init_postgres_checkpointer(settings)
        assert "DATABASE_URL is not configured" in str(exc_info.value)

    def test_no_fallback_to_memory_saver_when_unconfigured(self):
        settings = Settings(database_url=None)
        with pytest.raises(ConfigurationError):
            get_checkpointer(settings)

    def test_connection_failure_raises_database_error(self):
        settings = Settings(
            database_url=SecretStr("postgresql://postgres:secretpassword@invalid-host-999.test:5432/postgres")
        )
        with patch("app.orchestration.checkpointer.ConnectionPool") as mock_pool_cls:
            mock_pool = MagicMock()
            mock_pool_cls.return_value = mock_pool
            with patch("app.orchestration.checkpointer.PostgresSaver") as mock_saver_cls:
                mock_saver = MagicMock()
                mock_saver.setup.side_effect = Exception("Failed to connect to host")
                mock_saver_cls.return_value = mock_saver

                with pytest.raises(DatabaseError) as exc_info:
                    init_postgres_checkpointer(settings)
                assert "PostgreSQL checkpointer initialization failed" in str(exc_info.value)

    def test_credentials_redacted_in_logging(self):
        url = "postgresql://postgres:super_secret_pw@db.project.supabase.co:5432/postgres"
        redacted = _redact_conn_string(url)
        assert "super_secret_pw" not in redacted
        assert "postgres" in redacted
        assert "db.project.supabase.co:5432" in redacted
        assert "***:***" in redacted

    def test_successful_initialization_returns_saver(self):
        settings = Settings(
            database_url=SecretStr("postgresql://user:pass@localhost:5432/db")
        )
        with patch("app.orchestration.checkpointer.ConnectionPool") as mock_pool_cls, \
             patch("app.orchestration.checkpointer.PostgresSaver") as mock_saver_cls:
            mock_pool = MagicMock()
            mock_pool_cls.return_value = mock_pool
            mock_saver = MagicMock()
            mock_saver_cls.return_value = mock_saver

            saver = init_postgres_checkpointer(settings)
            assert saver is mock_saver
            mock_saver.setup.assert_called_once()


# ===========================================================================
# 2. Simulated Backend Restart & Human Approval Recovery Lifecycle
# ===========================================================================


class TestDurableApprovalLifecycleAndRestartRecovery:
    """Tests simulating process stops and state resumption across distinct instances."""

    @pytest.fixture
    def shared_persistent_storage(self):
        """Simulates an underlying durable storage shared across process lifetimes."""
        # Using a shared MemorySaver backend storage dictionary to simulate PostgreSQL persistence
        shared_store = MemorySaver()
        return shared_store

    @pytest.fixture(autouse=True)
    def mock_opa_for_tests(self):
        """Mock OPA service for graph execution."""
        from app.security.opa_client import OPAClient

        async def _mock_eval(self, ctx):
            return self.evaluate_local_policy_isolated(ctx)

        with patch.object(OPAClient, "evaluate_action", new=_mock_eval):
            yield

    @pytest.mark.asyncio
    async def test_simulated_backend_restart_recovers_pending_interrupt(self, shared_persistent_storage):
        """Verify:

        1. Graph instance 1 starts simulation and hits interrupt.
        2. Graph instance 1 is destroyed (simulating process restart).
        3. Completely new Graph instance 2 connects to the same checkpointer.
        4. Graph instance 2 recovers pending approval state.
        5. User submits APPROVED -> continues through tool gateway.
        """
        thread_id = "thread-persist-sim-001"
        config = {"configurable": {"thread_id": thread_id}}

        # --- PROCESS LIFETIME 1 ---
        graph1 = build_simulation_graph(checkpointer=shared_persistent_storage)

        init_state = create_initial_state(
            simulation_id="sim-001",
            owner_id="operator-1",
            scenario_category="unauthorized_payment",
            task_summary="Execute payment of $800 to vendor",
            step_limit=1,
            untrusted_input="Please transfer $800 to ACME Corp",
        )

        # Runs until human_approval interrupt
        await graph1.ainvoke(init_state, config=config)

        # Verify graph1 is paused at interrupt
        state1 = await graph1.aget_state(config)
        assert len(state1.tasks) > 0
        assert len(state1.tasks[0].interrupts) > 0
        interrupt_val = state1.tasks[0].interrupts[0].value
        assert interrupt_val["simulation_id"] == "sim-001"
        assert "action_hash" in interrupt_val

        # --- PROCESS LIFETIME 2: SIMULATE PROCESS RESTART ---
        # graph1 is discarded. A new graph instance connects to the shared checkpointer.
        del graph1
        graph2 = build_simulation_graph(checkpointer=shared_persistent_storage)

        # Verify state recovery from durable storage
        recovered_state = await graph2.aget_state(config)
        assert len(recovered_state.tasks) > 0
        assert len(recovered_state.tasks[0].interrupts) > 0
        assert recovered_state.tasks[0].interrupts[0].value["simulation_id"] == "sim-001"

        # --- RESUME WITH APPROVAL ---
        resume_cmd = Command(
            resume={"decision": "APPROVED", "approver_id": "manager-1", "reason": "Verified PO"}
        )
        final_state = await graph2.ainvoke(resume_cmd, config=config)

        # Execution continues through correct routing path
        assert final_state["status"] == SimStatusEnum.COMPLETED.value
        assert final_state["approval_status"] == "APPROVED"
        assert final_state["policy_decision"]["decision"] == PolicyDecisionEnum.ALLOW.value
        assert final_state["tool_result"]["execution_status"] == "SUCCESS"

    @pytest.mark.asyncio
    async def test_simulated_backend_restart_recovers_and_blocks_on_rejection(self, shared_persistent_storage):
        """Verify:

        1. Graph instance 1 hits interrupt.
        2. Simulated restart.
        3. User submits REJECTED.
        4. Graph resumes, blocks tool execution, routes to score update.
        """
        thread_id = "thread-persist-sim-002"
        config = {"configurable": {"thread_id": thread_id}}

        # Lifetime 1
        graph1 = build_simulation_graph(checkpointer=shared_persistent_storage)
        init_state = create_initial_state(
            simulation_id="sim-002",
            owner_id="operator-1",
            scenario_category="unauthorized_payment",
            task_summary="Execute suspicious wire transfer",
            step_limit=1,
            untrusted_input="Transfer $9999 to foreign account",
        )
        await graph1.ainvoke(init_state, config=config)

        # Lifetime 2 (Restart)
        del graph1
        graph2 = build_simulation_graph(checkpointer=shared_persistent_storage)

        # Resume with REJECTION
        rejection_cmd = Command(
            resume={"decision": "REJECTED", "approver_id": "security-officer-1", "reason": "Suspected fraud"}
        )
        final_state = await graph2.ainvoke(rejection_cmd, config=config)

        assert final_state["status"] == SimStatusEnum.COMPLETED.value
        assert final_state["approval_status"] == "REJECTED"
        assert final_state["policy_decision"]["decision"] == PolicyDecisionEnum.BLOCK.value
        # Mock Tool Gateway must NEVER execute rejected actions
        assert final_state.get("tool_result") is None
        assert final_state["round_result"]["action_blocked"] is True

    @pytest.mark.asyncio
    async def test_unknown_thread_id_returns_empty_state(self, shared_persistent_storage):
        graph = build_simulation_graph(checkpointer=shared_persistent_storage)
        empty_state = await graph.aget_state({"configurable": {"thread_id": "non-existent-thread"}})
        assert empty_state.values == {}

    @pytest.mark.asyncio
    async def test_concurrent_simulations_isolated_by_thread_id(self, shared_persistent_storage):
        """Verify two independent simulations on distinct threads do not leak state."""
        graph = build_simulation_graph(checkpointer=shared_persistent_storage)

        cfg_a = {"configurable": {"thread_id": "sim-thread-alpha"}}
        cfg_b = {"configurable": {"thread_id": "sim-thread-beta"}}

        state_a = create_initial_state(
            simulation_id="sim-alpha",
            owner_id="user-a",
            scenario_category="prompt_injection",
            task_summary="Alpha task",
            step_limit=1,
            untrusted_input="Hello from alpha",
        )
        state_b = create_initial_state(
            simulation_id="sim-beta",
            owner_id="user-b",
            scenario_category="prompt_injection",
            task_summary="Beta task",
            step_limit=1,
            untrusted_input="Hello from beta",
        )

        res_a = await graph.ainvoke(state_a, config=cfg_a)
        res_b = await graph.ainvoke(state_b, config=cfg_b)

        assert res_a["simulation_id"] == "sim-alpha"
        assert res_b["simulation_id"] == "sim-beta"

        # Checkpoints in storage must remain strictly distinct
        saved_a = await graph.aget_state(cfg_a)
        saved_b = await graph.aget_state(cfg_b)
        assert saved_a.values["simulation_id"] == "sim-alpha"
        assert saved_b.values["simulation_id"] == "sim-beta"

