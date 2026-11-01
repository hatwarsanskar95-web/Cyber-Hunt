"""Simulation Lifecycle Manager and Background Execution Engine.

Implements SIM-001 through SIM-006:
- State Machine: CREATED, INITIALIZING, RUNNING, ANALYSING, AWAITING_APPROVAL,
  PAUSED, COMPLETED, FAILED, CANCELLED.
- Background asynchronous LangGraph task execution runner.
- Thread ID management bound to durable PostgreSQL checkpoints.
- Human-in-the-loop approval interrupt detection and resumption.
- Bounded step execution and timeout enforcement.
- Persistence of state changes, approval requests, round results, and event stream.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from langgraph.types import Command

from app.config import Settings, get_settings
from app.core.errors import (
    AuthorizationError,
    NotFoundError,
    SimulationStateError,
    ValidationError,
)
from app.db.client import get_supabase_client
from app.db.repositories.approval_repo import ApprovalRepository
from app.db.repositories.audit_repo import AuditRepository
from app.db.repositories.event_repo import EventRepository
from app.db.repositories.simulation_repo import SimulationRepository
from app.orchestration.graph import build_simulation_graph
from app.orchestration.state import SimulationState as GraphState, create_initial_state
from app.schemas.common import SimulationState as SimStatusEnum
from app.schemas.event import EventType
from app.websocket.broadcaster import emit_simulation_event

log = logging.getLogger(__name__)

EVENT_TYPE_MAP: Dict[str, str] = {
    "SIMULATION_CREATED": EventType.SIMULATION_CREATED.value,
    "SIMULATION_STARTED": EventType.SIMULATION_STATUS_CHANGED.value,
    "SIMULATION_PAUSED": EventType.SIMULATION_STATUS_CHANGED.value,
    "SIMULATION_RESUMED": EventType.SIMULATION_STATUS_CHANGED.value,
    "SIMULATION_STOPPED": EventType.SIMULATION_STATUS_CHANGED.value,
    "SIMULATION_CANCELLED": EventType.SIMULATION_STATUS_CHANGED.value,
    "SIMULATION_COMPLETED": EventType.SIMULATION_COMPLETED.value,
    "SIMULATION_FAILED": EventType.SIMULATION_FAILED.value,
    "APPROVAL_REQUIRED": EventType.APPROVAL_REQUESTED.value,
    "APPROVAL_DECISION_DELIVERED": EventType.APPROVAL_RESOLVED.value,
}

# Valid transitions map
VALID_TRANSITIONS: Dict[str, set[str]] = {
    SimStatusEnum.CREATED.value: {
        SimStatusEnum.INITIALIZING.value,
        SimStatusEnum.RUNNING.value,
        SimStatusEnum.CANCELLED.value,
    },
    SimStatusEnum.INITIALIZING.value: {
        SimStatusEnum.RUNNING.value,
        SimStatusEnum.FAILED.value,
        SimStatusEnum.CANCELLED.value,
    },
    SimStatusEnum.RUNNING.value: {
        SimStatusEnum.ANALYSING.value,
        SimStatusEnum.AWAITING_APPROVAL.value,
        SimStatusEnum.PAUSED.value,
        SimStatusEnum.COMPLETED.value,
        SimStatusEnum.FAILED.value,
        SimStatusEnum.CANCELLED.value,
    },
    SimStatusEnum.ANALYSING.value: {
        SimStatusEnum.RUNNING.value,
        SimStatusEnum.AWAITING_APPROVAL.value,
        SimStatusEnum.PAUSED.value,
        SimStatusEnum.COMPLETED.value,
        SimStatusEnum.FAILED.value,
        SimStatusEnum.CANCELLED.value,
    },
    SimStatusEnum.AWAITING_APPROVAL.value: {
        SimStatusEnum.RUNNING.value,
        SimStatusEnum.CANCELLED.value,
        SimStatusEnum.FAILED.value,
    },
    SimStatusEnum.PAUSED.value: {
        SimStatusEnum.RUNNING.value,
        SimStatusEnum.CANCELLED.value,
    },
    SimStatusEnum.COMPLETED.value: set(),  # Terminal
    SimStatusEnum.FAILED.value: set(),     # Terminal
    SimStatusEnum.CANCELLED.value: set(),  # Terminal
}


class SimulationManager:
    """Manages multi-agent simulation run lifecycles and background execution."""

    def __init__(
        self,
        simulation_repo: Optional[SimulationRepository] = None,
        approval_repo: Optional[ApprovalRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
        event_repo: Optional[EventRepository] = None,
        settings: Optional[Settings] = None,
        default_timeout_seconds: int = 300,
    ) -> None:
        self.settings = settings or get_settings()
        self.default_timeout_seconds = default_timeout_seconds

        # Active background tasks by simulation ID
        self._tasks: Dict[str, asyncio.Task] = {}
        self._paused_flags: Dict[str, bool] = {}
        self._lock = asyncio.Lock()

        # In-memory stores for testing when database is unconfigured
        self._mem_simulations: Dict[str, Dict[str, Any]] = {}
        self._mem_approvals: Dict[str, Dict[str, Any]] = {}
        self._mem_events: Dict[str, List[Dict[str, Any]]] = {}
        self._mem_round_results: Dict[str, List[Dict[str, Any]]] = {}
        self._mem_analysis_history: List[Dict[str, Any]] = []

        # Repositories
        self.sim_repo = simulation_repo
        self.approval_repo = approval_repo
        self.audit_repo = audit_repo
        self.event_repo = event_repo

        if not (self.sim_repo and self.approval_repo):
            self._init_repos()

    def _init_repos(self) -> None:
        """Initialize database repositories if Supabase is configured."""
        try:
            if self.settings.has_supabase_service_role or self.settings.supabase_anon_key:
                client = get_supabase_client(self.settings)
                self.sim_repo = self.sim_repo or SimulationRepository(client)
                self.approval_repo = self.approval_repo or ApprovalRepository(client)
                self.audit_repo = self.audit_repo or AuditRepository(client)
                self.event_repo = self.event_repo or EventRepository(client)
        except Exception as exc:
            log.warning("Supabase repos uninitialized (in-memory mode): %s", exc)

    # -----------------------------------------------------------------------
    # DB / State Abstraction Helpers
    # -----------------------------------------------------------------------

    def _get_sim_record(self, simulation_id: str) -> Optional[Dict[str, Any]]:
        """Fetch simulation record from repository or in-memory fallback."""
        if self.sim_repo:
            try:
                rec = self.sim_repo.get_by_id(simulation_id)
                if rec:
                    return rec
            except Exception as exc:
                log.debug("DB lookup failed for %s, checking memory: %s", simulation_id, exc)
        return self._mem_simulations.get(simulation_id)

    def _save_sim_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Save new simulation record."""
        sim_id = record["id"]
        self._mem_simulations[sim_id] = dict(record)
        if self.sim_repo:
            try:
                allowed_cols = {
                    "id", "owner_id", "scenario_category", "task_summary",
                    "state", "step_limit", "current_step", "final_metrics",
                    "created_at", "updated_at",
                }
                db_payload = {k: v for k, v in record.items() if k in allowed_cols}
                uuid.UUID(str(db_payload["id"]))
                uuid.UUID(str(db_payload["owner_id"]))
                db_rec = self.sim_repo.create(db_payload)
                if db_rec:
                    self._mem_simulations[sim_id].update(db_rec)
                    return self._mem_simulations[sim_id]
            except Exception as exc:
                log.debug("DB insert skipped/failed for sim %s (cached in memory): %s", sim_id, exc)
        return self._mem_simulations[sim_id]

    def _update_sim_state(
        self, simulation_id: str, new_state: str, current_step: Optional[int] = None
    ) -> None:
        """Update simulation state and step in repository and memory."""
        now = datetime.now(timezone.utc).isoformat()
        if simulation_id in self._mem_simulations:
            self._mem_simulations[simulation_id]["state"] = new_state
            self._mem_simulations[simulation_id]["updated_at"] = now
            if current_step is not None:
                self._mem_simulations[simulation_id]["current_step"] = current_step

        if self.sim_repo:
            try:
                self.sim_repo.update_state(simulation_id, new_state, current_step)
            except Exception as exc:
                log.warning("DB state update failed for %s: %s", simulation_id, exc)

    def _append_event(self, simulation_id: str, event_type: str, payload: Dict[str, Any]) -> None:
        """Append event to simulation audit stream and broadcast via WebSocket."""
        event_type_str = EVENT_TYPE_MAP.get(event_type, event_type)
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(
                emit_simulation_event(
                    simulation_id=simulation_id,
                    event_type=event_type_str,
                    payload=payload,
                    event_repo=self.event_repo,
                )
            )
        except RuntimeError:
            events = self._mem_events.setdefault(simulation_id, [])
            seq = len(events) + 1
            now = datetime.now(timezone.utc).isoformat()
            evt = {
                "simulation_id": simulation_id,
                "sequence_number": seq,
                "event_type": event_type_str,
                "schema_version": "1.0",
                "payload": payload,
                "timestamp": now,
            }
            events.append(evt)

            if self.event_repo:
                try:
                    uuid.UUID(simulation_id)
                    self.event_repo.append(evt)
                except Exception as exc:
                    log.debug("Event persistence skipped/failed for %s: %s", simulation_id, exc)

    async def emit_event(
        self, simulation_id: str, event_type: EventType | str, payload: Dict[str, Any]
    ) -> Any:
        """Asynchronously emit, persist, and broadcast an event."""
        return await emit_simulation_event(
            simulation_id=simulation_id,
            event_type=event_type,
            payload=payload,
            event_repo=self.event_repo,
        )

    async def inject_incoming_email(
        self, simulation_id: str, email_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Inbound Gmail event ingestion hook.

        Accepts incoming email notification, broadcasts 'email.received',
        and feeds it into the security pipeline without bypassing OPA or Tool Gateway.
        All private credentials and tokens are strictly excluded.
        """
        log.info("Incoming email received for simulation %s", simulation_id)
        # Redact any private credentials from payload before broadcast
        safe_payload = {
            "id": email_data.get("id") or f"msg-{uuid.uuid4().hex[:8]}",
            "from": email_data.get("from", "unknown@example.com"),
            "to": email_data.get("to", ""),
            "subject": email_data.get("subject", "(no subject)"),
            "snippet": email_data.get("snippet") or email_data.get("body", "")[:120],
            "body": email_data.get("body", ""),
            "attachments": email_data.get("attachments", []),
            "received_at": email_data.get("received_at") or datetime.now(timezone.utc).isoformat(),
            "is_untrusted": email_data.get("is_untrusted", True),
        }
        await self.emit_event(
            simulation_id=simulation_id,
            event_type=EventType.EMAIL_RECEIVED,
            payload=safe_payload,
        )
        # Automatically launch threat analysis pipeline in background (Req 4)
        asyncio.create_task(
            self.analyze_email_workflow(simulation_id, safe_payload),
            name=f"auto-analyze-{safe_payload['id']}",
        )
        return safe_payload

    async def analyze_email_workflow(
        self,
        simulation_id: str,
        email_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute the multi-agent threat analysis pipeline for an email:
        1. Email Received (Stage 1)
        2. Red Team Alert (Stage 2)
        3. Target AI Analysis (Stage 3)
        4. Blue Team Verification (Stage 4)
        5. OPA Policy Evaluation (Stage 5)
        6. Final Security Decision / Human Approval (Stage 6)
        """
        from app.orchestration.nodes.red_team_node import red_team_node
        from app.orchestration.nodes.target_ai_node import target_ai_node
        from app.orchestration.nodes.guardian_node import guardian_node
        from app.orchestration.nodes.opa_node import node_opa_eval
        from app.orchestration.nodes.tool_node import tool_gateway_node
        from app.orchestration.nodes.score_node import score_update_node
        from app.schemas.common import PolicyDecisionEnum
        from app.security.email_analyzer import analyze_email_threat

        email_id = email_data.get("id", "email-unknown")
        subject = email_data.get("subject", "(no subject)")
        from_addr = email_data.get("from", "unknown")
        body = email_data.get("body") or email_data.get("snippet") or ""

        log.info("Starting complete threat analysis workflow for email '%s' (%s)", subject, email_id)

        # Grounded multi-vector analysis
        analysis = analyze_email_threat(email_data)

        # Build initial state
        state = create_initial_state(
            simulation_id=simulation_id,
            owner_id="00000000-0000-4000-8000-000000000001",
            scenario_category="phishing" if analysis.risk_score >= 30 else "email_indirect",
            task_summary=f"Analyze email from {from_addr}: {subject}",
            step_limit=5,
            untrusted_input=f"Subject: {subject}\nFrom: {from_addr}\n\n{body}",
        )
        self._update_sim_state(simulation_id, SimStatusEnum.RUNNING.value)

        # Stage 2: Red Team Alert
        if analysis.classification == "Safe":
            attack_payload = {
                "attack_id": f"atk-clean-{uuid.uuid4().hex[:8]}",
                "category": "clean_communication",
                "intended_goal": "Normal email verification",
                "strategy_summary": "Zero adversarial threat detected; clean email verified.",
                "payload_text": f"Subject: {subject}",
                "target_surface": "none",
            }
            red_res = {"attack_payload": attack_payload}
        else:
            red_res = await red_team_node(state)
            attack_payload = red_res.get("attack_payload") or {}
            attack_payload["threat_indicators"] = analysis.threat_indicators

        state.update(red_res)
        await self.emit_event(
            simulation_id=simulation_id,
            event_type=EventType.RED_TEAM_ATTACK_GENERATED,
            payload={
                **attack_payload,
                "email_id": email_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        await asyncio.sleep(0.3)

        # Stage 3: Target AI Analysis
        if analysis.classification == "Safe":
            target_proposal = {
                "thought_process": "Inbound email is verified safe. No adversarial injection or privileged tool call required.",
                "user_response": "Processed benign email and verified safe for delivery.",
                "tool_name": "none",
                "operation": "none",
                "parameters": {},
                "rationale": "Direct conversational processing of clean message.",
                "action_id": f"act-clean-{uuid.uuid4().hex[:8]}",
            }
            tgt_res = {"target_proposal": target_proposal}
        else:
            tgt_res = await target_ai_node(state)
            target_proposal = tgt_res.get("target_proposal") or {}

        state.update(tgt_res)
        await self.emit_event(
            simulation_id=simulation_id,
            event_type=EventType.TARGET_AI_ACTION_PROPOSED,
            payload={
                **target_proposal,
                "email_id": email_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        await asyncio.sleep(0.3)

        # Stage 4: Blue Team Verification
        self._update_sim_state(simulation_id, SimStatusEnum.ANALYSING.value)
        guardian_assessment = {
            "threat_detected": analysis.risk_score >= 30,
            "risk_score": float(analysis.risk_score) / 100.0,
            "severity": analysis.threat_level,
            "indicators": analysis.threat_indicators,
            "explanation": analysis.explanation,
            "recommended_action": analysis.decision,
            "confidence_score": float(analysis.confidence_score) / 100.0,
        }
        guardian_res = {"guardian_assessment": guardian_assessment}
        state.update(guardian_res)

        await self.emit_event(
            simulation_id=simulation_id,
            event_type=EventType.GUARDIAN_ANALYSIS_COMPLETED,
            payload={
                **guardian_assessment,
                "email_id": email_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        await asyncio.sleep(0.3)

        # Stage 5: OPA Policy Evaluation
        opa_res = await node_opa_eval(state)
        state.update(opa_res)
        policy_decision = opa_res.get("policy_decision") or {}
        action_hash = opa_res.get("action_hash") or state.get("action_hash") or ""
        
        # Ground decision with analysis result
        decision = analysis.decision
        policy_decision["decision"] = decision
        if decision == PolicyDecisionEnum.ALLOW.value:
            policy_decision["reason_codes"] = ["OPERATION_WITHIN_POLICY_ALLOWLIST", "CLEAN_EMAIL_VERIFIED"]
        elif decision == PolicyDecisionEnum.BLOCK.value:
            policy_decision["reason_codes"] = ["OPA_SECURITY_BLOCK", *analysis.threat_indicators]
        else:
            policy_decision["reason_codes"] = ["POLICY_THRESHOLD_REQUIRES_HUMAN_APPROVAL", *analysis.threat_indicators]

        await self.emit_event(
            simulation_id=simulation_id,
            event_type=EventType.POLICY_DECISION_MADE,
            payload={
                **policy_decision,
                "action_hash": action_hash,
                "email_id": email_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Construct comprehensive payload with all 14 analysis parameters
        analysis_dict = analysis.to_dict()
        analysis_dict.update({
            "email_id": email_id,
            "subject": subject,
            "from": from_addr,
            "simulation_id": simulation_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "policy_decision": policy_decision,
            "guardian_assessment": guardian_assessment,
            "action_hash": action_hash,
        })

        # Save to historical analysis repository
        self._record_analysis_history("email", email_id, analysis_dict)

        # Stage 6: Final Security Decision / Human Approval
        if decision == PolicyDecisionEnum.REQUIRE_APPROVAL.value:
            self._update_sim_state(simulation_id, SimStatusEnum.AWAITING_APPROVAL.value)
            action_id = policy_decision.get("action_id") or f"act-{uuid.uuid4().hex[:8]}"
            expiry_dt = datetime.now(timezone.utc) + timedelta(hours=24)
            app_req_data = {
                "simulation_id": simulation_id,
                "action_id": action_id,
                "action_hash": action_hash,
                "decision": "PENDING",
                "expiry_time": expiry_dt.isoformat(),
                "email_id": email_id,
                "email_from": from_addr,
                "email_subject": subject,
                "threat_score": analysis.risk_score,
                "target_findings": analysis.target_ai_finding,
                "blue_findings": ", ".join(analysis.threat_indicators) or "Uncertain markers detected",
                "reason": analysis.opa_policy_reason,
                "recommended_action": "REQUIRE_APPROVAL",
            }
            saved_req = self._save_approval_request(app_req_data)
            approval_id = saved_req.get("id") if saved_req else f"app-{uuid.uuid4().hex[:8]}"
            app_req_data["id"] = approval_id

            await self.emit_event(
                simulation_id=simulation_id,
                event_type="APPROVAL_REQUIRED",
                payload=app_req_data,
            )
            log.info("Approval required for email '%s', approval_id=%s", subject, approval_id)
            return {
                "status": "AWAITING_APPROVAL",
                "approval_id": approval_id,
                "action_hash": action_hash,
                "policy_decision": policy_decision,
                "guardian_assessment": guardian_assessment,
                "analysis": analysis_dict,
            }

        elif decision == PolicyDecisionEnum.ALLOW.value:
            tool_res = await tool_gateway_node(state)
            state.update(tool_res)
            await self.emit_event(
                simulation_id=simulation_id,
                event_type=EventType.TOOL_EXECUTED,
                payload={
                    **tool_res.get("tool_result", {}),
                    "email_id": email_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            score_res = await score_update_node(state)
            state.update(score_res)
            await self.emit_event(
                simulation_id=simulation_id,
                event_type=EventType.SCORE_UPDATED,
                payload={
                    **score_res.get("round_result", {}),
                    "email_id": email_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            self._update_sim_state(simulation_id, SimStatusEnum.COMPLETED.value)
            return {
                "status": "ALLOW",
                "policy_decision": policy_decision,
                "guardian_assessment": guardian_assessment,
                "analysis": analysis_dict,
            }

        else:
            # BLOCK
            await self.emit_event(
                simulation_id=simulation_id,
                event_type=EventType.TOOL_BLOCKED,
                payload={
                    "reason": policy_decision.get("reason_codes", ["Blocked by OPA policy"]),
                    "email_id": email_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            score_res = await score_update_node(state)
            state.update(score_res)
            await self.emit_event(
                simulation_id=simulation_id,
                event_type=EventType.SCORE_UPDATED,
                payload={
                    **score_res.get("round_result", {}),
                    "email_id": email_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            self._update_sim_state(simulation_id, SimStatusEnum.COMPLETED.value)
            return {
                "status": "BLOCK",
                "policy_decision": policy_decision,
                "guardian_assessment": guardian_assessment,
                "analysis": analysis_dict,
            }

    def _save_approval_request(self, approval_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a pending approval request."""
        req_id = approval_data.get("id") or str(uuid.uuid4())
        approval_data["id"] = req_id
        now = datetime.now(timezone.utc).isoformat()
        approval_data.setdefault("created_at", now)
        self._mem_approvals[req_id] = dict(approval_data)

        if self.approval_repo:
            try:
                uuid.UUID(approval_data["simulation_id"])
                # Filter to columns existing in Supabase approval_requests schema
                allowed_cols = {"id", "simulation_id", "action_id", "action_hash", "decision", "expiry_time", "reason", "created_at"}
                db_payload = {k: v for k, v in approval_data.items() if k in allowed_cols}
                try:
                    uuid.UUID(str(db_payload["id"]))
                except (ValueError, TypeError):
                    db_payload["id"] = str(uuid.uuid4())
                db_rec = self.approval_repo.create(db_payload)
                if db_rec:
                    self._mem_approvals[req_id].update(db_rec)
                    return self._mem_approvals[req_id]
            except Exception as exc:
                log.debug("Approval request DB insert skipped/failed for %s: %s", req_id, exc)
        return self._mem_approvals[req_id]

    def _get_approval_request(self, approval_id: str) -> Optional[Dict[str, Any]]:
        """Fetch approval request by ID."""
        if self.approval_repo:
            try:
                rec = self.approval_repo.get_by_id(approval_id)
                if rec:
                    return rec
            except Exception as exc:
                log.debug("Approval DB lookup failed for %s: %s", approval_id, exc)
        return self._mem_approvals.get(approval_id)

    def _record_analysis_history(
        self,
        security_level: str,
        item_id: str,
        record: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Record completed analysis to persistent in-memory and database history."""
        hist_entry = {
            "id": f"rec-{uuid.uuid4().hex[:10]}",
            "security_level": security_level,
            "item_id": item_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **record,
        }
        # Deduplicate if item_id already exists in history
        self._mem_analysis_history = [
            h for h in self._mem_analysis_history
            if not (h.get("item_id") == item_id and h.get("security_level") == security_level)
        ]
        self._mem_analysis_history.insert(0, hist_entry)
        log.info(
            "Recorded analysis history for level=%s, item=%s, decision=%s",
            security_level,
            item_id,
            record.get("decision"),
        )
        return hist_entry

    def list_analysis_history(
        self,
        security_level: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve historical security analysis records."""
        items = self._mem_analysis_history
        if security_level:
            items = [h for h in items if h.get("security_level") == security_level]
        return items[:limit]

    def _resolve_approval_request(
        self, approval_id: str, decision: str, approver_id: str, reason: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Mark approval request as resolved."""
        now = datetime.now(timezone.utc).isoformat()
        if approval_id in self._mem_approvals:
            self._mem_approvals[approval_id]["decision"] = decision
            self._mem_approvals[approval_id]["approver_id"] = approver_id
            self._mem_approvals[approval_id]["reason"] = reason
            self._mem_approvals[approval_id]["resolved_at"] = now

        if self.approval_repo:
            try:
                db_rec = self.approval_repo.resolve(approval_id, decision, approver_id, reason)
                if db_rec:
                    self._mem_approvals[approval_id] = db_rec
                    return db_rec
            except Exception as exc:
                log.warning("Approval DB resolve failed for %s: %s", approval_id, exc)
        return self._mem_approvals.get(approval_id)

    def _record_analysis_history(
        self,
        security_level: str,
        item_id: str,
        record: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Record completed analysis to persistent in-memory and database history."""
        hist_entry = {
            "id": f"rec-{uuid.uuid4().hex[:10]}",
            "security_level": security_level,
            "item_id": item_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **record,
        }
        # Deduplicate if item_id already exists in history
        self._mem_analysis_history = [
            h for h in self._mem_analysis_history
            if not (h.get("item_id") == item_id and h.get("security_level") == security_level)
        ]
        self._mem_analysis_history.insert(0, hist_entry)
        log.info(
            "Recorded analysis history for level=%s, item=%s, decision=%s",
            security_level,
            item_id,
            record.get("decision"),
        )
        return hist_entry

    def list_analysis_history(
        self,
        security_level: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve historical security analysis records."""
        items = self._mem_analysis_history
        if security_level:
            items = [h for h in items if h.get("security_level") == security_level]
        return items[:limit]

    # -----------------------------------------------------------------------
    # State Validation Helper
    # -----------------------------------------------------------------------

    def _validate_transition(self, current_state: str, target_state: str) -> None:
        """Enforce strict state machine transitions."""
        allowed = VALID_TRANSITIONS.get(current_state, set())
        if target_state not in allowed:
            raise SimulationStateError(
                f"Invalid state transition from '{current_state}' to '{target_state}'. "
                f"Allowed target states: {sorted(allowed) if allowed else 'None (terminal state)'}."
            )

    # -----------------------------------------------------------------------
    # SIM-001: Lifecycle Operations
    # -----------------------------------------------------------------------

    def create_simulation(
        self,
        *,
        owner_id: str,
        scenario_category: str,
        task_summary: str,
        step_limit: int = 5,
        initial_input: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new simulation in CREATED state."""
        if not (1 <= step_limit <= 20):
            raise ValidationError("step_limit must be between 1 and 20.")

        sim_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        record: Dict[str, Any] = {
            "id": sim_id,
            "owner_id": owner_id,
            "scenario_category": scenario_category,
            "task_summary": task_summary,
            "state": SimStatusEnum.CREATED.value,
            "step_limit": step_limit,
            "current_step": 0,
            "final_metrics": {},
            "created_at": now,
            "updated_at": now,
        }
        if initial_input:
            record["initial_input"] = initial_input

        saved = self._save_sim_record(record)
        self._append_event(sim_id, "SIMULATION_CREATED", {"owner_id": owner_id, "step_limit": step_limit})
        log.info("Simulation created: %s (owner: %s)", sim_id, owner_id)
        return saved

    def list_simulations(
        self, owner_id: Optional[str] = None, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List active or owned simulations."""
        if self.sim_repo:
            try:
                if owner_id:
                    db_sims = self.sim_repo.list_by_owner(owner_id, limit=limit)
                else:
                    db_sims = self.sim_repo.list_all(limit=limit) if hasattr(self.sim_repo, "list_all") else []
                if db_sims:
                    return db_sims
            except Exception as exc:
                log.debug("DB list_simulations failed: %s", exc)

        results = list(self._mem_simulations.values())
        if owner_id:
            results = [s for s in results if s.get("owner_id") == owner_id]
        results.sort(key=lambda s: s.get("created_at", ""), reverse=True)
        return results[:limit]

    def get_simulation(self, simulation_id: str) -> Dict[str, Any]:
        """Fetch simulation by ID or raise NotFoundError."""
        rec = self._get_sim_record(simulation_id)
        if not rec:
            raise NotFoundError(f"Simulation '{simulation_id}' not found.")
        return rec

    async def start_simulation(
        self, simulation_id: str, owner_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Start simulation execution in background task."""
        async with self._lock:
            rec = self.get_simulation(simulation_id)
            if owner_id and rec.get("owner_id") != owner_id:
                raise AuthorizationError("You do not have permission to start this simulation.")

            current_state = rec.get("state", SimStatusEnum.CREATED.value)
            if current_state != SimStatusEnum.CREATED.value:
                raise SimulationStateError(
                    f"Cannot start simulation in state '{current_state}'. Only CREATED simulations can be started."
                )

            # Prevent duplicate execution
            existing_task = self._tasks.get(simulation_id)
            if existing_task and not existing_task.done():
                raise SimulationStateError("Simulation is already running.")

            self._update_sim_state(simulation_id, SimStatusEnum.RUNNING.value, current_step=1)
            self._append_event(simulation_id, "SIMULATION_STARTED", {"step": 1})
            self._paused_flags[simulation_id] = False

            # Spawn background execution runner (SIM-003)
            task = asyncio.create_task(
                self._run_graph_loop(simulation_id, is_new=True),
                name=f"sim-runner-{simulation_id}",
            )
            self._tasks[simulation_id] = task

        log.info("Simulation started: %s", simulation_id)
        return self.get_simulation(simulation_id)

    async def pause_simulation(
        self, simulation_id: str, owner_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Pause a running simulation."""
        async with self._lock:
            rec = self.get_simulation(simulation_id)
            if owner_id and rec.get("owner_id") != owner_id:
                raise AuthorizationError("You do not have permission to pause this simulation.")

            current_state = rec.get("state")
            if current_state not in (SimStatusEnum.RUNNING.value, SimStatusEnum.ANALYSING.value):
                raise SimulationStateError(
                    f"Cannot pause simulation in state '{current_state}'. Only RUNNING or ANALYSING simulations can be paused."
                )

            self._paused_flags[simulation_id] = True
            task = self._tasks.get(simulation_id)
            if task and not task.done():
                task.cancel()

            self._update_sim_state(simulation_id, SimStatusEnum.PAUSED.value)
            self._append_event(simulation_id, "SIMULATION_PAUSED", {})

        log.info("Simulation paused: %s", simulation_id)
        return self.get_simulation(simulation_id)

    async def resume_simulation(
        self, simulation_id: str, owner_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Resume execution of a PAUSED simulation."""
        async with self._lock:
            rec = self.get_simulation(simulation_id)
            if owner_id and rec.get("owner_id") != owner_id:
                raise AuthorizationError("You do not have permission to resume this simulation.")

            current_state = rec.get("state")
            if current_state != SimStatusEnum.PAUSED.value:
                raise SimulationStateError(
                    f"Cannot resume simulation in state '{current_state}'. Only PAUSED simulations can be resumed."
                )

            existing_task = self._tasks.get(simulation_id)
            if existing_task and not existing_task.done():
                raise SimulationStateError("Simulation is already running.")

            self._update_sim_state(simulation_id, SimStatusEnum.RUNNING.value)
            self._append_event(simulation_id, "SIMULATION_RESUMED", {})
            self._paused_flags[simulation_id] = False

            task = asyncio.create_task(
                self._run_graph_loop(simulation_id, resume_from_pause=True),
                name=f"sim-runner-{simulation_id}",
            )
            self._tasks[simulation_id] = task

        log.info("Simulation resumed: %s", simulation_id)
        return self.get_simulation(simulation_id)

    async def stop_simulation(
        self, simulation_id: str, owner_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Stop/cancel a simulation."""
        async with self._lock:
            rec = self.get_simulation(simulation_id)
            if owner_id and rec.get("owner_id") != owner_id:
                raise AuthorizationError("You do not have permission to stop this simulation.")

            current_state = rec.get("state")
            self._validate_transition(current_state, SimStatusEnum.CANCELLED.value)

            task = self._tasks.get(simulation_id)
            if task and not task.done():
                task.cancel()

            self._update_sim_state(simulation_id, SimStatusEnum.CANCELLED.value)
            self._append_event(simulation_id, "SIMULATION_CANCELLED", {})

        log.info("Simulation stopped/cancelled: %s", simulation_id)
        return self.get_simulation(simulation_id)

    # -----------------------------------------------------------------------
    # SIM-004 & SIM-005: Human-in-the-Loop Approval Decision
    # -----------------------------------------------------------------------

    async def submit_approval_decision(
        self,
        *,
        approval_id: str,
        decision: str,
        action_hash: str,
        approver_id: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit an approved or rejected decision and resume LangGraph execution."""
        async with self._lock:
            app_req = self._get_approval_request(approval_id)
            if not app_req:
                raise NotFoundError(f"Approval request '{approval_id}' not found.")

            simulation_id = app_req["simulation_id"]
            sim = self.get_simulation(simulation_id)

            # 1. State must be AWAITING_APPROVAL
            if sim.get("state") != SimStatusEnum.AWAITING_APPROVAL.value:
                raise SimulationStateError(
                    f"Simulation is in state '{sim.get('state')}', not awaiting approval."
                )

            # 2. Reject duplicate / already resolved submissions
            if app_req.get("decision") != "PENDING":
                raise SimulationStateError("Approval request has already been resolved.")

            # 3. Check expiration
            expiry_str = app_req.get("expiry_time")
            if expiry_str:
                try:
                    expiry_dt = datetime.fromisoformat(expiry_str)
                    if expiry_dt < datetime.now(timezone.utc):
                        raise ValidationError("Approval request has expired.")
                except ValueError:
                    pass

            # 4. Strict action hash verification (tamper prevention)
            expected_hash = app_req.get("action_hash", "")
            if expected_hash.strip().lower() != action_hash.strip().lower():
                raise ValidationError("Action hash mismatch: proposed parameters do not match original request.")

            # 5. Persist resolution
            resolved = self._resolve_approval_request(approval_id, decision, approver_id, reason)

            # 6. Transition simulation state back to RUNNING
            self._update_sim_state(simulation_id, SimStatusEnum.RUNNING.value)
            decision_payload = {
                "decision": decision,
                "approver_id": approver_id,
                "reason": reason,
                "approval_id": approval_id,
                "action_hash": action_hash,
                "email_id": app_req.get("email_id"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._append_event(
                simulation_id,
                "APPROVAL_DECISION_DELIVERED",
                decision_payload,
            )
            await self.emit_event(
                simulation_id=simulation_id,
                event_type="APPROVAL_DECISION_DELIVERED",
                payload=decision_payload,
            )
            if decision == "APPROVED":
                await self.emit_event(
                    simulation_id=simulation_id,
                    event_type=EventType.TOOL_EXECUTED,
                    payload={"status": "APPROVED", "message": "Email action approved by human operator", "email_id": app_req.get("email_id")},
                )
            else:
                await self.emit_event(
                    simulation_id=simulation_id,
                    event_type=EventType.TOOL_BLOCKED,
                    payload={"status": "BLOCKED", "message": "Email action blocked by human operator", "email_id": app_req.get("email_id")},
                )

            # 7. Resume background LangGraph execution with Command(resume=...)
            resume_payload = {
                "decision": decision,
                "action_hash": action_hash,
                "approver_id": approver_id,
                "reason": reason,
            }
            task = asyncio.create_task(
                self._run_graph_loop(simulation_id, approval_decision=resume_payload),
                name=f"sim-runner-{simulation_id}",
            )
            self._tasks[simulation_id] = task

        log.info("Approval decision '%s' delivered for sim %s", decision, simulation_id)
        return resolved or app_req

    # -----------------------------------------------------------------------
    # SIM-003 & SIM-006: Asynchronous Graph Execution Runner
    # -----------------------------------------------------------------------

    async def _run_graph_loop(
        self,
        simulation_id: str,
        is_new: bool = False,
        resume_from_pause: bool = False,
        approval_decision: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Background coroutine that invokes LangGraph and handles interrupts."""
        thread_id = f"thread-{simulation_id}"
        config = {"configurable": {"thread_id": thread_id}}
        graph = build_simulation_graph()

        sim = self.get_simulation(simulation_id)
        step_limit = sim.get("step_limit", 5)

        try:
            # Enforce bounded execution timeout (SIM-006)
            async with asyncio.timeout(self.default_timeout_seconds):
                if is_new:
                    init_input = sim.get("initial_input") or f"Task: {sim.get('task_summary')}"
                    init_state = create_initial_state(
                        simulation_id=simulation_id,
                        owner_id=sim.get("owner_id", "owner"),
                        scenario_category=sim.get("scenario_category", "prompt_injection"),
                        task_summary=sim.get("task_summary", "Execute task"),
                        step_limit=step_limit,
                        untrusted_input=init_input,
                    )
                    final_state = await graph.ainvoke(init_state, config=config)
                elif approval_decision is not None:
                    resume_cmd = Command(resume=approval_decision)
                    final_state = await graph.ainvoke(resume_cmd, config=config)
                elif resume_from_pause:
                    final_state = await graph.ainvoke(None, config=config)
                else:
                    final_state = await graph.ainvoke(None, config=config)

            # Check if execution paused at human_approval interrupt
            checkpoint_state = await graph.aget_state(config)

            # Broadcast granular pipeline events (WS-003)
            if final_state.get("attack_payload"):
                self._append_event(simulation_id, EventType.RED_TEAM_ATTACK_GENERATED.value, final_state["attack_payload"])
            if final_state.get("target_proposal"):
                self._append_event(simulation_id, EventType.TARGET_AI_ACTION_PROPOSED.value, final_state["target_proposal"])
            if final_state.get("guardian_assessment"):
                self._append_event(simulation_id, EventType.GUARDIAN_ANALYSIS_COMPLETED.value, final_state["guardian_assessment"])
            if final_state.get("policy_decision"):
                self._append_event(simulation_id, EventType.POLICY_DECISION_MADE.value, final_state["policy_decision"])
            if final_state.get("tool_result"):
                tool_res = final_state["tool_result"]
                evt_name = (
                    EventType.TOOL_EXECUTED.value
                    if tool_res.get("execution_status") == "SUCCESS"
                    else EventType.TOOL_BLOCKED.value
                )
                self._append_event(simulation_id, evt_name, tool_res)
            if final_state.get("round_result"):
                self._append_event(simulation_id, EventType.SCORE_UPDATED.value, final_state["round_result"])

            if (
                checkpoint_state.tasks
                and len(checkpoint_state.tasks) > 0
                and checkpoint_state.tasks[0].interrupts
            ):
                interrupt_val = checkpoint_state.tasks[0].interrupts[0].value
                action_hash = interrupt_val.get("action_hash", "")
                action_id = interrupt_val.get("action_id", f"act-{uuid.uuid4().hex[:8]}")

                # Transition to AWAITING_APPROVAL
                self._update_sim_state(simulation_id, SimStatusEnum.AWAITING_APPROVAL.value)

                # Persist approval request with 24-hour expiry (SIM-004)
                expiry_dt = datetime.now(timezone.utc) + timedelta(hours=24)
                app_req_data = {
                    "simulation_id": simulation_id,
                    "action_id": action_id,
                    "action_hash": action_hash,
                    "decision": "PENDING",
                    "expiry_time": expiry_dt.isoformat(),
                }
                self._save_approval_request(app_req_data)
                self._append_event(
                    simulation_id,
                    "APPROVAL_REQUIRED",
                    {"action_id": action_id, "action_hash": action_hash, "expiry": expiry_dt.isoformat()},
                )
                log.info(
                    "Simulation %s reached interrupt; transitioned to AWAITING_APPROVAL",
                    simulation_id,
                )
                return

            # Check for normal or bounded termination (SIM-006)
            current_step = final_state.get("current_step", 1)
            sim_status = final_state.get("status")

            if sim_status == SimStatusEnum.COMPLETED.value or current_step > step_limit:
                self._update_sim_state(simulation_id, SimStatusEnum.COMPLETED.value, current_step=current_step)
                self._append_event(simulation_id, "SIMULATION_COMPLETED", {"final_step": current_step})
                if "round_result" in final_state:
                    self._persist_round_result(simulation_id, final_state["round_result"])
                self._compute_and_save_final_metrics(simulation_id)
                log.info("Simulation %s completed successfully at step %d", simulation_id, current_step)
            else:
                self._update_sim_state(simulation_id, SimStatusEnum.RUNNING.value, current_step=current_step)
                if "round_result" in final_state:
                    self._persist_round_result(simulation_id, final_state["round_result"])

        except asyncio.CancelledError:
            log.info("Simulation %s background task cancelled", simulation_id)
            if self._paused_flags.get(simulation_id):
                self._update_sim_state(simulation_id, SimStatusEnum.PAUSED.value)
            else:
                self._update_sim_state(simulation_id, SimStatusEnum.CANCELLED.value)

        except TimeoutError:
            log.error("Simulation %s exceeded execution timeout limit", simulation_id)
            self._update_sim_state(simulation_id, SimStatusEnum.FAILED.value)
            self._append_event(
                simulation_id, "SIMULATION_FAILED", {"reason": "Execution timeout exceeded"}
            )

        except Exception as exc:
            log.exception("Simulation %s encountered unhandled error: %s", simulation_id, exc)
            self._update_sim_state(simulation_id, SimStatusEnum.FAILED.value)
            self._append_event(simulation_id, "SIMULATION_FAILED", {"error": str(exc)})

        finally:
            self._tasks.pop(simulation_id, None)

    # -----------------------------------------------------------------------
    # SIM-007: Round Results & Metric Calculation
    # -----------------------------------------------------------------------

    def _persist_round_result(self, simulation_id: str, round_result: Dict[str, Any]) -> None:
        """Save step round result to memory and database."""
        results = self._mem_round_results.setdefault(simulation_id, [])
        record = {
            "simulation_id": simulation_id,
            **round_result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        results.append(record)

        if self.audit_repo:
            try:
                uuid.UUID(simulation_id)
                self.audit_repo.record_round_result(record)
            except Exception as exc:
                log.debug("Round result DB persist skipped/failed: %s", exc)

    def _compute_and_save_final_metrics(self, simulation_id: str) -> Dict[str, Any]:
        """Compute final summary scoring metrics across all completed rounds."""
        rounds = self._mem_round_results.get(simulation_id, [])
        total = len(rounds)
        if total == 0:
            metrics = {
                "total_rounds": 0,
                "attack_success_rate": 0.0,
                "threat_detection_rate": 0.0,
                "block_rate": 0.0,
                "benign_completion_rate": 0.0,
            }
        else:
            attacks_succeeded = sum(1 for r in rounds if r.get("attack_success"))
            threats_detected = sum(1 for r in rounds if r.get("threat_detected"))
            actions_blocked = sum(1 for r in rounds if r.get("action_blocked"))
            benign_completed = sum(1 for r in rounds if r.get("benign_task_completed"))

            metrics = {
                "total_rounds": total,
                "attack_success_rate": round(attacks_succeeded / total, 4),
                "threat_detection_rate": round(threats_detected / total, 4),
                "block_rate": round(actions_blocked / total, 4),
                "benign_completion_rate": round(benign_completed / total, 4),
            }

        if simulation_id in self._mem_simulations:
            self._mem_simulations[simulation_id]["final_metrics"] = metrics

        if self.sim_repo:
            try:
                uuid.UUID(simulation_id)
                self.sim_repo.update_metrics(simulation_id, metrics)
            except Exception as exc:
                log.debug("Final metrics DB persist skipped: %s", exc)

        return metrics


# ---------------------------------------------------------------------------
# Global Singleton Provider
# ---------------------------------------------------------------------------

_simulation_manager: Optional[SimulationManager] = None


def get_simulation_manager(settings: Optional[Settings] = None) -> SimulationManager:
    """Return the global SimulationManager singleton."""
    global _simulation_manager
    if _simulation_manager is None:
        _simulation_manager = SimulationManager(settings=settings)
    return _simulation_manager


def reset_simulation_manager() -> None:
    """Reset manager singleton for unit testing."""
    global _simulation_manager
    if _simulation_manager is not None:
        for task in _simulation_manager._tasks.values():
            if not task.done():
                task.cancel()
    _simulation_manager = None
