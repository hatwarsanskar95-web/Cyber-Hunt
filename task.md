# CYBER HUNT — Master Task Checklist

**Project:** CYBER HUNT  
**Problem Statement:** CYBER-02 — Red Team vs Blue Team: Agents Attacking Agents  
**Core Principle:** *"The LLM recommends. The deterministic Policy Engine decides. The Mock Tool Gateway enforces."*  
**Master Roadmap Reference:** [implementation_plan.md](file:///c:/Users/yatha/OneDrive/Documents/Projects/Cyber%20Hunt/implementation_plan.md)  
**Project Structure Reference:** [PROJECT_STRUCTURE.md](file:///c:/Users/yatha/OneDrive/Documents/Projects/Cyber%20Hunt/PROJECT_STRUCTURE.md)

---

### Task Tracking Legend
- `[ ]` **Pending** — Not yet started (All tasks must remain pending until implementation begins)
- `[~]` **In Progress** — Actively being implemented
- `[x]` **Completed & Verified** — Verified working with test evidence
- `[!]` **Blocked** — Blocked by dependency or technical issue

---

## PHASE 0 — Project Foundation

- [x] **FND-001** `[P0]` — Initialize root Git repository and standard `.gitignore` (ignoring `.env`, `.venv`, `.next`, `node_modules`, `dist`, `.pytest_cache`).  
  *Dependencies:* None.  
  *Expected Outcome:* Git initialized with clean ignore rules preventing credential and build artifact leakage. (Verified: Git initialized, .gitignore created, secrets protected).

- [x] **FND-002** `[P0]` — Create root `.env.example` file documenting all environment variable keys and descriptions.  
  *Dependencies:* None.  
  *Expected Outcome:* Template documenting `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `OPA_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`. (Verified: .env.example created with Gemini 3.8 Flash and Supabase Cyber hunt endpoints).

- [x] **FND-003** `[P0]` — Scaffold `backend/` directory structure and create Python virtual environment.  
  *Dependencies:* FND-001.  
  *Expected Outcome:* Isolated Python 3.13+ `.venv` active in project workspace. (Verified: Python 3.13.17 virtual environment created in `.venv` and all backend subdirectories scaffolded).

- [x] **FND-004** `[P0]` — Create `backend/requirements.txt` with frozen dependencies and verify installation.  
  *Dependencies:* FND-003.  
  *Expected Outcome:* FastAPI, Uvicorn, LangGraph, Google-GenAI, Pydantic-Settings, Supabase, Presidio, HTTPX, and Pytest installed cleanly. (Verified: All packages installed into `.venv` and tested with 100% clean imports).

- [x] **FND-005** `[P0]` — Initialize Next.js 14+ App Router frontend workspace with TypeScript (`frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.mjs`).  
  *Dependencies:* FND-001.  
  *Expected Outcome:* Next.js project scaffolded with App Router enabled and TypeScript support. (Verified: Next.js 14.2 App Router scaffolded and builds successfully).

- [x] **FND-006** `[P0]` — Install and configure Tailwind CSS, PostCSS, Lucide React, Framer Motion, Recharts, and `@supabase/ssr` in `frontend/`.  
  *Dependencies:* FND-005.  
  *Expected Outcome:* `tailwind.config.ts`, `postcss.config.mjs`, and `globals.css` configured with dark-mode color palette definitions. (Verified: Production build `next build` compiled statically with 0 errors).

---

## PHASE 1 — Backend Foundation

- [x] **BE-001** `[P0]` — Implement centralized settings management in `backend/app/config.py` using Pydantic `BaseSettings`.  
  *Dependencies:* FND-004.  
  *Expected Outcome:* Type-safe configuration loaded from environment with fallbacks and validation. (Verified: 19 unit tests in `test_config.py` passing; SecretStr masking, defaults, and cached singleton verified).

- [x] **BE-002** `[P0]` — Configure structured JSON logging in `backend/app/core/logging.py`.  
  *Dependencies:* BE-001.  
  *Expected Outcome:* Logs include timestamps, log level, correlation IDs, and simulation context; sensitive fields masked. (Verified: 14 unit tests in `test_logging.py` passing; JSON formatting, contextvars, and recursive secret redaction verified).

- [x] **BE-003** `[P0]` — Implement custom exception hierarchy and global error handlers in `backend/app/core/errors.py`.  
  *Dependencies:* BE-001.  
  *Expected Outcome:* Consistent error envelope `{ "status": "error", "error": { "code": "...", "message": "...", "details": ... } }` returned for all 4xx/5xx responses. (Verified: 32 unit tests in `test_errors.py` passing; all 9 domain exception subclasses, status codes, and uniform response envelopes verified).

- [x] **BE-004** `[P0]` — Create FastAPI application factory in `backend/app/main.py` with CORS configured for Next.js origin (`http://localhost:3000`).  
  *Dependencies:* BE-001, BE-002, BE-003.  
  *Expected Outcome:* FastAPI application starts cleanly with CORS configured for Next.js frontend communication. (Verified: 5 tests in `test_main_and_health.py` passing; CORS preflight and origin headers verified for `http://localhost:3000`).

- [x] **BE-005** `[P0]` — Implement system health-check endpoint `GET /api/v1/health`.  
  *Dependencies:* BE-004.  
  *Expected Outcome:* Returns HTTP 200 with service health statuses (FastAPI, Supabase, OPA, Gemini). (Verified: 12 tests in `test_main_and_health.py` passing; probes for Supabase, OPA, and Gemini key presence verified with zero credential leakage).

- [x] **BE-006** `[P0]` — Implement common Pydantic response models and query parameter helpers in `backend/app/schemas/common.py`.  
  *Dependencies:* BE-001.  
  *Expected Outcome:* Reusable models for pagination, status responses, and filter params. (Verified: 27 unit tests in `test_schemas.py` passing; `SimulationState`, `ThreatSeverity`, `PolicyDecisionEnum`, `SuccessResponse`, `ErrorResponse`, `PaginationParams`, and `PaginatedResponse` verified).

---

## PHASE 2 — Database and Authentication

- [x] **DB-001** `[P0]` — Author comprehensive SQL migration script `supabase/migrations/20261031000000_init_cyberhunt_schema.sql`.  
  *Dependencies:* FND-002.  
  *Expected Outcome:* DDL defining all 10 PRD tables (`profiles`, `simulations`, `simulation_events`, `agent_runs`, `attack_logs`, `defence_logs`, `policy_decisions`, `approval_requests`, `tool_logs`, `round_results`). (Verified: 10 tables + indexes + RLS policies + trigger defined).

- [x] **DB-002** `[P0]` — Apply database schema and create required indexes in Supabase PostgreSQL.  
  *Dependencies:* DB-001.  
  *Expected Outcome:* All 10 tables exist in Supabase with indexes on `(simulation_id, sequence_number)`, `owner_id`, and timestamps. (Verified via Supabase MCP: all 10 tables present with `rls_enabled: true` and 12 indexes verified in pg_indexes).

- [x] **DB-003** `[P0]` — Configure Row-Level Security (RLS) policies for all simulation and audit tables.  
  *Dependencies:* DB-002.  
  *Expected Outcome:* Users can only access their own simulations; approvers can access approvals; judges have read-only access. (Verified: 25 RLS policies active in pg_policies covering operators, approvers, admins, and judges).

- [x] **DB-004** `[P0]` — Implement Supabase client singleton in `backend/app/db/client.py`.  
  *Dependencies:* BE-001, DB-002.  
  *Expected Outcome:* Backend can securely query Supabase using the service-role key. (Verified: 6 unit tests passing in `test_db_client.py`; lifecycle, error mapping, and secrets protection confirmed).

- [x] **DB-005** `[P0]` — Implement repository layer modules in `backend/app/db/repositories/`.  
  *Dependencies:* DB-004.  
  *Expected Outcome:* CRUD operations encapsulated for simulations, events, agent runs, approvals, and logs. (Verified: 12 unit tests passing in `test_repositories.py`; covers SimulationRepo, EventRepo, ApprovalRepo, AuditRepo, ProfileRepo, and BaseRepo error wrapping).

- [x] **DB-006** `[P0]` — Implement JWT authentication dependency in `backend/app/dependencies.py`.  
  *Dependencies:* DB-004.  
  *Expected Outcome:* FastAPI routes extract and verify Supabase JWT; inject authenticated `current_user` and role. (Verified: 10 unit tests passing in `test_auth_and_rbac.py`; expiry check, malformed token rejection, user metadata resolution, and RBAC guards confirmed).

- [x] **DB-007** `[P1]` — Implement automatic user profile creation trigger on Supabase Auth signup.  
  *Dependencies:* DB-002.  
  *Expected Outcome:* When a user signs up via Supabase Auth, a corresponding record is automatically inserted into `profiles`. (Verified: `handle_new_user()` trigger applied to `auth.users` in Supabase).

---

## PHASE 3 — Gemini Integration

- [x] **AI-001** `[P0]` — Implement Gemini client wrapper in `backend/app/ai/gemini_client.py`.  
  *Dependencies:* BE-001, FND-004.  
  *Expected Outcome:* Client initializes with `GEMINI_API_KEY` and configurable model ID (defaulting to fast flash models). (Verified: `GeminiClient` with lazy `genai.Client` initialization, server-side secret handling, and model configurability).

- [x] **AI-002** `[P0]` — Implement structured output enforcement using Pydantic schemas in `backend/app/ai/gemini_client.py`.  
  *Dependencies:* AI-001.  
  *Expected Outcome:* Gemini API returns strictly validated JSON mapped directly to Pydantic models. (Verified: `RedAttackPayload`, `TargetProposal`, `GuardianAssessment` validated via `types.GenerateContentConfig` and Pydantic v2).

- [x] **AI-003** `[P0]` — Implement exponential backoff retry mechanism with jitter for Gemini API calls.  
  *Dependencies:* AI-001.  
  *Expected Outcome:* Automatic retries on HTTP 429 rate limits or transient 5xx timeouts (up to 3 attempts). (Verified: Exponential backoff with jitter up to 3 attempts for 429, 500, 503, 504, and TimeoutError).

- [x] **AI-004** `[P0]` — Implement agent execution latency and token metrics tracking.  
  *Dependencies:* AI-001.  
  *Expected Outcome:* Invocations return latency in milliseconds and token counts for observability. (Verified: `latency_ms` and `TokenUsage(input_tokens, output_tokens, total_tokens)` extracted and returned in `GeminiExecutionResult`).

- [x] **AI-005** `[P0]` — Implement fail-closed fallback handler when model fails repeatedly.  
  *Dependencies:* AI-003.  
  *Expected Outcome:* Unresolvable model failures return safe error models rather than raising unhandled exceptions. (Verified: `GuardianAssessment.fail_closed_fallback` returns `risk_score=1.0`, `threat_detected=True`, `recommended_action=BLOCK`).

- [x] **AI-006** `[P1]` — Implement unit tests with mocked Gemini responses in `backend/tests/unit/test_gemini_client.py`.  
  *Dependencies:* AI-002, AI-003.  
  *Expected Outcome:* Test suite validates structured JSON parsing, retry logic, and timeout fallbacks. (Verified: 10 mock-based unit tests passing in `test_gemini_client.py`).

---

## PHASE 4 — Multi-Agent Architecture

- [x] **ORCH-001** `[P0]` — Define typed `SimulationState` in `backend/app/orchestration/state.py`.  
  *Dependencies:* BE-006.  
  *Expected Outcome:* TypedDict representing complete multi-agent simulation state including step, inputs, outputs, decisions, and history. (Verified: `SimulationState` TypedDict and `create_initial_state` helper verified).

- [x] **ORCH-002** `[P0]` — Define LangGraph `StateGraph` skeleton in `backend/app/orchestration/graph.py`.  
  *Dependencies:* ORCH-001.  
  *Expected Outcome:* Graph initialized with typed state and compile method. (Verified: `build_simulation_graph` compiles LangGraph workflow with configurable checkpointer).

- [x] **ORCH-003** `[P0]` — Implement agent node interfaces with input/output validation in `backend/app/orchestration/nodes/`.  
  *Dependencies:* ORCH-002.  
  *Expected Outcome:* Nodes for Red Team, Target AI, Blue Team Guardian, Presidio, Policy Evaluation, Tool Gateway, and Score Update. (Verified: All 7 modular nodes implemented with strict validation and fail-closed security).

- [x] **ORCH-004** `[P0]` — Implement conditional edges and routing logic in `backend/app/orchestration/graph.py`.  
  *Dependencies:* ORCH-003.  
  *Expected Outcome:* Branches dynamically route to Tool Execution (`ALLOW`), Skip/Record (`BLOCK`), or Pause (`REQUIRE_APPROVAL`). (Verified: Conditional routing for `ALLOW`, `BLOCK`, and `REQUIRE_APPROVAL` tested and passing).

- [x] **ORCH-005** `[P0]` — Implement state checkpointing in `backend/app/orchestration/checkpointer.py`.  
  *Dependencies:* ORCH-002, DB-005.  
  *Expected Outcome:* State snapshot saved to database after each step transition enabling session recovery. (Verified: Upgraded from MemorySaver to durable PostgreSQL checkpointer via `langgraph-checkpoint-postgres` and `psycopg_pool`; restart recovery and interrupt state persistence verified).

- [x] **ORCH-006** `[P0]` — Implement pause-and-resume interrupt primitives for human approval.  
  *Dependencies:* ORCH-004, ORCH-005.  
  *Expected Outcome:* LangGraph execution cleanly pauses on `REQUIRE_APPROVAL` and resumes when approval payload is delivered. (Verified: LangGraph `interrupt()` pauses graph; resumption via `Command(resume=...)` verified for both `APPROVED` and `REJECTED` branches).

- [x] **ORCH-007** `[P1]` — Test full graph traversal using synthetic/mock agent nodes.  
  *Dependencies:* ORCH-004.  
  *Expected Outcome:* End-to-end loop executes across all states without hanging or state corruption. (Verified: 8 tests in `test_orchestration.py` passing across all paths, multi-step runs, and recovery).

---

## PHASE 5 — Dynamic Red Team

- [x] **RED-001** `[P0]` — Define `RedTeamAttack` Pydantic schema in `backend/app/schemas/agent.py`.  
  *Dependencies:* BE-006.  
  *Expected Outcome:* Structured model with `attack_id`, `category`, `intended_goal`, `strategy_summary`, `payload_text`, and `target_surface`. (Verified: `RedTeamAttack` with length constraints and all 6 PRD categories defined and tested).

- [x] **RED-002** `[P0]` — Implement Red Team prompt templates in `backend/app/ai/prompts/red_team.py` for Core MVP categories:  
  - Direct Prompt Injection (Category A)  
  - Email-based Indirect Injection (Category B)  
  - Unauthorized Payment/Action (Category F)  
  *Dependencies:* RED-001.  
  *Expected Outcome:* High-potency adversarial prompt templates constrained to synthetic environment facts. (Verified: Core MVP categories implemented with synthetic environment constraints).

- [x] **RED-003** `[P0]` — Implement `node_red_team` in `backend/app/orchestration/nodes/red_team_node.py`.  
  *Dependencies:* RED-002, AI-002.  
  *Expected Outcome:* Invokes Gemini with scenario parameters; validates and injects `RedTeamAttack` into graph state. (Verified: Dynamic generation via GeminiClient with fallback generator on unconfigured/failed states).

- [x] **RED-004** `[P1]` — Implement adaptive attack strategy injection using prior round outcomes.  
  *Dependencies:* RED-003.  
  *Expected Outcome:* Red Team ingests reasons for previous blocks and mutates payloads to bypass known rules. (Verified: `build_red_team_prompt` ingests past block reasons, mutates strategy, and enforces bounded 3-round window).

- [x] **RED-005** `[P1]` — Implement Red Team prompt templates for remaining categories:  
  - Webpage-based Injection (Category C)  
  - Document-based Injection (Category D)  
  - Data Exfiltration Attempt (Category E)  
  *Dependencies:* RED-002.  
  *Expected Outcome:* Complete coverage across all 6 PRD attack families. (Verified: Complete guidelines and reference examples for all 6 PRD attack categories in `CATEGORY_GUIDELINES`).

- [x] **RED-006** `[P0]` — Log generated attack telemetry to `attack_logs` table.  
  *Dependencies:* RED-003, DB-005.  
  *Expected Outcome:* Attack metadata, payload text, target surface, and generation validity saved to database. (Verified: AuditRepository telemetry persistence to Supabase with non-fatal error isolation tested).

---

## PHASE 6 — Target AI

- [x] **TGT-001** `[P0]` — Define `TargetAIResponse` and `ToolActionProposal` schemas in `backend/app/schemas/tool.py`.  
  *Dependencies:* BE-006.  
  *Expected Outcome:* Models capturing `thought_process`, `user_response`, `tool_name`, `operation`, `parameters`, and `rationale`. (Verified: `ToolActionProposal` and `TargetAIResponse` with length constraints and `ToolName` enum defined and tested).

- [x] **TGT-002** `[P0]` — Implement Target AI system prompt in `backend/app/ai/prompts/target_ai.py`.  
  *Dependencies:* TGT-001.  
  *Expected Outcome:* Prompt instructs agent to perform user task, treats `<untrusted_content>` as data only, and exposes tool signatures. (Verified: `TARGET_AI_SYSTEM_INSTRUCTION` and `build_target_ai_prompt` implement strict XML tag isolation and synthetic tool specs).

- [x] **TGT-003** `[P0]` — Implement `node_target_ai` in `backend/app/orchestration/nodes/target_ai_node.py`.  
  *Dependencies:* TGT-002, AI-002.  
  *Expected Outcome:* Processes task and untrusted payload; outputs user response and structured tool proposal if needed. (Verified: Dynamic Gemini generation with safe deterministic fallback logic tested and passing).

- [x] **TGT-004** `[P0]` — Enforce strict isolation: ensure Target AI has zero direct execution capabilities.  
  *Dependencies:* TGT-003.  
  *Expected Outcome:* Target AI only emits declarative JSON proposals; never directly invokes Python tool methods. (Verified: Target AI node only produces declarative proposal dictionary; zero tool execution imports or calls confirmed via inspection and test).

- [x] **TGT-005** `[P0]` — Implement benign task controls to measure legitimate task completion.  
  *Dependencies:* TGT-003.  
  *Expected Outcome:* Target AI successfully solves tasks when untrusted payload is benign or absent. (Verified: Tested email, payment, browser, file, and conversational tasks; verified refusal of malicious injection).

- [x] **TGT-006** `[P0]` — Record Target AI run metrics and latency in `agent_runs` table.  
  *Dependencies:* TGT-003, DB-005.  
  *Expected Outcome:* Latency, tokens, and response status persisted. (Verified: AuditRepository telemetry logging to Supabase `agent_runs` table with non-fatal error isolation tested).

---

## PHASE 7 — Blue Team Guardian

- [x] **BLUE-001** `[P0]` — Define `GuardianAssessment` schema in `backend/app/schemas/agent.py`.  
  *Dependencies:* BE-006.  
  *Verified:* Added `GuardianRecommendation` enum (ALLOW/MONITOR/BLOCK/REQUIRE_APPROVAL), updated `GuardianAssessment.recommended_action` to use it, added `min_length=3` on `explanation`, updated `fail_closed_fallback()` to return `GuardianRecommendation.BLOCK`. Policy node updated to treat MONITOR as ALLOW. 241/241 tests passing.

- [x] **BLUE-002** `[P0]` — Implement Blue Team Guardian evaluation prompt in `backend/app/ai/prompts/blue_team.py`.  
  *Dependencies:* BLUE-001.  
  *Verified:* Created `GUARDIAN_SYSTEM_INSTRUCTION` and `build_guardian_prompt()` with 9-point detection rubric (direct injection, indirect injection, system override, privilege escalation, unauthorized tool usage, sensitive data access, data exfiltration, unauthorized payment, tool parameter divergence). Fail-closed guidance included. Advisory-only constraint explicit. 241/241 tests passing.

- [x] **BLUE-003** `[P0]` — Implement Gemini-powered Guardian node in `backend/app/orchestration/nodes/guardian_node.py`.  
  *Dependencies:* BLUE-002, AI-002.  
  *Verified:* Upgraded `guardian_node` to use `GeminiClient.generate_structured(GuardianAssessment)`. Falls back to deterministic `_heuristic_assessment()` when Gemini unconfigured or fails. Returns only `guardian_assessment` + `status`. 241/241 tests passing.

- [x] **BLUE-004** `[P0]` — Enforce advisory-only boundary for Guardian agent.  
  *Dependencies:* BLUE-003.  
  *Verified:* `guardian_node.py` imports no tool gateway, no approval node, no execution modules. Source inspection test confirms boundary. Returns only `{"guardian_assessment": ..., "status": "ANALYSING"}`. OPA `policy_evaluation_node` makes all routing decisions. 241/241 tests passing.

- [x] **BLUE-005** `[P0]` — Log Guardian assessment and indicators to `defence_logs` table.  
  *Dependencies:* BLUE-003, DB-005.  
  *Verified:* `AuditRepository.record_defence_log()` called with risk_score, severity, indicators, explanation, recommendation. UUID validation prevents synthetic test ID persistence. DB failure is non-fatal (logged as warning). 241/241 tests passing.

- [x] **BLUE-006** `[P1]` — Test Guardian accuracy against benchmark dataset of injections and benign tasks.  
  *Dependencies:* BLUE-003.  
  *Verified:* 14-case benchmark (8 malicious + 6 benign) run against heuristic fallback. Results: TP=8, TN=6, FP=0, FN=0 → Precision=1.000, Recall=1.000, F1=1.000. All acceptance criteria exceeded (Precision≥0.85, Recall≥0.80). 48 Blue Team tests in `test_blue_team.py` passing. Full suite: 241/241.

---

## PHASE 8 — Security Enforcement (OPA & Presidio)

- [x] **SEC-001** `[P0]` — Author base deny-by-default Rego policy in `backend/policies/base.rego`.  
  *Dependencies:* FND-001.  
  *Verified:* Implemented deny-by-default base policy defaulting to `BLOCK` (`DEFAULT_DENY`). Enforces strict input validation, allowlisted tool/operation matrix, and independent verification of Guardian risk scores (>=0.9 triggers `CRITICAL_RISK_SCORE_BLOCKED`). Verified in `test_security_enforcement.py`.

- [x] **SEC-002** `[P0]` — Author high-impact and monetary action policy in `backend/policies/high_impact.rego`.  
  *Dependencies:* SEC-001.  
  *Verified:* Enforces human approval (`REQUIRE_APPROVAL`) for payments >$500 threshold, payments to unrecognized/missing vendors, and payment actions generally. Blocks malformed payment amounts and transactions exceeding hard ceiling ($10,000). Action hash binding validated. Verified in `test_security_enforcement.py`.

- [x] **SEC-003** `[P1]` — Author data exfiltration Rego policy in `backend/policies/data_exfil.rego`.  
  *Dependencies:* SEC-001.  
  *Verified:* Blocks outbound exfiltration operations targeting unverified destinations or containing Presidio PII/sensitive classifications (`PII`, `API_KEY`, `SSN`, `FINANCIAL`, `CONFIDENTIAL`). Permits clean internal operations. Verified in `test_security_enforcement.py`.

- [x] **SEC-004** `[P0]` — Implement `backend/app/security/opa_client.py` for evaluating OPA decisions.  
  *Dependencies:* BE-001, SEC-001.  
  *Verified:* Implemented `OPAClient` querying OPA REST API (`POST /v1/data/cyberhunt/authz`). Parses ALLOW, BLOCK, REQUIRE_APPROVAL. Enforces strict fail-closed (`BLOCK`) on connection refused, timeouts, HTTP errors, malformed JSON, and unknown decisions. Never authorizes actions via local evaluator or LLM fallbacks when OPA is unavailable. Isolated test evaluator preserved for standalone fixtures only. 37/37 security tests passing.

- [x] **SEC-005** `[P1]` — Implement `backend/app/security/presidio_scanner.py` for sensitive entity detection.  
  *Dependencies:* FND-004.  
  *Verified:* Integrated Microsoft Presidio `AnalyzerEngine` using Spacy `en_core_web_sm` model and custom regex recognizers for API keys (generic `sk-`, AWS `AKIA...`, JWTs), emails, and US SSNs. Structured `PresidioScanResult` and recursive parameter scanning implemented. Verified with both positive detection and false-positive checks.

- [x] **SEC-006** `[P0]` — Implement SHA-256 action hash calculation and verification in `backend/app/security/validator.py`.  
  *Dependencies:* BE-006.  
  *Verified:* Implemented `canonical_json` recursive serialization and `compute_action_hash(simulation_id, tool, operation, params)`. Verified that key order variations preserve hash, parameter tampering invalidates hash, and constant-time `verify_action_hash` rejects unauthorized changes.

- [x] **SEC-007** `[P0]` — Implement `node_opa_eval` in `backend/app/orchestration/nodes/opa_node.py` and log to `policy_decisions`.  
  *Dependencies:* SEC-004, SEC-006, DB-005.  
  *Verified:* Implemented `node_opa_eval`, aggregating Target proposal, Guardian assessment, Presidio scan, action hash, and simulation context into OPA evaluation. Persists decision to Supabase `policy_decisions`. Strictly fails closed: if audit persistence fails, action is converted to `BLOCK` (`AUDIT_PERSISTENCE_FAILED`, status `FAILED`) preventing tool execution. Correct LangGraph conditional routing for ALLOW (`tool_gateway`), REQUIRE_APPROVAL (`human_approval`), and BLOCK (`score_update`). Full suite: 278/278 passing.

---

## PREREQUISITE CORRECTION — Durable PostgreSQL Checkpointing

- [x] **CHK-001** `[P0]` — Replace `MemorySaver` with PostgreSQL checkpointer in `backend/app/orchestration/checkpointer.py`.  
  *Dependencies:* DB-001, ORCH-005.  
  *Verified:* Integrated `langgraph-checkpoint-postgres>=3.2.0` and `psycopg[binary,pool]>=3.3.0`. Implemented `init_postgres_checkpointer()`, `get_checkpointer()`, and `close_postgres_checkpointer()`. Enforces strict fail-closed: raises `ConfigurationError`/`DatabaseError` without falling back to `MemorySaver` in production. Credential logging masked (`_redact_conn_string`). Checkpoint schema migrations verified. 9/9 tests in `test_durable_checkpointing.py` passing.

- [x] **CHK-002** `[P0]` — Verify durable recovery across simulated backend restarts and human approval resumption.  
  *Dependencies:* CHK-001, ORCH-006.  
  *Verified:* Automated test verifies full lifecycle across process lifetimes: Graph instance 1 hits `human_approval` `interrupt()`, Graph 1 is destroyed, new Graph instance 2 connects to persistent checkpointer, recovers pending approval state by `thread_id`, and resumes with `Command(resume=...)` continuing to `tool_gateway` on `APPROVED` or blocking on `REJECTED`. All 287 backend unit tests passing.

---

## PHASE 9 — Mock Tool Gateway

- [x] **TOOL-001** `[P0]` — Implement Mock Tool Gateway core in `backend/app/mock_tools/gateway.py`.  
  *Dependencies:* SEC-006, BE-006.  
  *Expected Outcome:* Verifies OPA authorization and action hash integrity before allowing any tool execution; enforces zero real egress.

- [x] **TOOL-002** `[P0]` — Implement Mock Email Tool in `backend/app/mock_tools/email_tool.py`.  
  *Dependencies:* TOOL-001.  
  *Expected Outcome:* Simulated `search_inbox`, `read_email`, `send_email` against local synthetic fixture data; zero external network access.

- [x] **TOOL-003** `[P0]` — Implement Mock Payment Tool in `backend/app/mock_tools/payment_tool.py`.  
  *Dependencies:* TOOL-001.  
  *Expected Outcome:* Simulated `get_balance`, `execute_transfer` against in-memory ledger with balance checks.

- [x] **TOOL-004** `[P1]` — Implement Mock Browser Tool in `backend/app/mock_tools/browser_tool.py`.  
  *Dependencies:* TOOL-001.  
  *Expected Outcome:* `fetch_page` reading local HTML fixtures; public web requests unconditionally blocked.

- [x] **TOOL-005** `[P1]` — Implement Mock File Tool in `backend/app/mock_tools/file_tool.py`.  
  *Dependencies:* TOOL-001.  
  *Expected Outcome:* Sandboxed virtual filesystem operations (`read_file`, `write_file`) restricted to isolated memory directory.

- [x] **TOOL-006** `[P0]` — Implement synthetic test fixtures in `backend/fixtures/` (emails, ledger records, documents).  
  *Dependencies:* TOOL-002, TOOL-003.  
  *Expected Outcome:* Realistic, non-malicious synthetic data populated for all scenarios.

- [x] **TOOL-007** `[P0]` — Implement `node_tool_gate` in LangGraph and log execution results to `tool_logs`.  
  *Dependencies:* TOOL-001, DB-005.  
  *Expected Outcome:* Dispatches authorized actions to mock tools; records execution status and result summary.

---

## PHASE 10 — Simulation Engine

- [x] **SIM-001** `[P0]` — Implement simulation lifecycle manager in `backend/app/orchestration/manager.py` supporting states: `CREATED`, `INITIALIZING`, `RUNNING`, `ANALYSING`, `AWAITING_APPROVAL`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`.  
  *Dependencies:* ORCH-002, DB-005.  
  *Expected Outcome:* Methods for `create_simulation`, `start_simulation`, `pause_simulation`, `resume_simulation`, `stop_simulation` with strict state validation.

- [x] **SIM-002** `[P0]` — Implement REST endpoints in `backend/app/api/v1/simulations.py` for lifecycle control.  
  *Dependencies:* SIM-001, DB-006.  
  *Expected Outcome:* Authenticated POST endpoints for simulation CRUD and state transitions.

- [x] **SIM-003** `[P0]` — Implement background task execution runner for LangGraph simulations.  
  *Dependencies:* SIM-001.  
  *Expected Outcome:* Simulation loop runs asynchronously in background tasks without blocking HTTP server worker.

- [x] **SIM-004** `[P0]` — Implement human-in-the-loop approval workflow:  
  - Create approval request in `approval_requests` with `action_hash`.  
  - Transition state to `AWAITING_APPROVAL`.  
  *Dependencies:* SIM-001, SEC-007.  
  *Expected Outcome:* Execution cleanly halts pending authorized approval.

- [x] **SIM-005** `[P0]` — Implement approval decision endpoint `POST /api/v1/approvals/{id}/decision`.  
  *Dependencies:* SIM-004, DB-006.  
  *Expected Outcome:* Approver verifies action hash, submits decision (`APPROVED` | `REJECTED`), resumes graph execution.

- [x] **SIM-006** `[P0]` — Implement bounded step limits and timeout termination.  
  *Dependencies:* SIM-001.  
  *Expected Outcome:* Simulation terminates with status `COMPLETED` when step limit is reached or operator stops run.

- [x] **SIM-007** `[P0]` — Implement step-level scoring and final metric calculation in `round_results`.  
  *Dependencies:* SIM-006, DB-005.  
  *Expected Outcome:* Computes attack success, detection rate, block rate, benign task completion, and false positives.

- [x] **SIM-008** `[P1]` — Implement simulation recovery mechanism on server restart.  
  *Dependencies:* SIM-001, ORCH-005.  
  *Expected Outcome:* Paused or interrupted simulations can be reloaded and resumed from last checkpoint.

---

## PHASE 11 — Real-Time Communication

- [x] **WS-001** `[P0]` — Define standardized `SimulationEvent` schema in `backend/app/schemas/event.py` supporting all 14 PRD event types:  
  `simulation.created`, `simulation.status_changed`, `red_team.attack_generated`, `target_ai.response_ready`, `target_ai.action_proposed`, `guardian.analysis_completed`, `policy.decision_made`, `approval.requested`, `approval.resolved`, `tool.executed`, `tool.blocked`, `score.updated`, `simulation.completed`, `simulation.failed`.  
  *Dependencies:* BE-006.  
  *Expected Outcome:* Strict envelope with `event_id`, `simulation_id`, `sequence_number`, `event_type`, `timestamp`, `schema_version`, `payload`. (Verified: Schema created with EventType enum, SimulationEvent model, and EventReplayResponse. Tested in test_websocket_communication.py).

- [x] **WS-002** `[P0]` — Implement WebSocket endpoint `WebSocket /api/v1/ws/simulations/{id}` in `backend/app/api/v1/ws.py`.  
  *Dependencies:* WS-001.  
  *Expected Outcome:* Manages active client connections per simulation; authenticates incoming socket connections from Next.js clients. (Verified: ConnectionManager maintains per-simulation client sets with graceful connect/disconnect and room isolation).

- [x] **WS-003** `[P0]` — Implement event broadcaster utility linked to LangGraph state transitions.  
  *Dependencies:* WS-002, ORCH-003.  
  *Expected Outcome:* Events emitted immediately when an agent completes, a policy decides, or a tool executes. (Verified: Broadcaster `emit_simulation_event` calculates monotonic sequence numbers, persists append-only to Supabase repository, and broadcasts asynchronously to connected subscribers).

- [x] **WS-004** `[P0]` — Implement append-only event persistence in `backend/app/db/repositories/event_repo.py`.  
  *Dependencies:* WS-001, DB-005.  
  *Expected Outcome:* Every event persisted to `simulation_events` with monotonically increasing sequence number before broadcast. (Verified: EventRepository provides `record_event`, `list_events_for_simulation`, and sequence queries with test isolation).

- [x] **WS-005** `[P0]` — Implement event replay endpoint `GET /api/v1/simulations/{id}/events`.  
  *Dependencies:* WS-004.  
  *Expected Outcome:* Supports `after_sequence` query parameter for Next.js client reconnect recovery. (Verified: Endpoint returns replay envelope with event list and last sequence number filtered by after_sequence/from_sequence).

- [x] **WS-006** `[P1]` — Implement client ping/pong heartbeat to detect dead connections.  
  *Dependencies:* WS-002.  
  *Expected Outcome:* Stale WebSocket connections pruned automatically. (Verified: Text/JSON `ping` message receives `pong` response; broken socket writes are caught, removed from active subscriptions, and never block simulation execution).

---

## PHASE 11.1 — Google Gmail OAuth 2.0 & Inbound Email Ingestion

- [x] **GMAIL-001** `[P0]` — Configure Google OAuth 2.0 Settings in `backend/app/config.py` and `.env.example`.  
  *Dependencies:* BE-001.  
  *Expected Outcome:* `google_client_id`, `google_client_secret` (SecretStr), and `google_redirect_uri` configured with safe property validation without leaking secrets. (Verified: `has_google_oauth` property and settings validated in `test_gmail_oauth.py`).

- [x] **GMAIL-002** `[P0]` — Define Gmail OAuth & Inbound Email Schemas in `backend/app/schemas/gmail.py`.  
  *Dependencies:* BE-006.  
  *Expected Outcome:* Pydantic schemas for `GmailConnectResponse`, `GmailStatusResponse`, `GmailCallbackResponse`, `GmailDisconnectResponse`, `EmailAttachment`, `IncomingEmailPayload`, and `GmailSyncResponse`. Enforces `GMAIL_READONLY_SCOPE`. (Verified: All schemas verified with strict field validation).

- [x] **GMAIL-003** `[P0]` — Implement Attachment Sanitizer & Text Extractor in `backend/app/security/email_sanitizer.py`.  
  *Dependencies:* GMAIL-002.  
  *Expected Outcome:* Safely strips HTML, extracts text from `.txt` and `.pdf` attachments without external execution, enforces 5MB size limit, and blocks dangerous executable/script extensions (`.exe`, `.bat`, `.sh`, `.ps1`, etc.). (Verified: Sanitizer tests pass in `TestAttachmentAndEmailSanitization`).

- [x] **GMAIL-004** `[P0]` — Implement Centralized Gmail Service & Token Store in `backend/app/security/gmail_service.py`.  
  *Dependencies:* GMAIL-001, GMAIL-003.  
  *Expected Outcome:* Single-use CSRF state generation (10m TTL), authorization code exchange, automated token refresh, token revocation, and strict read-only prohibition guards raising `PermissionError` on send/modify/delete/reply attempts. (Verified: 10 tests passing in `TestOAuthStateManagement`, `TestAuthorizationCodeExchange`, `TestTokenRefresh`, `TestStrictReadOnlyProhibitions`).

- [x] **GMAIL-005** `[P0]` — Implement FastAPI Gmail OAuth Routes in `backend/app/api/v1/gmail.py` and register in `router.py`.  
  *Dependencies:* GMAIL-004.  
  *Expected Outcome:* `GET /connect`, `GET /callback`, `GET /status`, `POST /disconnect`, and `POST /sync`. Tokens kept strictly server-side. (Verified: Endpoints tested with httpx in `TestGmailAPIEndpoints`).

- [x] **GMAIL-006** `[P0]` — Integrate Inbound Email with `SimulationManager.inject_incoming_email()`.  
  *Dependencies:* GMAIL-004, SIM-001.  
  *Expected Outcome:* Ingests parsed messages with sanitized attachments into simulation pipeline, marking `is_untrusted=True` and redacting private tokens before emitting `email.received` event. (Verified: Tested in `TestSimulationManagerEmailHook`).

- [x] **GMAIL-007** `[P0]` — Automated Test Suite in `backend/tests/unit/test_gmail_oauth.py`.  
  *Dependencies:* GMAIL-001 through GMAIL-006.  
  *Expected Outcome:* Comprehensive tests covering state validation, code exchange, scope checks, token refresh, status masking, disconnect, read-only prohibitions, attachment sanitization, and simulation integration. (Verified: 28/28 tests passing).

- [x] **GMAIL-008** `[P0]` — Encrypted Token Storage at Rest using Fernet AES-128-CBC (`backend/.gmail_token.enc`).  
  *Dependencies:* GMAIL-004.  
  *Expected Outcome:* OAuth access and refresh tokens encrypted with Fernet cipher derived from server secrets; auto-loaded on backend restart; deleted on disconnect; zero plaintext leakage. (Verified: Tested in `TestTokenEncryptionAtRest`).

- [x] **GMAIL-009** `[P0]` — Real Inbox Message Retrieval (`GET /api/v1/auth/gmail/messages`) & Duplicate Prevention.  
  *Dependencies:* GMAIL-004, GMAIL-005.  
  *Expected Outcome:* Fetches actual sanitized emails for dashboard display without requiring an active simulation; tracks seen `message_id`s in `_processed_message_ids` to prevent duplicate ingestion. (Verified: Tested in `TestDuplicateMessageHandling`).

- [x] **GMAIL-010** `[P0]` — Google Cloud Pub/Sub Push Webhook (`POST /api/v1/auth/gmail/webhook`) & Watch Registration (`POST /api/v1/auth/gmail/watch`).  
  *Dependencies:* GMAIL-004, GMAIL-006.  
  *Expected Outcome:* Supports real-time push ingestion via Google Cloud Pub/Sub; provides safe fallback and configuration instructions when Pub/Sub is unconfigured. (Verified: Tested in `TestPubSubWatchAndWebhook`).

---

## PHASE 12 — Frontend Foundation (Next.js App Router)

- [x] **FE-001** `[P0]` — Configure Tailwind CSS tokens, typography, and dark theme colors in `frontend/src/app/globals.css`.  
  *Dependencies:* FND-006.  
  *Expected Outcome:* Dark cybersecurity design system active (`#0a0d14` background, card surfaces `#111827`, borders `#1f2937`). (Verified: Tailwind config extended with neon/alert color tokens, glow box-shadows, and keyframe animations; `next build` passes with 0 errors.)

- [x] **FE-002** `[P0]` — Create Next.js Root Layout in `frontend/src/app/layout.tsx`.  
  *Dependencies:* FE-001.  
  *Expected Outcome:* Sets page metadata, root HTML/body structure, global fonts, and wraps children. (Verified: layout.tsx present and unchanged from scaffold; global CSS updated.)

- [x] **FE-003** `[P0]` — Configure TypeScript types mirroring FastAPI Pydantic schemas in `frontend/src/types/`.  
  *Dependencies:* BE-006, WS-001.  
  *Expected Outcome:* Type definitions for `Simulation`, `SimulationEvent`, `RedAttack`, `TargetProposal`, `GuardianAssessment`, `PolicyDecision`, `ToolResult`. (Verified: `src/types/dashboard.ts` implements all interfaces derived from actual `event.py` payload contracts — EmailItem, TargetAIState, BlueTeamState, SimulationEvent, GmailStatus, SimulationRecord.)

- [x] **FE-004** `[P0]` — Configure Supabase browser client and server client helpers in `frontend/src/lib/supabase/`.  
  *Dependencies:* FND-005, DB-003.  
  *Expected Outcome:* `client.ts` uses `createBrowserClient` and `server.ts` uses `createServerClient` from `@supabase/ssr`.

- [x] **FE-005** `[P0]` — Implement `AuthContext` and authentication state provider in `frontend/src/context/AuthContext.tsx`.  
  *Dependencies:* FE-004.  
  *Expected Outcome:* Manages user session, sign-in, sign-up, sign-out, and user role (`operator`, `approver`, `judge`).

- [x] **FE-006** `[P0]` — Implement reusable UI primitives in `frontend/src/components/ui/`.  
  *Dependencies:* FE-001.  
  *Expected Outcome:* Reusable components for `Button`, `Badge`, `Card`, `Modal`, `Input`, `Select`, and `CodeBlock`.

- [x] **FE-007** `[P0]` — Implement persistent layout components in `frontend/src/components/layout/`.  
  *Dependencies:* FE-006.  
  *Expected Outcome:* `Navbar.tsx` (user info, status indicator), `Sidebar.tsx` (App Router navigation links), `AppShell.tsx` (responsive container).

- [x] **FE-008** `[P0]` — Implement Landing Page in `frontend/src/app/page.tsx`.  
  *Dependencies:* FE-007.  
  *Expected Outcome:* Hero banner, CYBER HUNT architectural showcase, zero-trust enforcement visual, and "Enter Arena" CTA. (Note: friend's implementation — `page.tsx` preserved untouched. DO NOT MODIFY.)

- [x] **FE-009** `[P0]` — Implement Authentication login/signup page in `frontend/src/app/(auth)/login/page.tsx`.  
  *Dependencies:* FE-005, FE-006.  
  *Expected Outcome:* Clean login and registration cards with Supabase Auth error handling and redirects.

- [x] **FE-010** `[P0]` — Implement FastAPI REST API client in `frontend/src/lib/api.ts`.  
  *Dependencies:* FE-005.  
  *Expected Outcome:* Fetch client with automatic Bearer token injection and error handling communicating with FastAPI. (Verified: `src/lib/api.ts` implements all simulation, Gmail OAuth, and event replay endpoints; LOCAL_DEMO_MODE eliminates auth token requirement for localhost; `next build` 0 errors.)

---

## PHASE 13 — Dashboard and Battle Arena (Next.js)

- [x] **ARENA-001** `[P0]` — Create Dashboard route in `frontend/src/app/dashboard/page.tsx`.  
  *Dependencies:* FE-007, FE-010.  
  *Expected Outcome:* Overview screen with metric summary KPI cards, active simulations grid, and "New Simulation" trigger. (Verified: Full CYBER HUNT cockpit dashboard at `/dashboard` matching reference image — 3-column layout (EmailInboxPanel | TargetAIPanel | BlueTeamPanel), 5 secondary views (Files, Browser, Payment, Results), red alert banner, `next build` ✓ 0 errors.)

- [x] **ARENA-002** `[P0]` — Implement New Simulation Launch Modal in `frontend/src/components/dashboard/`.  
  *Dependencies:* ARENA-001.  
  *Expected Outcome:* Form allowing operator to select scenario category, enter benign task prompt, set step limits, and start run via FastAPI. (Verified: `useSimulationLifecycle` hook reuses active simulation — never auto-creates on refresh. `createNew()` exposed for explicit operator-triggered start.)

- [x] **ARENA-003** `[P0]` — Implement resilient WebSocket client in `frontend/src/hooks/useSimulationSocket.ts`.  
  *Dependencies:* WS-002, WS-005, FE-003.  
  *Expected Outcome:* Connects to FastAPI WebSocket, manages ordered event queue, detects sequence gaps, and triggers replay recovery. (Verified: Exponential backoff reconnect (1→2→4→…→30s), 25s ping heartbeat, sequence deduplication, replay on reconnect via `/simulations/{id}/events`.)

- [x] **ARENA-004** `[P0]` — Implement simulation lifecycle controls hook in `frontend/src/hooks/useSimulationLifecycle.ts`.  
  *Dependencies:* FE-010.  
  *Expected Outcome:* Dispatches pause, resume, stop, and approval commands to FastAPI. (Verified: On mount loads from sessionStorage → GET /simulations/{id} → pick active → never auto-create.)

- [x] **ARENA-005** `[P0]` — Create dynamic simulation arena route in `frontend/src/app/arena/[simulationId]/page.tsx`.  
  *Dependencies:* ARENA-003, ARENA-004.  
  *Expected Outcome:* Real-time arena page loading simulation state, connecting to WebSocket, and rendering multi-panel cockpit.

- [x] **ARENA-006** `[P0]` — Implement multi-agent live cockpit panels in `frontend/src/components/dashboard/`:  
  - `TargetAIPanel.tsx` (email detail, bank-details card, animated progress, rationale)  
  - `EmailInboxPanel.tsx` (Gmail connect/disconnect, real/demo mode badge, spam pills, folder sidebar)  
  *Dependencies:* ARENA-005.  
  *Expected Outcome:* Cards update in real-time as agent events stream in. (Verified: All panels driven by `handleEvent()` dispatcher in `dashboard/page.tsx`; event contracts validated against `backend/app/schemas/event.py`; `next build` ✓.)

- [x] **ARENA-007** `[P0]` — Implement Security Enforcement panel in `frontend/src/components/dashboard/BlueTeamPanel.tsx`.  
  - 4-stage vertical stepper (Email Captured → Threat Analysis → Policy Evaluation OPA → Final Decision)  
  - Detection Status card with Risk Level, Threats Found, Action (OPA) grid  
  *Dependencies:* ARENA-005.  
  *Expected Outcome:* Displays deterministic OPA verdict and threat analysis in real-time. (Verified: All stage transitions driven by guardian.analysis_completed and policy.decision_made events; `next build` ✓.)

- [x] **ARENA-008** `[P0]` — Implement Live Audit Timeline drawer in `frontend/src/components/arena/EventTimeline.tsx`.  
  *Dependencies:* ARENA-005.  
  *Expected Outcome:* Monospaced chronological list of all simulation events with timestamps and expandable JSON payloads.

- [x] **ARENA-009** `[P0]` — Implement Human Approval Modal in `frontend/src/components/approvals/ApprovalModal.tsx`.  
  *Dependencies:* ARENA-005.  
  *Expected Outcome:* Displays automatically when state is `AWAITING_APPROVAL`; shows action diff, action hash, and Approve/Reject buttons.

---

## PHASE 14 — Additional Screens (Next.js App Router)

- [x] **SCRN-001** `[P1]` — Implement Attack Explorer route in `frontend/src/app/attacks/page.tsx`.  
  *Dependencies:* FE-007, DB-005.  
  *Expected Outcome:* Filterable table of past attack payloads by category, outcome, severity, and timestamp (`PayloadTable.tsx`).

- [x] **SCRN-002** `[P1]` — Implement Defence Centre route in `frontend/src/app/defence/page.tsx`.  
  *Dependencies:* FE-007.  
  *Expected Outcome:* Displays active Rego security rules, Guardian indicator catalog, and pending approval queue (`RegoRuleList.tsx`).

- [x] **SCRN-003** `[P1]` — Implement Analytics & Charts route with Recharts in `frontend/src/app/analytics/page.tsx`.  
  *Dependencies:* FE-007.  
  *Expected Outcome:* Interactive charts showing Threat Detection Rate %, Block Rate %, Benign Task Completion %, and Agent Latency.

- [x] **SCRN-004** `[P1]` — Implement Simulation History route in `frontend/src/app/history/page.tsx`.  
  *Dependencies:* FE-007.  
  *Expected Outcome:* Paginated list of completed runs with quick links to replay in Arena or view report.

- [x] **SCRN-005** `[P1]` — Implement Settings & Configuration route in `frontend/src/app/settings/page.tsx`.  
  *Dependencies:* FE-007.  
  *Expected Outcome:* Displays user profile, role permissions, and safe model metadata (never exposes API keys).

- [x] **SCRN-006** `[P1]` — Implement Simulation Report & Evidence modal/view.  
  *Dependencies:* SCRN-004.  
  *Expected Outcome:* Formal security report with complete audit trail, action hashes, and printable layout.

- [x] **SCRN-007** `[P1]` — Implement backend reporting endpoints `GET /api/v1/simulations/{id}/report` and `GET /api/v1/reports/metrics`.  
  *Dependencies:* DB-005.  
  *Expected Outcome:* Returns aggregated security metrics with explicit denominators.

---

## PHASE 15 — Integration and Testing

- [x] **TEST-001** `[P0]` — Implement unit tests for Pydantic schemas, action hash generator, and error handling in `backend/tests/unit/`.  
  *Dependencies:* BE-006, SEC-006.  
  *Expected Outcome:* 100% pass on schema serialization and hash validation.

- [x] **TEST-002** `[P0]` — Implement unit tests for Rego policies in `backend/tests/policy/`.  
  *Dependencies:* SEC-001, SEC-002, SEC-003.  
  *Expected Outcome:* Validates allow, block, and require-approval rules across edge-case inputs.

- [x] **TEST-003** `[P0]` — Implement integration test for complete adversarial flow:  
  `Red Team Attack -> Target Proposal -> Guardian Analysis -> OPA Block -> Tool Gate Deny`.  
  *Dependencies:* ORCH-004, TOOL-007.  
  *Expected Outcome:* Prohibited attack is safely blocked before reaching mock execution.

- [x] **TEST-004** `[P0]` — Implement integration test for benign task flow:  
  `Benign Prompt -> Target Proposal -> Guardian Clean -> OPA Allow -> Mock Tool Execute -> Completed`.  
  *Dependencies:* ORCH-004, TOOL-007.  
  *Expected Outcome:* Benign task executes cleanly and finishes successfully.

- [x] **TEST-005** `[P0]` — Implement integration test for Human-in-the-Loop approval flow:  
  `High Impact Action -> OPA Require Approval -> State Paused -> Approver Decision -> Resume -> Tool Executed`.  
  *Dependencies:* SIM-004, SIM-005.  
  *Expected Outcome:* Approval interrupt halts execution and resumes upon valid decision.

- [x] **TEST-006** `[P0]` — Test WebSocket reconnect and event replay synchronization between Next.js frontend and FastAPI backend.  
  *Dependencies:* WS-005, ARENA-003.  
  *Expected Outcome:* Next.js client reconnects after network drop and receives all missing sequence numbers.

- [x] **TEST-007** `[P0]` — Audit system against all 14 Acceptance Criteria (AC1–AC14) from PRD Section 23.  
  *Dependencies:* TEST-003, TEST-004, TEST-005.  
  *Expected Outcome:* All 14 criteria verified and documented with evidence.

- [x] **TEST-008** `[P0]` — Security boundary audit: Verify no real external API execution and no API key leakage to browser.  
  *Dependencies:* FE-010, TOOL-001.  
  *Expected Outcome:* Codebase and network traffic confirm zero secret exposure and zero real external egress.

---

## PHASE 16 — Deployment and Final Optimization

- [x] **DEP-001** `[P1]` — Prepare production Dockerfile and startup script for FastAPI backend.  
  *Dependencies:* FND-004, BE-004.  
  *Expected Outcome:* Container image boots FastAPI and sidecar services reliably.

- [x] **DEP-002** `[P1]` — Deploy backend to Python-capable cloud host (Railway, Render, or Fly.io) with WebSocket support.  
  *Dependencies:* DEP-001.  
  *Expected Outcome:* Backend accessible via HTTPS/WSS with environment variables configured in cloud dashboard.

- [x] **DEP-003** `[P1]` — Configure production Supabase project and apply all database migrations.  
  *Dependencies:* DB-002, DB-003.  
  *Expected Outcome:* Production database schema active with RLS policies verified.

- [x] **DEP-004** `[P1]` — Configure Next.js production build (`next build`) and deploy frontend to Vercel.  
  *Dependencies:* FE-001, ARENA-005.  
  *Expected Outcome:* Next.js App Router application deployed and accessible on public Vercel URL.

- [x] **DEP-005** `[P0]` — Verify end-to-end simulation on live deployed production URL.  
  *Dependencies:* DEP-002, DEP-004.  
  *Expected Outcome:* Live simulation completes smoothly across public web interface.

- [x] **DEP-006** `[P0]` — Seed 3 reliable demonstration scenarios for hackathon evaluation:  
  1. Direct Prompt Injection  
  2. Indirect Email Exfiltration  
  3. High-Impact Payment with Approval Pause  
  *Dependencies:* DEP-005.  
  *Expected Outcome:* High-reliability demonstration presets ready for live judge presentation.

- [x] **DEP-007** `[P0]` — Prepare 3-minute hackathon judge walkthrough script emphasizing the core thesis:  
  *"The LLM recommends. The deterministic Policy Engine decides. The Mock Tool Gateway enforces."*  
  *Dependencies:* DEP-006.  
  *Expected Outcome:* Crisp, compelling presentation flow explaining architecture, live attack defense, and auditable proof.
