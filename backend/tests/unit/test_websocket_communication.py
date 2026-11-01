"""Tests for Phase 11 — Real-Time Communication (WS-001 through WS-006, TEST-006).

Coverage:
- Standardized SimulationEvent schema & 14 PRD event types (WS-001)
- WebSocket connection, communication, and graceful disconnection (WS-002)
- Multi-client subscription to same simulation (WS-002)
- Simulation-specific event isolation (no cross-simulation leaks) (WS-002)
- Heartbeat ping/pong handling (WS-006)
- Event replay with after_sequence parameter for reconnect recovery (WS-005)
- Non-blocking client disconnection: backend execution continues safely (WS-003)
- Granular agent and OPA event broadcasting (WS-003)
- Future real-time Gmail event injection compatibility hook (Section 5)
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import MemorySaver

from app.main import create_application
from app.orchestration.checkpointer import reset_checkpointer, set_test_checkpointer
from app.orchestration.manager import SimulationManager, reset_simulation_manager
from app.schemas.event import EventType, SimulationEvent
from app.websocket.broadcaster import (
    clear_in_memory_events,
    emit_simulation_event,
    get_in_memory_events,
)
from app.websocket.manager import (
    ConnectionManager,
    get_connection_manager,
    reset_connection_manager,
)


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup clean checkpointer, manager, and connection manager."""
    saver = MemorySaver()
    set_test_checkpointer(saver)
    reset_simulation_manager()
    reset_connection_manager()
    clear_in_memory_events()
    yield
    reset_simulation_manager()
    reset_connection_manager()
    reset_checkpointer()
    clear_in_memory_events()


@pytest.fixture
def mock_opa_service():
    """Mock OPA service for graph execution."""
    from app.security.opa_client import OPAClient

    async def _mock_evaluate(self, ctx):
        return self.evaluate_local_policy_isolated(ctx)

    with patch.object(OPAClient, "evaluate_action", new=_mock_evaluate):
        yield


# ---------------------------------------------------------------------------
# WS-001: Schema & Event Types Verification
# ---------------------------------------------------------------------------


class TestSimulationEventSchema:
    def test_all_14_prd_event_types_defined(self):
        expected_types = {
            "simulation.created",
            "simulation.status_changed",
            "red_team.attack_generated",
            "target_ai.response_ready",
            "target_ai.action_proposed",
            "guardian.analysis_completed",
            "policy.decision_made",
            "approval.requested",
            "approval.resolved",
            "tool.executed",
            "tool.blocked",
            "score.updated",
            "simulation.completed",
            "simulation.failed",
        }
        actual_types = {e.value for e in EventType}
        for expected in expected_types:
            assert expected in actual_types, f"Missing PRD event type: {expected}"

    def test_simulation_event_envelope_structure(self):
        event = SimulationEvent(
            simulation_id="sim-test-123",
            sequence_number=1,
            event_type=EventType.POLICY_DECISION_MADE.value,
            payload={"decision": "ALLOW", "tool": "email"},
        )
        data = event.model_dump()
        assert "event_id" in data
        assert data["simulation_id"] == "sim-test-123"
        assert data["sequence_number"] == 1
        assert data["event_type"] == "policy.decision_made"
        assert data["schema_version"] == "1.0"
        assert "timestamp" in data
        assert data["payload"]["decision"] == "ALLOW"


# ---------------------------------------------------------------------------
# WS-002 & WS-006: ConnectionManager & WebSocket Tests
# ---------------------------------------------------------------------------


