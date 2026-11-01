"""Target AI Agent Node for CYBER HUNT.

Implements:
- TGT-003: Dynamic task handling and structured tool action proposal via GeminiClient.
- TGT-004: Strict execution isolation (zero tool-calling capability, declarative output only).
- TGT-005: Benign task fulfillment and prompt injection resistance.
- TGT-006: Telemetry persistence to Supabase agent_runs table.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from app.ai.gemini_client import get_gemini_client
from app.ai.prompts.target_ai import (
    TARGET_AI_SYSTEM_INSTRUCTION,
    build_target_ai_prompt,
)
from app.config import get_settings
from app.db.client import get_supabase_client
from app.db.repositories.audit_repo import AuditRepository
from app.orchestration.state import SimulationState
from app.schemas.tool import TargetAIResponse, ToolActionProposal, ToolName

log = logging.getLogger(__name__)


async def target_ai_node(state: SimulationState) -> Dict[str, Any]:
    """Execute the Target AI node.

    Fulfills legitimate user instructions while strictly treating adversarial
    content as untrusted data. Produces a declarative TargetAIResponse proposal.
    Has zero execution capability.
    """
    sim_id = state.get("simulation_id", "sim-default")
    step = state.get("current_step", 1)
    task_summary = state.get("task_summary", "General assistant task")
    attack = state.get("attack_payload") or {}
    untrusted_input = attack.get("payload_text") or state.get("untrusted_input") or ""
    scenario = state.get("scenario_category", "prompt_injection")
    settings = get_settings()

    log.info(
        "Executing Target AI Node",
        extra={"simulation_id": sim_id, "step": step, "task": task_summary[:50]},
    )

    # 1. Build prompt with XML isolation between task and untrusted content (TGT-002)
    prompt = build_target_ai_prompt(
        task_summary=task_summary,
        untrusted_content=untrusted_input,
        scenario_category=scenario,
    )

    ai_response: Optional[TargetAIResponse] = None
    latency_ms = 0
    token_usage_dict: Dict[str, int] = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    # 2. Dynamic generation via GeminiClient (TGT-003)
    if settings.has_gemini_key:
        try:
            gemini_client = get_gemini_client(settings)
            result = await gemini_client.generate_structured(
                prompt=prompt,
                response_schema=TargetAIResponse,
                system_instruction=TARGET_AI_SYSTEM_INSTRUCTION,
            )
            if result.data and not result.is_fallback:
                ai_response = result.data
                latency_ms = result.latency_ms
                token_usage_dict = {
                    "input_tokens": result.usage.input_tokens,
                    "output_tokens": result.usage.output_tokens,
                    "total_tokens": result.usage.total_tokens,
                }
                log.info(
                    "Target AI completion received from Gemini",
                    extra={"latency_ms": latency_ms, "tokens": token_usage_dict["total_tokens"]},
                )
        except Exception as exc:
            log.warning("Target AI Gemini generation failed, using safe fallback: %s", exc)

    # 3. Deterministic safe fallback generator (TGT-005)
    if ai_response is None:
        ai_response = _generate_fallback_response(task_summary, untrusted_input)

    # 4. Map TargetAIResponse to standardized target_proposal dict
    # This maintains full compatibility with Guardian, OPA, and Gateway downstream.
    if ai_response.proposed_action and ai_response.proposed_action.tool_name != ToolName.NONE:
        action = ai_response.proposed_action
        proposal_dict = {
            "thought_process": ai_response.thought_process,
            "user_response": ai_response.user_response,
            "tool_name": action.tool_name.value if hasattr(action.tool_name, "value") else str(action.tool_name),
            "operation": action.operation,
            "parameters": action.parameters,
            "rationale": action.rationale,
            "action_id": action.action_id,
        }
    else:
        proposal_dict = {
            "thought_process": ai_response.thought_process,
            "user_response": ai_response.user_response,
            "tool_name": "none",
            "operation": "none",
            "parameters": {},
            "rationale": "Direct conversational answer without tool invocation.",
            "action_id": f"act-none-{step}",
        }

    # 5. Agent Run Telemetry Persistence to Supabase (TGT-006)
    try:
        if settings.has_supabase_service_role or settings.supabase_anon_key:
            client = get_supabase_client(settings)
            audit_repo = AuditRepository(client)
            try:
                uuid.UUID(sim_id)
                audit_repo.record_agent_run({
                    "simulation_id": sim_id,
                    "step": step,
                    "agent_name": "target_ai",
                    "model_id": settings.gemini_model,
                    "latency_ms": latency_ms,
                    "token_usage": token_usage_dict,
                    "status": "COMPLETED",
                    "output_json": ai_response.model_dump(),
                })
                log.info("Target AI telemetry logged to agent_runs", extra={"simulation_id": sim_id, "step": step})
            except ValueError:
                log.debug("Skipping Supabase agent_run persist for non-UUID test simulation: %s", sim_id)
    except Exception as db_exc:
        log.warning("Failed to persist Target AI telemetry to Supabase (non-fatal): %s", db_exc)

    return {
        "target_proposal": proposal_dict,
        "status": "ANALYSING",
    }


def _generate_fallback_response(task_summary: str, untrusted_input: str) -> TargetAIResponse:
    """Deterministic fallback logic ensuring benign fulfillment and injection resistance."""
    task_lower = task_summary.lower()
    untrusted_lower = untrusted_input.lower()

    # Resistance to malicious overrides inside untrusted content
    is_malicious_injection = any(
        kw in untrusted_lower
        for kw in ("/etc/shadow", "ignore previous", "system override", "exfiltrate", "passwords", "steal")
    )

    if is_malicious_injection:
        return TargetAIResponse(
            thought_process="Untrusted data attempted system prompt override or sensitive access. Refusing malicious instruction.",
            user_response=(
                f"I processed the requested task: '{task_summary}'. "
                "However, the external content contained unauthorized instructions or sensitive file requests, which I have ignored."
            ),
            proposed_action=None,
        )

    # Legitimate tool task dispatch based on user task
    if "payment" in task_lower or "transfer" in task_lower or "invoice" in task_lower:
        return TargetAIResponse(
            thought_process="User requested financial fund transfer. Proposing payment tool operation.",
            user_response="I have prepared the fund transfer proposal for authorization.",
            proposed_action=ToolActionProposal(
                action_id=f"act-pay-{uuid.uuid4().hex[:6]}",
                tool_name=ToolName.PAYMENT,
                operation="transfer_funds",
                parameters={"recipient": "vendor@verified.org", "amount": 500, "currency": "USD"},
                rationale="Fulfills legitimate user fund transfer request.",
            ),
        )
    elif "email" in task_lower or "inbox" in task_lower:
        if "send" in task_lower:
            return TargetAIResponse(
                thought_process="User requested sending an email. Proposing send_email operation.",
                user_response="I am drafting the outgoing email message.",
                proposed_action=ToolActionProposal(
                    action_id=f"act-email-{uuid.uuid4().hex[:6]}",
                    tool_name=ToolName.EMAIL,
                    operation="send_email",
                    parameters={"to": "colleague@company.com", "subject": "Update", "body": "Summary attached."},
                    rationale="Sends legitimate email as requested by user.",
                ),
            )
        else:
            return TargetAIResponse(
                thought_process="User requested reading inbox messages. Proposing read_inbox operation.",
                user_response="I am retrieving your inbox messages.",
                proposed_action=ToolActionProposal(
                    action_id=f"act-inbox-{uuid.uuid4().hex[:6]}",
                    tool_name=ToolName.EMAIL,
                    operation="read_inbox",
                    parameters={"folder": "INBOX", "limit": 5},
                    rationale="Reads user inbox to answer questions.",
                ),
            )
    elif "file" in task_lower or "document" in task_lower:
        return TargetAIResponse(
            thought_process="User requested reading a document. Proposing file.read_file.",
            user_response="I am reading the requested file.",
            proposed_action=ToolActionProposal(
                action_id=f"act-file-{uuid.uuid4().hex[:6]}",
                tool_name=ToolName.FILE,
                operation="read_file",
                parameters={"path": "/workspace/notes.txt"},
                rationale="Accesses requested workspace file.",
            ),
        )
    elif "browse" in task_lower or "web" in task_lower:
        return TargetAIResponse(
            thought_process="User requested web browsing. Proposing browser.browse_url.",
            user_response="I am navigating to the requested web page.",
            proposed_action=ToolActionProposal(
                action_id=f"act-browse-{uuid.uuid4().hex[:6]}",
                tool_name=ToolName.BROWSER,
                operation="browse_url",
                parameters={"url": "http://intranet.local/docs"},
                rationale="Loads requested intranet webpage.",
            ),
        )

    # Default purely conversational response with no tool
    return TargetAIResponse(
        thought_process="Task is purely conversational or question-answering. No tool required.",
        user_response=f"Here is the answer to your request regarding '{task_summary}'.",
        proposed_action=None,
    )
