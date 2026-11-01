"""Unit tests for DB-005 — Repositories (backend/app/db/repositories/)."""

from unittest.mock import MagicMock
import pytest

from app.core.errors import DatabaseError
from app.db.repositories.profile_repo import ProfileRepository
from app.db.repositories.simulation_repo import SimulationRepository
from app.db.repositories.event_repo import EventRepository
from app.db.repositories.approval_repo import ApprovalRepository
from app.db.repositories.audit_repo import AuditRepository


@pytest.fixture
def mock_supabase():
    """Mock Supabase client with chainable query builder."""
    client = MagicMock()
    return client


class TestProfileRepository:
    def test_get_by_id_found(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = [{"id": "user-1", "email": "test@cyberhunt.io", "role": "operator"}]
        mock_supabase.table().select().eq().limit().execute.return_value = mock_resp

        repo = ProfileRepository(mock_supabase)
        profile = repo.get_by_id("user-1")

        assert profile is not None
        assert profile["id"] == "user-1"
        assert profile["role"] == "operator"

    def test_get_by_id_not_found(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = []
        mock_supabase.table().select().eq().limit().execute.return_value = mock_resp

        repo = ProfileRepository(mock_supabase)
        assert repo.get_by_id("missing") is None

    def test_update_role(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = [{"id": "user-1", "role": "admin"}]
        mock_supabase.table().update().eq().execute.return_value = mock_resp

        repo = ProfileRepository(mock_supabase)
        updated = repo.update_role("user-1", "admin")
        assert updated["role"] == "admin"


class TestSimulationRepository:
    def test_create_simulation(self, mock_supabase):
        sim_data = {"owner_id": "u1", "scenario_category": "exfiltration", "task_summary": "Summarize"}
        mock_resp = MagicMock()
        mock_resp.data = [{**sim_data, "id": "sim-123", "state": "CREATED"}]
        mock_supabase.table().insert().execute.return_value = mock_resp

        repo = SimulationRepository(mock_supabase)
        result = repo.create(sim_data)
        assert result["id"] == "sim-123"
        assert result["state"] == "CREATED"

    def test_get_by_id(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = [{"id": "sim-1", "state": "RUNNING"}]
        mock_supabase.table().select().eq().limit().execute.return_value = mock_resp

        repo = SimulationRepository(mock_supabase)
        sim = repo.get_by_id("sim-1")
        assert sim["state"] == "RUNNING"

    def test_list_by_owner_pagination(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = [{"id": f"sim-{i}"} for i in range(5)]
        mock_supabase.table().select().eq().order().range().execute.return_value = mock_resp

        repo = SimulationRepository(mock_supabase)
        sims = repo.list_by_owner("u1", limit=5, offset=0)
        assert len(sims) == 5

    def test_count_by_owner(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.count = 42
        mock_supabase.table().select().eq().execute.return_value = mock_resp

        repo = SimulationRepository(mock_supabase)
        assert repo.count_by_owner("u1") == 42

    def test_update_state(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = [{"id": "sim-1", "state": "PAUSED", "current_step": 3}]
        mock_supabase.table().update().eq().execute.return_value = mock_resp

        repo = SimulationRepository(mock_supabase)
        updated = repo.update_state("sim-1", "PAUSED", current_step=3)
        assert updated["state"] == "PAUSED"
        assert updated["current_step"] == 3


class TestEventRepository:
    def test_append_event(self, mock_supabase):
        event = {"simulation_id": "sim-1", "sequence_number": 1, "event_type": "ROUND_STARTED"}
        mock_resp = MagicMock()
        mock_resp.data = [{**event, "id": "ev-1"}]
        mock_supabase.table().insert().execute.return_value = mock_resp

        repo = EventRepository(mock_supabase)
        result = repo.append(event)
        assert result["id"] == "ev-1"

    def test_get_events_for_simulation(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = [{"sequence_number": 1}, {"sequence_number": 2}]
        mock_supabase.table().select().eq().gte().order().limit().execute.return_value = mock_resp

        repo = EventRepository(mock_supabase)
        events = repo.get_events_for_simulation("sim-1", from_sequence=1, limit=50)
        assert len(events) == 2

    def test_get_latest_sequence_number_empty(self, mock_supabase):
        mock_resp = MagicMock()
        mock_resp.data = []
        mock_supabase.table().select().eq().order().limit().execute.return_value = mock_resp

        repo = EventRepository(mock_supabase)
        assert repo.get_latest_sequence_number("sim-1") == 0


class TestApprovalRepository:
    def test_create_and_resolve(self, mock_supabase):
        mock_resp1 = MagicMock()
        mock_resp1.data = [{"id": "app-1", "decision": "PENDING"}]
        mock_supabase.table().insert().execute.return_value = mock_resp1

        repo = ApprovalRepository(mock_supabase)
        created = repo.create({"simulation_id": "sim-1", "action_id": "act-1", "action_hash": "h1"})
        assert created["decision"] == "PENDING"

        mock_resp2 = MagicMock()
        mock_resp2.data = [{"id": "app-1", "decision": "APPROVED", "approver_id": "user-admin"}]
        mock_supabase.table().update().eq().eq().execute.return_value = mock_resp2

        resolved = repo.resolve("app-1", "APPROVED", "user-admin", reason="Safe")
        assert resolved["decision"] == "APPROVED"


class TestAuditRepository:
    def test_record_and_get_all_types(self, mock_supabase):
        repo = AuditRepository(mock_supabase)

        mock_resp = MagicMock()
        mock_resp.data = [{"id": "rec-1"}]
        mock_supabase.table().insert().execute.return_value = mock_resp

        assert repo.record_agent_run({"simulation_id": "s1", "step": 1})["id"] == "rec-1"
        assert repo.record_attack_log({"simulation_id": "s1", "step": 1})["id"] == "rec-1"
        assert repo.record_defence_log({"simulation_id": "s1", "step": 1})["id"] == "rec-1"
        assert repo.record_policy_decision({"simulation_id": "s1", "step": 1})["id"] == "rec-1"
        assert repo.record_tool_log({"simulation_id": "s1", "step": 1})["id"] == "rec-1"
        assert repo.record_round_result({"simulation_id": "s1", "step": 1})["id"] == "rec-1"


class TestRepositoryErrorHandling:
    def test_database_error_wrapped(self, mock_supabase):
        mock_supabase.table().select().eq().limit().execute.side_effect = RuntimeError("Postgrest timeout")

        repo = ProfileRepository(mock_supabase)
        with pytest.raises(DatabaseError, match="Database operation failed"):
            repo.get_by_id("any-id")