class TestWebSocketConnection:
    @pytest.fixture
    def client(self):
        app = create_application()
        return TestClient(app)

    def test_websocket_connect_and_disconnect(self, client):
        """Client connects, stays open, and disconnects gracefully."""
        sim_id = "sim-ws-1"
        cm = get_connection_manager()
        assert cm.get_active_count(sim_id) == 0

        with client.websocket_connect(f"/api/v1/ws/simulations/{sim_id}"):
            assert cm.get_active_count(sim_id) == 1

        # After context exit, client is disconnected
        assert cm.get_active_count(sim_id) == 0

    def test_heartbeat_ping_pong(self, client):
        """Client sends ping heartbeat, receives immediate pong response."""
        sim_id = "sim-ping-1"
        with client.websocket_connect(f"/api/v1/ws/simulations/{sim_id}") as ws:
            ws.send_text(json.dumps({"type": "ping"}))
            response = ws.receive_json()
            assert response["type"] == EventType.PONG.value
            assert response["simulation_id"] == sim_id
            assert "timestamp" in response

    def test_multiple_clients_same_simulation(self, client):
        """Multiple dashboard clients can subscribe to the same simulation stream."""
        sim_id = "sim-multi-client"
        cm = get_connection_manager()

        with client.websocket_connect(f"/api/v1/ws/simulations/{sim_id}"):
            with client.websocket_connect(f"/api/v1/ws/simulations/{sim_id}"):
                assert cm.get_active_count(sim_id) == 2
            assert cm.get_active_count(sim_id) == 1

        assert cm.get_active_count(sim_id) == 0

    def test_simulation_event_isolation(self, client):
        """Clients of sim-A must NEVER receive events destined for sim-B."""
        sim_a = "sim-isolated-a"
        sim_b = "sim-isolated-b"

        with client.websocket_connect(f"/api/v1/ws/simulations/{sim_a}") as ws_a:
            with client.websocket_connect(f"/api/v1/ws/simulations/{sim_b}") as ws_b:
                cm = get_connection_manager()

                # Broadcast to sim_a only
                event_a = SimulationEvent(
                    simulation_id=sim_a,
                    sequence_number=1,
                    event_type=EventType.POLICY_DECISION_MADE.value,
                    payload={"note": "Secret for A"},
                )
                asyncio.run(cm.broadcast(sim_a, event_a))

                # ws_a receives event_a
                msg_a = ws_a.receive_json()
                assert msg_a["simulation_id"] == sim_a
                assert msg_a["payload"]["note"] == "Secret for A"

                # Broadcast ping to ws_b to verify it is responsive and has not received event_a
                ws_b.send_text(json.dumps({"type": "ping"}))
                msg_b = ws_b.receive_json()
                # ws_b received pong, not event_a
                assert msg_b["type"] == EventType.PONG.value


# ---------------------------------------------------------------------------
# WS-003 & WS-004: Event Broadcaster & Replay
# ---------------------------------------------------------------------------


class TestBroadcasterAndReplay:
    @pytest.fixture
    def client(self):
        app = create_application()
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_emit_simulation_event_monotonic_sequence(self):
        """Broadcaster increments sequence numbers monotonically."""
        sim_id = "sim-seq-test"
        e1 = await emit_simulation_event(
            simulation_id=sim_id,
            event_type=EventType.SIMULATION_CREATED,
            payload={"step": 0},
        )
        e2 = await emit_simulation_event(
            simulation_id=sim_id,
            event_type=EventType.SIMULATION_STATUS_CHANGED,
            payload={"status": "RUNNING"},
        )
        e3 = await emit_simulation_event(
            simulation_id=sim_id,
            event_type=EventType.POLICY_DECISION_MADE,
            payload={"decision": "ALLOW"},
        )

        assert e1.sequence_number == 1
        assert e2.sequence_number == 2
        assert e3.sequence_number == 3

    def test_event_replay_endpoint_with_after_sequence(self, client):
        """GET /api/v1/simulations/{id}/events returns ordered events and respects after_sequence."""
        sim_id = "sim-replay-100"

        # Emit 4 events
        for i in range(1, 5):
            asyncio.run(
                emit_simulation_event(
                    simulation_id=sim_id,
                    event_type=EventType.SIMULATION_STATUS_CHANGED,
                    payload={"step": i},
                )
            )

        # Replay all
        resp_all = client.get(f"/api/v1/simulations/{sim_id}/events")
        assert resp_all.status_code == 200
        data_all = resp_all.json()["data"]
        assert data_all["total_events"] == 4
        assert [e["sequence_number"] for e in data_all["events"]] == [1, 2, 3, 4]

        # Replay with after_sequence=2 (simulates client reconnect recovery after sequence 2)
        resp_after = client.get(f"/api/v1/simulations/{sim_id}/events?after_sequence=2")
        assert resp_after.status_code == 200
        data_after = resp_after.json()["data"]
        assert data_after["total_events"] == 2
        assert [e["sequence_number"] for e in data_after["events"]] == [3, 4]


