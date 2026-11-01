"""Tests for Phase 10 — Simulation Engine & Human-in-the-Loop Approvals (SIM-001 through SIM-006).

Coverage:
- Lifecycle state transitions & validation
- Duplicate start prevention
- Background task execution
- Concurrent independent simulations
- Human approval request creation on interrupt
- Unauthorized approval attempts
- Expired approval requests
- Duplicate approval decisions
- Action hash mismatch rejection
- Approved graph resumption -> Tool execution
- Rejected graph resumption -> Blocked
- Bounded step execution & timeout
- REST API endpoints (/api/v1/simulations, /api/v1/approvals)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import MemorySaver

from app.main import create_application
from app.orchestration.checkpointer import set_test_checkpointer, reset_checkpointer
from app.orchestration.manager import (
    SimulationManager,
    get_simulation_manager,
    reset_simulation_manager,
)
from app.schemas.common import PolicyDecisionEnum, SimulationState as SimStatusEnum


# ---------------------------------------------------------------------------
# Test Helpers & JWT Fixtures
# ---------------------------------------------------------------------------

_TEST_SECRET = "super-secret-key-that-is-at-least-32-bytes-long!"


def _generate_jwt(sub: str = "user-123", email: str = "operator@cyberhunt.io", role: str = "operator", exp_offset: int = 3600) -> str:
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "user_metadata": {"role": role, "display_name": f"Test {role.title()}"},
        "exp": int(datetime.now(timezone.utc).timestamp()) + exp_offset,
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    return jwt.encode(payload, _TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup clean in-memory checkpointer and manager for every test."""
    saver = MemorySaver()
    set_test_checkpointer(saver)
    reset_simulation_manager()
    yield
    reset_simulation_manager()
    reset_checkpointer()


@pytest.fixture
def mock_opa_service():
    """Mock OPA service for graph execution."""
    from app.security.opa_client import OPAClient

    async def _mock_evaluate(self, ctx):
        return self.evaluate_local_policy_isolated(ctx)

    with patch.object(OPAClient, "evaluate_action", new=_mock_evaluate):
        yield


# ---------------------------------------------------------------------------
# SIM-001: Lifecycle Manager Unit Tests
# ---------------------------------------------------------------------------


class TestSimulationLifecycleManager:
    def test_create_simulation_initial_state(self):
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Summarize benign document",
            step_limit=3,
        )
        assert sim["state"] == SimStatusEnum.CREATED.value
        assert sim["step_limit"] == 3
        assert sim["current_step"] == 0
        assert sim["owner_id"] == "user-1"

    def test_create_simulation_invalid_step_limit(self):
        manager = SimulationManager()
        from app.core.errors import ValidationError
        with pytest.raises(ValidationError):
            manager.create_simulation(
                owner_id="user-1",
                scenario_category="prompt_injection",
                task_summary="Task",
                step_limit=0,
            )
        with pytest.raises(ValidationError):
            manager.create_simulation(
                owner_id="user-1",
                scenario_category="prompt_injection",
                task_summary="Task",
                step_limit=25,
            )

    @pytest.mark.asyncio
    async def test_invalid_lifecycle_transitions(self):
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Task",
        )
        from app.core.errors import SimulationStateError

        # Cannot pause a CREATED simulation
        with pytest.raises(SimulationStateError):
            await manager.pause_simulation(sim["id"])

        # Cannot resume a CREATED simulation
        with pytest.raises(SimulationStateError):
            await manager.resume_simulation(sim["id"])

    @pytest.mark.asyncio
    async def test_stop_simulation(self):
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Task",
        )
        stopped = await manager.stop_simulation(sim["id"])
        assert stopped["state"] == SimStatusEnum.CANCELLED.value

        # Terminal state cannot be transitioned
        from app.core.errors import SimulationStateError
        with pytest.raises(SimulationStateError):
            await manager.start_simulation(sim["id"])

    @pytest.mark.asyncio
    async def test_pause_and_resume_simulation(self):
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Task",
        )
        # Manually set to RUNNING to test transitions
        manager._update_sim_state(sim["id"], SimStatusEnum.RUNNING.value)

        paused = await manager.pause_simulation(sim["id"])
        assert paused["state"] == SimStatusEnum.PAUSED.value

        # Resume from PAUSED
        with patch.object(manager, "_run_graph_loop", new=MagicMock(return_value=asyncio.sleep(0.01))):
            resumed = await manager.resume_simulation(sim["id"])
            assert resumed["state"] == SimStatusEnum.RUNNING.value

    @pytest.mark.asyncio
    async def test_duplicate_start_prevention(self):
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Task",
        )
        # First start succeeds
        with patch.object(manager, "_run_graph_loop", new=MagicMock(return_value=asyncio.sleep(10))):
            await manager.start_simulation(sim["id"])
            assert manager.get_simulation(sim["id"])["state"] == SimStatusEnum.RUNNING.value

            # Second start must fail with SimulationStateError
            from app.core.errors import SimulationStateError
            with pytest.raises(SimulationStateError):
                await manager.start_simulation(sim["id"])


