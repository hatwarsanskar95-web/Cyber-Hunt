"""Repository for Agent Runs, Attack Logs, Defence Logs, Policy Decisions, Tool Logs, and Round Results."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.db.repositories.base import BaseRepository


class AuditRepository(BaseRepository):
    """Data access layer for multi-agent simulation audit logs."""

    # --- Agent Runs ---
    def record_agent_run(self, data: Dict[str, Any]) -> Dict[str, Any]:
        resp = self._execute(self.client.table("agent_runs").insert(data))
        return resp.data[0] if resp.data else {}

    def get_agent_runs(self, simulation_id: str, step: Optional[int] = None) -> List[Dict[str, Any]]:
        q = self.client.table("agent_runs").select("*").eq("simulation_id", simulation_id)
        if step is not None:
            q = q.eq("step", step)
        resp = self._execute(q.order("created_at", desc=False))
        return resp.data or []

    # --- Attack Logs ---
    def record_attack_log(self, data: Dict[str, Any]) -> Dict[str, Any]:
        resp = self._execute(self.client.table("attack_logs").insert(data))
        return resp.data[0] if resp.data else {}

    def get_attack_logs(self, simulation_id: str) -> List[Dict[str, Any]]:
        resp = self._execute(
            self.client.table("attack_logs")
            .select("*")
            .eq("simulation_id", simulation_id)
            .order("step", desc=False)
        )
        return resp.data or []

    # --- Defence Logs ---
    def record_defence_log(self, data: Dict[str, Any]) -> Dict[str, Any]:
        resp = self._execute(self.client.table("defence_logs").insert(data))
        return resp.data[0] if resp.data else {}

    def get_defence_logs(self, simulation_id: str) -> List[Dict[str, Any]]:
        resp = self._execute(
            self.client.table("defence_logs")
            .select("*")
            .eq("simulation_id", simulation_id)
            .order("step", desc=False)
        )
        return resp.data or []

    # --- Policy Decisions ---
    def record_policy_decision(self, data: Dict[str, Any]) -> Dict[str, Any]:
        resp = self._execute(self.client.table("policy_decisions").insert(data))
        return resp.data[0] if resp.data else {}

    def get_policy_decisions(self, simulation_id: str) -> List[Dict[str, Any]]:
        resp = self._execute(
            self.client.table("policy_decisions")
            .select("*")
            .eq("simulation_id", simulation_id)
            .order("step", desc=False)
        )
        return resp.data or []

    # --- Tool Logs ---
    def record_tool_log(self, data: Dict[str, Any]) -> Dict[str, Any]:
        resp = self._execute(self.client.table("tool_logs").insert(data))
        return resp.data[0] if resp.data else {}

    def get_tool_logs(self, simulation_id: str) -> List[Dict[str, Any]]:
        resp = self._execute(
            self.client.table("tool_logs")
            .select("*")
            .eq("simulation_id", simulation_id)
            .order("step", desc=False)
        )
        return resp.data or []

    # --- Round Results ---
    def record_round_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        resp = self._execute(self.client.table("round_results").insert(data))
        return resp.data[0] if resp.data else {}

    def get_round_results(self, simulation_id: str) -> List[Dict[str, Any]]:
        resp = self._execute(
            self.client.table("round_results")
            .select("*")
            .eq("simulation_id", simulation_id)
            .order("step", desc=False)
        )
        return resp.data or []