# ---------------------------------------------------------------------------
# Resilient Disconnection: Backend Execution Continues Safely
# ---------------------------------------------------------------------------


class TestResilientExecutionOnDisconnect:
    @pytest.fixture
    def client(self):
        app = create_application()
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_backend_continues_when_client_disconnects_mid_simulation(self, client, mock_opa_service):
        """If a dashboard client closes connection mid-run, backend simulation completes normally."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Check inbox",
            step_limit=1,
            initial_input="Hello",
        )
        sim_id = sim["id"]

        # Client connects to WebSocket stream
        with client.websocket_connect(f"/api/v1/ws/simulations/{sim_id}"):
            # Start simulation while client is connected
            await manager.start_simulation(sim_id)
            # Client abruptly disconnects (exiting context manager)

        # Simulation task must continue executing in background
        task = manager._tasks.get(sim_id)
        if task:
            await task

        # Verification: Simulation finished with COMPLETED status
        completed = manager.get_simulation(sim_id)
        assert completed["state"] == "COMPLETED"

    @pytest.mark.asyncio
    async def test_broadcast_to_closed_socket_does_not_raise(self):
        """Broadcasting to a closed/failed socket prunes connection cleanly without error."""
        cm = ConnectionManager()
        sim_id = "sim-dead-socket"

        # Mock a broken websocket whose send_text raises an exception
        broken_ws = MagicMock()
        broken_ws.send_text.side_effect = ConnectionResetError("Broken pipe")

        cm._subscriptions[sim_id] = {broken_ws}
        assert cm.get_active_count(sim_id) == 1

        event = SimulationEvent(
            simulation_id=sim_id,
            sequence_number=1,
            event_type=EventType.SIMULATION_STATUS_CHANGED.value,
            payload={},
        )

        # Must not raise
        await cm.broadcast(sim_id, event)

        # Broken socket must be pruned
        assert cm.get_active_count(sim_id) == 0


# ---------------------------------------------------------------------------
# Section 5: Future Real-Time Gmail Compatibility Hook
# ---------------------------------------------------------------------------


class TestGmailCompatibilityHook:
    @pytest.mark.asyncio
    async def test_inject_incoming_email_event(self):
        """Future real-time Gmail event hook broadcasts email.received and sanitizes sensitive data."""
        manager = SimulationManager()
        sim = manager.create_simulation(
            owner_id="user-1",
            scenario_category="prompt_injection",
            task_summary="Analyze incoming email",
        )
        sim_id = sim["id"]

        email_payload = {
            "from": "alice@partner.example",
            "subject": "Urgent Contract Update",
            "body": "Please review the updated agreement attached.",
            "secret_token": "SHOULD_NOT_LEAK",
        }

        injected = await manager.inject_incoming_email(sim_id, email_payload)
        assert injected["from"] == "alice@partner.example"
        assert injected["subject"] == "Urgent Contract Update"
        assert "secret_token" not in injected

        # Verify event was broadcast into event stream
        events = get_in_memory_events(sim_id)
        email_events = [e for e in events if e.get("event_type") == EventType.EMAIL_RECEIVED.value]
        assert len(email_events) == 1
        assert email_events[0]["payload"]["subject"] == "Urgent Contract Update"