# ---------------------------------------------------------------------------
# SIM-003 & SIM-004: Background Execution & Human Approval Workflow
# ---------------------------------------------------------------------------


class TestBackgroundExecutionAndApproval:
    @pytest.mark.asyncio
    async def test_benign_simulation_runs_to_completion(self, mock_opa_service):
        """Benign simulation executes in background and completes."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Check inbox for announcements",
            step_limit=1,
            initial_input="Hello, please check the inbox.",
        )

        await manager.start_simulation(sim["id"])

        # Wait for background task to complete
        task = manager._tasks.get(sim["id"])
        if task:
            await task

        updated = manager.get_simulation(sim["id"])
        assert updated["state"] == SimStatusEnum.COMPLETED.value
        assert updated["current_step"] >= 1
        assert "total_rounds" in updated["final_metrics"]

    @pytest.mark.asyncio
    async def test_approval_workflow_interrupt_and_resumption(self, mock_opa_service):
        """High-impact action hits interrupt, creates approval request, resumes on APPROVED decision."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="privilege_escalation",
            task_summary="Execute funds transfer",
            step_limit=1,
            initial_input="Transfer payment of 5000 to vendor",
        )

        await manager.start_simulation(sim["id"])

        # Wait for initial run to pause at interrupt
        task = manager._tasks.get(sim["id"])
        if task:
            await task

        paused_sim = manager.get_simulation(sim["id"])
        assert paused_sim["state"] == SimStatusEnum.AWAITING_APPROVAL.value

        # Verify approval request was created
        pending = [
            req for req in manager._mem_approvals.values()
            if req.get("simulation_id") == sim["id"] and req.get("decision") == "PENDING"
        ]
        assert len(pending) == 1
        app_req = pending[0]
        assert "action_hash" in app_req
        assert len(app_req["action_hash"]) == 64

        # Resume with APPROVED decision
        await manager.submit_approval_decision(
            approval_id=app_req["id"],
            decision="APPROVED",
            action_hash=app_req["action_hash"],
            approver_id="approver-1",
            reason="Verified vendor and amount",
        )

        # Wait for resumed background task
        resumed_task = manager._tasks.get(sim["id"])
        if resumed_task:
            await resumed_task

        completed_sim = manager.get_simulation(sim["id"])
        assert completed_sim["state"] == SimStatusEnum.COMPLETED.value

    @pytest.mark.asyncio
    async def test_approval_workflow_rejected_bypasses_tool(self, mock_opa_service):
        """Rejected approval action routes to BLOCK and bypasses Tool Gateway."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="privilege_escalation",
            task_summary="Execute suspicious payment",
            step_limit=1,
            initial_input="Transfer payment to unknown recipient",
        )

        await manager.start_simulation(sim["id"])
        task = manager._tasks.get(sim["id"])
        if task:
            await task

        pending = [
            req for req in manager._mem_approvals.values()
            if req.get("simulation_id") == sim["id"] and req.get("decision") == "PENDING"
        ]
        assert len(pending) == 1
        app_req = pending[0]

        # Resume with REJECTED decision
        await manager.submit_approval_decision(
            approval_id=app_req["id"],
            decision="REJECTED",
            action_hash=app_req["action_hash"],
            approver_id="approver-1",
            reason="Unrecognized recipient",
        )

        resumed_task = manager._tasks.get(sim["id"])
        if resumed_task:
            await resumed_task

        completed_sim = manager.get_simulation(sim["id"])
        assert completed_sim["state"] == SimStatusEnum.COMPLETED.value

    @pytest.mark.asyncio
    async def test_tampered_action_hash_rejected(self):
        """Submitting an approval with a tampered action hash is strictly rejected."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="privilege_escalation",
            task_summary="Action",
        )
        manager._update_sim_state(sim["id"], SimStatusEnum.AWAITING_APPROVAL.value)

        # Create pending approval
        app_data = {
            "simulation_id": sim["id"],
            "action_id": "act-1",
            "action_hash": "a" * 64,
            "decision": "PENDING",
            "expiry_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        }
        req = manager._save_approval_request(app_data)

        from app.core.errors import ValidationError
        with pytest.raises(ValidationError):
            await manager.submit_approval_decision(
                approval_id=req["id"],
                decision="APPROVED",
                action_hash="b" * 64,  # Mismatch!
                approver_id="approver-1",
            )

    @pytest.mark.asyncio
    async def test_expired_approval_rejected(self):
        """Expired approval requests cannot be resolved."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="privilege_escalation",
            task_summary="Action",
        )
        manager._update_sim_state(sim["id"], SimStatusEnum.AWAITING_APPROVAL.value)

        # Create expired approval
        app_data = {
            "simulation_id": sim["id"],
            "action_id": "act-1",
            "action_hash": "a" * 64,
            "decision": "PENDING",
            "expiry_time": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),  # Past
        }
        req = manager._save_approval_request(app_data)

        from app.core.errors import ValidationError
        with pytest.raises(ValidationError):
            await manager.submit_approval_decision(
                approval_id=req["id"],
                decision="APPROVED",
                action_hash="a" * 64,
                approver_id="approver-1",
            )

    @pytest.mark.asyncio
    async def test_duplicate_approval_decision_rejected(self):
        """Resolving an already resolved approval request is rejected."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="privilege_escalation",
            task_summary="Action",
        )
        manager._update_sim_state(sim["id"], SimStatusEnum.AWAITING_APPROVAL.value)

        app_data = {
            "simulation_id": sim["id"],
            "action_id": "act-1",
            "action_hash": "c" * 64,
            "decision": "APPROVED",  # Already resolved
            "expiry_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        }
        req = manager._save_approval_request(app_data)

        from app.core.errors import SimulationStateError
        with pytest.raises(SimulationStateError):
            await manager.submit_approval_decision(
                approval_id=req["id"],
                decision="APPROVED",
                action_hash="c" * 64,
                approver_id="approver-1",
            )


# ---------------------------------------------------------------------------
# SIM-002 & SIM-005: REST API Integration Tests
# ---------------------------------------------------------------------------


class TestSimulationRESTAPI:
    @pytest.fixture
    def client(self):
        app = create_application()
        return TestClient(app)

    def test_create_simulation_endpoint(self, client):
        token = _generate_jwt(sub="user-123", role="operator")
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "scenario_category": "direct_prompt_injection",
            "task_summary": "Summarize inbox emails",
            "step_limit": 3,
        }
        resp = client.post("/api/v1/simulations", json=payload, headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "success"
        assert data["data"]["state"] == "CREATED"
        assert data["data"]["step_limit"] == 3

    def test_create_simulation_unauthenticated(self, client):
        resp = client.post("/api/v1/simulations", json={"scenario_category": "x", "task_summary": "y"})
        assert resp.status_code == 401

    def test_start_simulation_endpoint(self, client, mock_opa_service):
        token = _generate_jwt(sub="user-123", role="operator")
        headers = {"Authorization": f"Bearer {token}"}

        # Create
        create_resp = client.post(
            "/api/v1/simulations",
            json={"scenario_category": "prompt_injection", "task_summary": "Task", "step_limit": 1},
            headers=headers,
        )
        sim_id = create_resp.json()["data"]["id"]

        # Start
        start_resp = client.post(f"/api/v1/simulations/{sim_id}/start", headers=headers)
        assert start_resp.status_code == 200
        assert start_resp.json()["data"]["state"] == "RUNNING"

    def test_pause_and_resume_endpoints(self, client):
        token = _generate_jwt(sub="user-123", role="operator")
        headers = {"Authorization": f"Bearer {token}"}

        # Create and set to RUNNING
        create_resp = client.post(
            "/api/v1/simulations",
            json={"scenario_category": "prompt_injection", "task_summary": "Task", "step_limit": 2},
            headers=headers,
        )
        sim_id = create_resp.json()["data"]["id"]
        manager = get_simulation_manager()
        manager._update_sim_state(sim_id, SimStatusEnum.RUNNING.value)

        # Pause
        pause_resp = client.post(f"/api/v1/simulations/{sim_id}/pause", headers=headers)
        assert pause_resp.status_code == 200
        assert pause_resp.json()["data"]["state"] == "PAUSED"

        # Resume
        resume_resp = client.post(f"/api/v1/simulations/{sim_id}/resume", headers=headers)
        assert resume_resp.status_code == 200
        assert resume_resp.json()["data"]["state"] == "RUNNING"

    def test_stop_endpoint(self, client):
        token = _generate_jwt(sub="user-123", role="operator")
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = client.post(
            "/api/v1/simulations",
            json={"scenario_category": "prompt_injection", "task_summary": "Task"},
            headers=headers,
        )
        sim_id = create_resp.json()["data"]["id"]

        stop_resp = client.post(f"/api/v1/simulations/{sim_id}/stop", headers=headers)
        assert stop_resp.status_code == 200
        assert stop_resp.json()["data"]["state"] == "CANCELLED"

    def test_get_simulation_not_found(self, client):
        token = _generate_jwt(sub="user-123", role="operator")
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/v1/simulations/nonexistent-id", headers=headers)
        assert resp.status_code == 404

    def test_approval_decision_rbac_forbidden_for_operator(self, client):
        """Operators cannot approve sensitive actions — requires approver or admin role."""
        token = _generate_jwt(sub="user-123", role="operator")  # Operator, not approver
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post(
            "/api/v1/approvals/app-1/decision",
            json={"decision": "APPROVED", "action_hash": "a" * 64},
            headers=headers,
        )
        assert resp.status_code == 403

    def test_approval_decision_success_for_approver(self, client):
        """Approvers can submit decisions with correct action hash."""
        manager = get_simulation_manager()
        sim = manager.create_simulation(owner_id="user-1", scenario_category="payment", task_summary="Transfer")
        manager._update_sim_state(sim["id"], SimStatusEnum.AWAITING_APPROVAL.value)

        app_data = {
            "simulation_id": sim["id"],
            "action_id": "act-101",
            "action_hash": "f" * 64,
            "decision": "PENDING",
            "expiry_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        }
        req = manager._save_approval_request(app_data)

        token = _generate_jwt(sub="approver-42", role="approver")
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post(
            f"/api/v1/approvals/{req['id']}/decision",
            json={"decision": "APPROVED", "action_hash": "f" * 64, "reason": "Authorized by Finance"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["decision"] == "APPROVED"

    def test_list_simulations_endpoint(self, client):
        """GET /api/v1/simulations returns a list owned by the authenticated user."""
        token = _generate_jwt(sub="user-list-test", role="operator")
        headers = {"Authorization": f"Bearer {token}"}
        create_resp = client.post(
            "/api/v1/simulations",
            json={
                "scenario_category": "prompt_injection",
                "task_summary": "List test task",
                "step_limit": 3,
            },
            headers=headers,
        )
        assert create_resp.status_code == 201
        list_resp = client.get("/api/v1/simulations?limit=10", headers=headers)
        assert list_resp.status_code == 200
        data = list_resp.json()["data"]
        assert isinstance(data, list)
        assert any(s["task_summary"] == "List test task" for s in data)


# ---------------------------------------------------------------------------
# SIM-006: Bounded Execution Limits
# ---------------------------------------------------------------------------


class TestBoundedExecution:
    @pytest.mark.asyncio
    async def test_timeout_sets_failed_status(self):
        """Simulations that exceed timeout terminate with FAILED status."""
        manager = SimulationManager(default_timeout_seconds=0.01)  # 10ms timeout
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Slow task",
            step_limit=5,
        )

        async def _mock_slow_graph(*args, **kwargs):
            await asyncio.sleep(1.0)
            return {"status": "RUNNING", "current_step": 1}

        with patch("app.orchestration.manager.build_simulation_graph") as mock_graph_factory:
            mock_graph = MagicMock()
            mock_graph.ainvoke = _mock_slow_graph
            mock_graph_factory.return_value = mock_graph

            await manager.start_simulation(sim["id"])
            task = manager._tasks.get(sim["id"])
            if task:
                await task

        failed_sim = manager.get_simulation(sim["id"])
        assert failed_sim["state"] == SimStatusEnum.FAILED.value


# ---------------------------------------------------------------------------
# SIM-001 & SIM-008: Concurrency & Restart Recovery
# ---------------------------------------------------------------------------


class TestConcurrencyAndRecovery:
    @pytest.mark.asyncio
    async def test_concurrent_simulations_independent(self, mock_opa_service):
        """Multiple independent simulations can run concurrently without state bleed."""
        manager = SimulationManager()
        sim1 = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Task 1",
            step_limit=1,
            initial_input="Check inbox 1",
        )
        sim2 = manager.create_simulation(
            owner_id="user-2",
            scenario_category="prompt_injection",
            task_summary="Task 2",
            step_limit=1,
            initial_input="Check inbox 2",
        )

        await manager.start_simulation(sim1["id"])
        await manager.start_simulation(sim2["id"])

        task1 = manager._tasks.get(sim1["id"])
        task2 = manager._tasks.get(sim2["id"])

        if task1 and task2:
            await asyncio.gather(task1, task2)

        s1 = manager.get_simulation(sim1["id"])
        s2 = manager.get_simulation(sim2["id"])

        assert s1["state"] == SimStatusEnum.COMPLETED.value
        assert s2["state"] == SimStatusEnum.COMPLETED.value
        assert s1["id"] != s2["id"]

    @pytest.mark.asyncio
    async def test_approval_recovery_after_backend_restart(self, mock_opa_service):
        """Interrupted approval states can be reloaded and resumed after manager reset."""
        # Shared saver represents persistent checkpointer across restarts
        shared_saver = MemorySaver()
        set_test_checkpointer(shared_saver)

        manager1 = SimulationManager()
        sim = manager1.create_simulation(
            owner_id="user-1",
            scenario_category="privilege_escalation",
            task_summary="Payment needing approval",
            step_limit=1,
            initial_input="Transfer payment of 5000 to vendor",
        )

        await manager1.start_simulation(sim["id"])
        task = manager1._tasks.get(sim["id"])
        if task:
            await task

        paused_sim = manager1.get_simulation(sim["id"])
        assert paused_sim["state"] == SimStatusEnum.AWAITING_APPROVAL.value

        pending = [
            req for req in manager1._mem_approvals.values()
            if req.get("simulation_id") == sim["id"] and req.get("decision") == "PENDING"
        ]
        app_req = pending[0]

        # Simulate backend restart: reset manager, instantiate manager2 sharing memory/checkpointer
        reset_simulation_manager()
        set_test_checkpointer(shared_saver)

        manager2 = SimulationManager()
        # Seed manager2 memory with persisted simulation and approval records
        manager2._mem_simulations[sim["id"]] = paused_sim
        manager2._mem_approvals[app_req["id"]] = app_req

        # Resolve on restarted instance
        await manager2.submit_approval_decision(
            approval_id=app_req["id"],
            decision="APPROVED",
            action_hash=app_req["action_hash"],
            approver_id="admin-99",
            reason="Approved after restart verification",
        )

        resumed_task = manager2._tasks.get(sim["id"])
        if resumed_task:
            await resumed_task

        completed = manager2.get_simulation(sim["id"])
        assert completed["state"] == SimStatusEnum.COMPLETED.value
