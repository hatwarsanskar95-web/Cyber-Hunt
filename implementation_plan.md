# CYBER HUNT — Master Technical Implementation Plan
**Document Version:** 2.1.0 (Final Synchronized Architecture)  
**Target Milestone:** 24-Hour Hackathon Delivery (CYBER-02)  
**Core Thesis:** *"The LLM recommends. The deterministic Policy Engine decides. The Mock Tool Gateway enforces."*

---

## 1. Executive Summary & 13-Stage System Workflow

CYBER HUNT is an adversarial multi-agent AI cybersecurity platform operating strictly on zero-trust principles within an isolated synthetic sandbox. A dynamic Red Team agent crafts adversarial attacks against a Target AI agent processing user tasks; a Blue Team Guardian analyzes suspicious intent and potential policy breaches; an independent deterministic Open Policy Agent (OPA) evaluates authorization using Rego policies; and a Mock Tool Gateway enforces tool execution boundaries against synthetic fixtures.

### The 13-Stage Execution Workflow
Every simulation round advances through an auditable, deterministic lifecycle:
1. **User Initiation:** Operator selects scenario family, inputs a benign task, sets step limits, and starts run via Next.js dashboard.
2. **Dynamic Attack Generation:** Red Team Agent (Gemini) crafts a structured adversarial payload and strategy based on synthetic environment facts and prior round defense feedback.
3. **Task & Context Ingestion:** Target AI Agent receives the legitimate task alongside clearly labeled untrusted content (`<untrusted_content>`).
4. **Structured Action Proposal:** Target AI processes the prompt and outputs a user response and an optional structured tool action proposal (JSON).
5. **Guardian Threat Analysis:** Blue Team Guardian (Gemini) inspects the untrusted payload and proposed action for injection signatures, intent divergence, and privilege escalation, outputting an advisory risk assessment and severity score.
6. **Sensitive Data Detection:** Microsoft Presidio scans payload and proposed tool arguments for synthetic PII (credit cards, SSNs, emails, API keys) as supplemental evidence.
7. **Deterministic Policy Evaluation:** Backend submits action context, Guardian assessment, and Presidio findings to Open Policy Agent (OPA). OPA evaluates Rego policies and returns `ALLOW`, `BLOCK`, or `REQUIRE_APPROVAL` with matched policy rule IDs.
8. **Independent Gateway Enforcement:** Mock Tool Gateway independently verifies the server-generated execution token and action hash (`SHA-256`).
9. **Simulated Execution (ALLOW):** Only authorized actions execute strictly against isolated synthetic fixtures (mock email, simulated payment, local browser fixture, virtual file sandbox).
10. **Rejection & Audit (BLOCK):** Prohibited actions are dropped without execution; security violations are recorded in persistent audit logs.
11. **Comprehensive Audit Logging:** Every agent run, payload, risk indicator, policy decision, and tool receipt is durably stored in Supabase PostgreSQL with microsecond timestamps and correlation IDs.
12. **Real-Time Streaming Delivery:** Live ordered events stream via FastAPI WebSockets to the Next.js Battle Arena cockpit without requiring manual page refreshes.
13. **Scoring & Completion:** The simulation engine computes step-level round results, updates threat detection rates, blocking rates, benign task completion rates, and false positive metrics, concluding when step limits or operator halts occur.

---

## 2. Complete Technology Stack & Separation of Tiers

| Layer | Technology | Architectural Responsibility | Strict Boundary Rules |
| :--- | :--- | :--- | :--- |
| **Frontend Presentation** | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, Framer Motion, Recharts, Lucide React | User interface, authentication state, real-time WebSocket subscription, live battle cockpit rendering, audit browsing. | **No backend duplication.** Does not host competing Next.js API routes or business logic. All operational commands route to FastAPI. |
| **Backend & APIs** | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 | Sole backend application. Request validation, lifecycle coordination, token validation, event stream broadcasting. | Primary application backend and API authority. |
| **Agent Orchestration** | LangGraph | Multi-agent state graph managing typed state objects, node execution order, conditional branches, and checkpointing. | All agent transitions occur within explicit typed state; no raw unstructured strings passed between components. |
| **Foundation Models** | Google Gemini API (via Google GenAI SDK) | Powers Red Team Agent, Target AI Agent, and Blue Team Guardian. Structured JSON mode enforced. | Gemini is the sole primary AI provider. All model calls implement exponential backoff retries and fail-closed fallbacks. |
| **Deterministic Security** | Open Policy Agent (OPA) with Rego | Independent authorization engine evaluating declarative policies (`base.rego`, `high_impact.rego`, `data_exfil.rego`). | **Deciding boundary.** Deny-by-default: LLM cannot override an OPA decision. If OPA is unreachable, action is blocked. |
| **Sensitive Data Inspection**| Microsoft Presidio (Analyzer & Anonymizer) | In-process detection and redaction of synthetic PII entities in payloads and tool arguments. | Detection aid only; does not make authorization decisions. Feeds evidence into OPA. |
| **Sandboxed Tool Gateway** | Custom Python Mock Tool Gateway | Pure Python virtualized execution boundary for simulated email, payments, files, and browser fixtures. | **Zero egress.** No connection to real email servers, payment processors, host filesystems, or public internet. |
| **Database & Auth** | Supabase (PostgreSQL 15+, Supabase Auth, RLS) | Relational storage for 10 PRD domain tables, append-only event streams, user roles, and audit trails. | Enforced by Row-Level Security (RLS) policies and backend service-role access. |
| **Real-Time Transport** | FastAPI WebSockets | Monotonically increasing sequence-ordered event delivery to frontend with replay buffer. | Single authoritative source of truth for live simulation events. |

---

## 3. Master Project Directory Structure

```text
cyber-hunt/
├── .env.example                               # Environment variable definitions and descriptions
├── .gitignore                                 # Git ignore rules (.env, .venv, .next, node_modules)
├── README.md                                  # Product vision and quickstart guide
├── PROJECT_STRUCTURE.md                       # Comprehensive directory tree and component guide
├── implementation_plan.md                     # Master technical specification (this document)
├── task.md                                    # Granular implementation checklist
│
├── backend/                                   # Sole application backend (Python / FastAPI)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                            # FastAPI application factory, CORS, lifespan
│   │   ├── config.py                          # Pydantic BaseSettings environment validation
│   │   ├── dependencies.py                    # Auth token validation, DB injection, OPA client
│   │   │
│   │   ├── api/                               # REST & WebSocket API layer
│   │   │   ├── __init__.py
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py                  # API router aggregation
│   │   │   │   ├── auth.py                    # User profile and role verification endpoints
│   │   │   │   ├── simulations.py             # Simulation lifecycle (create, start, pause, resume, stop)
│   │   │   │   ├── approvals.py               # Human-in-the-loop approval decision endpoints
│   │   │   │   ├── reports.py                 # Security metrics, aggregates & export data
│   │   │   │   └── ws.py                      # WebSocket server for real-time live event streaming
│   │   │
│   │   ├── core/                              # Foundational backend services
│   │   │   ├── __init__.py
│   │   │   ├── errors.py                      # Custom exception classes & uniform error handlers
│   │   │   ├── logging.py                     # Structured JSON logging with correlation IDs
│   │   │   └── security.py                    # JWT verification, HMAC hashing, action hashes
│   │   │
│   │   ├── schemas/                           # Pydantic v2 data transfer schemas
│   │   │   ├── __init__.py
│   │   │   ├── common.py                      # Reusable models, pagination, error models
│   │   │   ├── simulation.py                  # Simulation request/response models
│   │   │   ├── agent.py                       # Red Team, Target AI, Blue Team I/O schemas
│   │   │   ├── policy.py                      # OPA context documents & decision schemas
│   │   │   ├── tool.py                        # Tool proposals & execution receipts
│   │   │   └── event.py                       # WebSocket standardized event envelope
│   │   │
│   │   ├── db/                                # Database persistence layer
│   │   │   ├── __init__.py
│   │   │   ├── client.py                      # Supabase client singleton (service-role key)
│   │   │   └── repositories/
│   │   │       ├── __init__.py
│   │   │       ├── simulation_repo.py         # Simulations table queries & updates
│   │   │       ├── event_repo.py              # Append-only simulation_events persistence
│   │   │       ├── approval_repo.py           # Approval requests & resolution tracking
│   │   │       └── audit_repo.py              # Attack logs, defence logs, tool logs, metrics
│   │   │
│   │   ├── ai/                                # AI model client & prompt engineering
│   │   │   ├── __init__.py
│   │   │   ├── gemini_client.py               # Google GenAI wrapper (backoff, schemas, latency)
│   │   │   └── prompts/
│   │   │       ├── __init__.py
│   │   │       ├── red_team.py                # Adversarial generation prompts across 6 families
│   │   │       ├── target_ai.py               # Legitimate task handling & tool proposal prompts
│   │   │       └── blue_team.py               # Guardian threat detection & risk scoring prompts
│   │   │
│   │   ├── orchestration/                     # LangGraph workflow orchestration
│   │   │   ├── __init__.py
│   │   │   ├── state.py                       # TypedDict SimulationState definitions
│   │   │   ├── graph.py                       # StateGraph definition, nodes, conditional edges
│   │   │   ├── checkpointer.py                # Checkpoint saving & state recovery engine
│   │   │   ├── manager.py                     # Background task lifecycle manager
│   │   │   └── nodes/
│   │   │       ├── __init__.py
│   │   │       ├── red_team_node.py           # Red Team node invocation & validation
│   │   │       ├── target_ai_node.py          # Target AI node invocation & tool proposal
│   │   │       ├── blue_team_node.py          # Blue Team Guardian node threat analysis
│   │   │       ├── presidio_node.py           # PII entity scanning node
│   │   │       ├── opa_node.py                # OPA evaluation node & decision routing
│   │   │       ├── tool_node.py               # Mock tool gateway execution gate
│   │   │       └── score_node.py              # Step-level metrics & round summary calculation
│   │   │
│   │   ├── security/                          # Independent security enforcement services
│   │   │   ├── __init__.py
│   │   │   ├── opa_client.py                  # Open Policy Agent REST client (fail-closed)
│   │   │   ├── presidio_scanner.py            # Microsoft Presidio PII detector & redactor
│   │   │   └── validator.py                   # Cryptographic SHA-256 action hash calculation
│   │   │
│   │   └── mock_tools/                        # Synthetic sandbox environment (zero real egress)
│   │       ├── __init__.py
│   │       ├── gateway.py                     # Gatekeeper enforcing OPA token before execution
│   │       ├── email_tool.py                  # Synthetic email inbox search/read/send
│   │       ├── browser_tool.py                # Local HTML fixture reader (no public internet)
│   │       ├── file_tool.py                   # Isolated in-memory synthetic filesystem
│   │       └── payment_tool.py                # Simulated ledger with limit verification
│   │
│   ├── policies/                              # Open Policy Agent Rego definitions
│   │   ├── base.rego                          # Deny-by-default rules & tool allowlists
│   │   ├── high_impact.rego                   # Payment limits & mandatory approval rules
│   │   └── data_exfil.rego                    # Destination restrictions & PII blocks
│   │
│   ├── fixtures/                              # Realistic synthetic test datasets
│   │   ├── emails.json                        # Mock email inbox fixtures
│   │   ├── documents.json                     # Synthetic test documents
│   │   └── web_pages/                         # Local HTML fixtures for mock browser
│   │
│   ├── tests/                                 # Test suite (unit, integration, policy)
│   │   ├── unit/                              # Schema, hash, and retry unit tests
│   │   ├── integration/                       # Full adversarial and benign lifecycle tests
│   │   └── policy/                            # Rego rule boundary condition tests
│   │
│   ├── requirements.txt                       # Frozen Python dependencies
│   └── Dockerfile                             # Production container specification
│
├── frontend/                                  # Next.js App Router presentation tier
│   ├── package.json                           # Next.js dependencies and scripts
│   ├── tsconfig.json                          # TypeScript configuration
│   ├── next.config.ts                         # Next.js build and proxy configuration
│   ├── postcss.config.mjs                     # PostCSS configuration for Tailwind
│   ├── tailwind.config.ts                     # Tailwind CSS design system tokens
│   ├── public/                                # Static assets, icons, logos
│   │
│   └── src/
│       ├── app/                               # Next.js App Router routes & layouts
│       │   ├── layout.tsx                     # Root layout with providers, fonts, and AppShell
│       │   ├── page.tsx                       # Public landing page and feature showcase
│       │   ├── globals.css                    # Global Tailwind directives & dark theme variables
│       │   ├── (auth)/
│       │   │   └── login/
│       │   │       └── page.tsx               # Supabase Auth sign-in / registration page
│       │   ├── dashboard/
│       │   │   └── page.tsx                   # Simulation launcher, active runs, high-level KPIs
│       │   ├── arena/
│       │   │   └── [simulationId]/
│       │   │       └── page.tsx               # Real-time multi-agent Battle Arena cockpit
│       │   ├── attacks/
│       │   │   └── page.tsx                   # Attack Explorer (filter payloads, outcomes, severity)
│       │   ├── defence/
│       │   │   └── page.tsx                   # Defence Centre (Rego rules, indicators, approvals)
│       │   ├── analytics/
│       │   │   └── page.tsx                   # Security charts (detection %, block %, latencies)
│       │   ├── history/
│       │   │   └── page.tsx                   # Historical simulation runs and replay triggers
│       │   └── settings/
│       │       └── page.tsx                   # User profile, role permissions, model metadata
│       │
│       ├── components/                        # Modular React components
│       │   ├── layout/                        # Navbar, Sidebar, AppShell, UserProfileBadge
│       │   ├── dashboard/                     # NewSimulationModal, ActiveRunsGrid, MetricCards
│       │   ├── arena/                         # Live cockpit cards:
│       │   │   ├── SimulationControls.tsx     # Pause, resume, stop, and step indicator
│       │   │   ├── RedTeamCard.tsx            # Attack strategy, surface, and generated payload
│       │   │   ├── TargetAICard.tsx           # User prompt, reasoning stream, tool proposal
│       │   │   ├── GuardianCard.tsx           # Threat meter, severity tag, indicator chips
│       │   │   ├── PolicyCard.tsx             # OPA verdict banner, matched Rego rules
│       │   │   ├── ToolExecutionCard.tsx      # Target tool, sandbox status, result payload
│       │   │   └── EventTimeline.tsx          # Real-time chronological audit trail drawer
│       │   ├── attacks/                       # PayloadTable, VectorFilter, PayloadDetailModal
│       │   ├── defence/                       # RegoRuleList, ThreatRadar, ApprovalQueue
│       │   ├── analytics/                     # MetricCharts (Recharts), LatencyComparisonBar
│       │   ├── approvals/                     # ApprovalModal, ActionDiffViewer
│       │   └── ui/                            # Reusable Button, Badge, Modal, Input, CodeBlock
│       │
│       ├── hooks/                             # React custom hooks
│       │   ├── useSimulationSocket.ts         # WebSocket subscription, queue, sequence replay
│       │   └── useSimulationControls.ts       # Start, pause, resume, abort dispatchers
│       │
│       ├── lib/                               # Client utility libraries
│       │   ├── supabase/
│       │   │   ├── client.ts                  # Browser Supabase client (createBrowserClient)
│       │   │   └── server.ts                  # Server Supabase helper (createServerClient)
│       │   ├── api.ts                         # Fetch client communicating with FastAPI REST API
│       │   └── websocket.ts                   # Resilient WebSocket connection manager
│       │
│       ├── context/                           # React Context providers
│       │   ├── AuthContext.tsx                # User identity, session tokens, role checks
│       │   └── SimulationContext.tsx          # Active simulation live state and event queue
│       │
│       └── types/                             # TypeScript definitions matching backend schemas
│           ├── simulation.ts
│           ├── agent.ts
│           ├── policy.ts
│           ├── tool.ts
│           └── event.ts
│
└── supabase/                                  # Database migrations and configuration
    └── migrations/
        └── 20261031000000_init_cyberhunt_schema.sql # 10 PRD tables + RLS + triggers + indexes
```

---

## 4. Database Schema Verification (10 PRD Tables)

The Supabase PostgreSQL schema strictly mirrors Section 15 of PRD v2.0:

1. **`profiles`:** User identity, system role (`operator`, `approver`, `admin`, `judge`), and display metadata. Foreign key to `auth.users.id`.
2. **`simulations`:** Master simulation run tracking: `id` (UUID), `owner_id` (FK `profiles.id`), `scenario_category`, `task_summary`, `state` (`CREATED`, `INITIALIZING`, `RUNNING`, `ANALYSING`, `AWAITING_APPROVAL`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`), `step_limit`, `current_step`, `final_metrics` (JSONB), and timestamps.
3. **`simulation_events`:** Append-only linear audit stream: `event_id`, `simulation_id` (FK `simulations.id`), `sequence_number` (BIGINT), `event_type`, `schema_version`, `payload` (JSONB), `timestamp`. Indexed on `(simulation_id, sequence_number)`.
4. **`agent_runs`:** Individual agent executions: `id`, `simulation_id`, `step`, `agent_name` (`red_team`, `target_ai`, `guardian`), `model_id`, `latency_ms`, `token_usage` (JSONB), `status`, `output_json` (JSONB), `error_code`.
5. **`attack_logs`:** Red Team payloads: `id`, `simulation_id`, `step`, `category`, `strategy_summary`, `payload_text`, `target_surface`, `is_valid`, `generated_at`.
6. **`defence_logs`:** Guardian assessments: `id`, `simulation_id`, `step`, `risk_score` (0.0 to 1.0), `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `indicators` (TEXT[]), `explanation`, `recommendation`.
7. **`policy_decisions`:** OPA evaluation records: `id`, `simulation_id`, `step`, `decision` (`ALLOW`, `BLOCK`, `REQUIRE_APPROVAL`), `reason_codes` (TEXT[]), `matched_policy_ids` (TEXT[]), `input_hash`, `action_id`, `timestamp`.
8. **`approval_requests`:** Human-in-the-loop queue: `id`, `simulation_id`, `action_id`, `action_hash` (SHA-256), `approver_id` (FK `profiles.id`), `decision` (`PENDING`, `APPROVED`, `REJECTED`), `reason`, `expiry_time`, `resolved_at`.
9. **`tool_logs`:** Mock Tool Gateway receipts: `id`, `simulation_id`, `step`, `tool_name`, `operation`, `parameters` (JSONB), `opa_decision`, `execution_status` (`SUCCESS`, `FAILED`, `BLOCKED`), `result_summary`, `timestamp`.
10. **`round_results`:** Step-level scoring: `id`, `simulation_id`, `step`, `attack_success` (BOOL), `threat_detected` (BOOL), `action_blocked` (BOOL), `benign_task_completed` (BOOL), `scoring_inputs` (JSONB).

---

## 5. Real-Time State Machine & WebSocket Event Specifications

### Simulation State Machine Transitions
In compliance with PRD Section 13, the simulation engine implements these explicit states:
* `CREATED` -> Initial record generated upon `POST /api/v1/simulations`.
* `INITIALIZING` -> Setup running; sandbox fixtures and graph state instantiated.
* `RUNNING` -> Active agent execution (Red Team or Target AI).
* `ANALYSING` -> Active Blue Team Guardian threat analysis, Presidio PII scan, and OPA policy evaluation.
* `AWAITING_APPROVAL` -> Paused at authorization boundary awaiting human approver decision.
* `PAUSED` -> Manually suspended by operator command.
* `COMPLETED` -> Finished at configured step limit or normal termination.
* `FAILED` -> Unrecoverable execution failure.
* `CANCELLED` -> Manually halted by operator stop command.

### Standardized Real-Time Event Types (PRD Section 14)
All WebSocket events conform to a typed envelope (`event_id`, `simulation_id`, `sequence_number`, `event_type`, `timestamp`, `schema_version`, `payload`):
1. `simulation.created`
2. `simulation.status_changed`
3. `red_team.attack_generated`
4. `target_ai.response_ready`
5. `target_ai.action_proposed`
6. `guardian.analysis_completed`
7. `policy.decision_made`
8. `approval.requested`
9. `approval.resolved`
10. `tool.executed`
11. `tool.blocked`
12. `score.updated`
13. `simulation.completed`
14. `simulation.failed`

---

## 6. Detailed 17-Phase Implementation Plan

---

### PHASE 0 — Project Foundation
* **Objective:** Establish the workspace structure, version control rules, environment configurations, and dependency definitions for both backend and frontend.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Initialize Git repository with standard `.gitignore` prohibiting `.env`, `.venv`, `.next`, `node_modules`, `dist`, `.pytest_cache`.
  2. Create root `.env.example` defining all required configuration variables (`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `OPA_URL`, `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`).
  3. Set up Python virtual environment (`python -m venv .venv`) and create `backend/requirements.txt` with frozen dependencies (`fastapi`, `uvicorn[standard]`, `google-genai`, `langgraph`, `pydantic-settings`, `httpx`, `presidio-analyzer`, `presidio-anonymizer`, `supabase`, `pytest`).
  4. Initialize Next.js 14+ App Router frontend workspace (`frontend/`) with TypeScript, Tailwind CSS, and PostCSS (`next.config.ts`, `postcss.config.mjs`, `tsconfig.json`).
  5. Install frontend core libraries: `lucide-react`, `framer-motion`, `recharts`, `@supabase/ssr`, `@supabase/supabase-js`.
  6. Verify local Open Policy Agent executable (`C:\Tools\OPA\opa.exe`) for deterministic policy evaluation.
* **Expected Files:** `backend/requirements.txt`, `backend/Dockerfile`, `.env.example`, `frontend/package.json`, `frontend/next.config.mjs`, `frontend/postcss.config.mjs`, `frontend/tsconfig.json`.
* **Dependencies:** None.
* **Completion Criteria:** Backend and Next.js frontend development servers start cleanly without configuration errors.

---

### PHASE 1 — Backend Foundation
* **Objective:** Build the core FastAPI application, middleware, structured logging, centralized configuration, and consistent error handling envelopes.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Implement `backend/app/config.py` using `pydantic_settings.BaseSettings` for type-safe environment resolution with default fallbacks.
  2. Implement `backend/app/core/logging.py` outputting structured JSON logs equipped with `simulation_id` and `correlation_id` context vars.
  3. Implement `backend/app/core/errors.py` featuring domain exceptions (`PolicyEnforcementError`, `SimulationStateError`, `AgentExecutionError`) and FastAPI exception handlers returning a uniform `{ status: "error", error: { code, message, details } }` payload.
  4. Implement `backend/app/main.py` configuring CORS (allowing Next.js frontend origin `http://localhost:3000`), lifespan management, and mounting the `/api/v1` router.
  5. Add `/api/v1/health` verifying system status (Gemini, Supabase, OPA health checks).
* **Expected Files:** `backend/app/config.py`, `backend/app/core/logging.py`, `backend/app/core/errors.py`, `backend/app/main.py`, `backend/app/api/v1/router.py`.
* **Dependencies:** Phase 0.
* **Completion Criteria:** `GET /api/v1/health` returns HTTP 200 with JSON payload.

---

### PHASE 2 — Database and Authentication
* **Objective:** Deploy the full relational schema in Supabase PostgreSQL, establish Row-Level Security (RLS) policies, and implement backend token validation.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Author `supabase/migrations/20261031000000_init_cyberhunt_schema.sql` defining all 10 PRD tables.
  2. Add database indexes on `(simulation_id, sequence_number)`, `(simulation_id, step)`, and `owner_id`.
  3. Configure Supabase RLS: Users can read/write their own simulations and events; approvers can update approvals; judges have read-only access.
  4. Create `backend/app/db/client.py` initializing Supabase client with service-role key for backend operations.
  5. Implement `backend/app/dependencies.py` to extract Bearer JWT, verify via Supabase Auth, and populate the `current_user` object.
* **Expected Files:** `supabase/migrations/20261031000000_init_cyberhunt_schema.sql`, `backend/app/db/client.py`, `backend/app/db/repositories/*.py`, `backend/app/dependencies.py`.
* **Dependencies:** Phase 1.
* **Completion Criteria:** Schema fully applied in Supabase; authenticated API calls correctly resolve `current_user`.

---

### PHASE 3 — Gemini Integration
* **Objective:** Build an enterprise-grade Gemini SDK client providing structured outputs, exponential backoff retries, and strict schema compliance.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Implement `backend/app/ai/gemini_client.py` wrapping the Google GenAI SDK.
  2. Implement configurable model selection (defaulting to fast models like `gemini-1.5-flash` or `gemini-2.0-flash`).
  3. Enforce JSON structured output using Pydantic schema passing (`response_mime_type="application/json"` and `response_schema`).
  4. Build exponential backoff retry logic (up to 3 retries) catching rate limits (HTTP 429) or transient provider timeouts.
  5. Add latency tracking, token usage logging, and fallback fail-closed behavior for security agents.
* **Expected Files:** `backend/app/ai/gemini_client.py`, `backend/app/schemas/agent.py`.
* **Dependencies:** Phase 1.
* **Completion Criteria:** Gemini client successfully outputs typed Pydantic objects with bounded error retries.

---

### PHASE 4 — Multi-Agent Architecture
* **Objective:** Design and implement the LangGraph orchestration topology managing Red Team, Target AI, and Blue Team Guardian nodes with typed state objects.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Define `SimulationState` in `backend/app/orchestration/state.py` with typed fields for step, payload, proposal, assessment, OPA decision, and round results.
  2. Create LangGraph `StateGraph` in `backend/app/orchestration/graph.py`.
  3. Register nodes: `node_red_team`, `node_target_ai`, `node_blue_team`, `node_presidio`, `node_opa_eval`, `node_tool_gate`, `node_round_score`.
  4. Define conditional edges: After `node_opa_eval`: If decision == `REQUIRE_APPROVAL`, route to approval interrupt wait; if `BLOCK`, bypass execution and record block; if `ALLOW`, route to `node_tool_gate`.
  5. Integrate checkpoint saving at every state transition.
* **Expected Files:** `backend/app/orchestration/state.py`, `backend/app/orchestration/graph.py`, `backend/app/orchestration/checkpointer.py`.
* **Dependencies:** Phase 2, Phase 3.
* **Completion Criteria:** LangGraph compiles and executes a single mocked loop without errors.

---

### PHASE 5 — Dynamic Red Team
* **Objective:** Implement runtime dynamic attack payload generation across attack families with adaptive strategy learning from prior round feedback.
* **Priority:** P0 for 3 core scenarios; P1 for remaining 3 scenarios.
* **Detailed Steps:**
  1. Define Pydantic schema `RedTeamAttack` in `backend/app/schemas/agent.py`.
  2. Author prompt templates in `backend/app/ai/prompts/red_team.py` for Core MVP: Direct Prompt Injection (Cat A), Email Indirect Injection (Cat B), Unauthorized Payment (Cat F).
  3. Author remaining prompt templates (P1): Webpage Injection (Cat C), Document Injection (Cat D), Data Exfiltration (Cat E).
  4. Feed previous round outcomes into prompt context to generate adaptive mutations.
  5. Ensure Red Team has no tool-calling capability or access to security engine internals.
* **Expected Files:** `backend/app/ai/prompts/red_team.py`, `backend/app/orchestration/nodes/red_team_node.py`.
* **Dependencies:** Phase 3, Phase 4.
* **Completion Criteria:** Red Team generates valid payloads adhering to selected categories and adapts on feedback.

---

### PHASE 6 — Target AI
* **Objective:** Implement the Target AI agent responsible for fulfilling legitimate user tasks while ingesting untrusted inputs and proposing structured tool actions.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Define Pydantic schemas `TargetAIResponse` and `ToolActionProposal` in `backend/app/schemas/tool.py`.
  2. Implement system prompt in `backend/app/ai/prompts/target_ai.py` enforcing strict boundary isolation between `<user_task>` and `<untrusted_content>`.
  3. Expose synthetic tool specifications (email, browser, files, payment) to Target AI.
  4. Enforce strict isolation: Target AI has NO direct execution permissions; it only outputs JSON proposals.
  5. Add benign task controls to measure legitimate task completion.
* **Expected Files:** `backend/app/ai/prompts/target_ai.py`, `backend/app/orchestration/nodes/target_ai_node.py`, `backend/app/schemas/tool.py`.
* **Dependencies:** Phase 4.
* **Completion Criteria:** Target AI reliably outputs either clean task answers or structured tool call proposals.

---

### PHASE 7 — Blue Team Guardian
* **Objective:** Implement the real-time AI security observer that inspects untrusted content, context divergence, and proposed actions to output structured threat intelligence.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Define Pydantic schema `GuardianAssessment` with risk scores (0.0 to 1.0), severity, and indicator arrays.
  2. Implement Guardian prompt rubric in `backend/app/ai/prompts/blue_team.py` evaluating instruction overrides, privilege escalation, and tool parameter divergence.
  3. Log Guardian assessment to `defence_logs`.
  4. Guardian is strictly advisory: its output is passed as context into OPA and human approvers, but Guardian cannot directly block or allow.
* **Expected Files:** `backend/app/ai/prompts/blue_team.py`, `backend/app/orchestration/nodes/blue_team_node.py`, `backend/app/schemas/agent.py`.
* **Dependencies:** Phase 4, Phase 6.
* **Completion Criteria:** Guardian produces structured threat scores and indicator arrays for every step.

---

### PHASE 8 — Security Enforcement (OPA & Presidio)
* **Objective:** Implement deterministic security evaluation via Open Policy Agent (Rego) and sensitive data scanning via Microsoft Presidio, enforcing deny-by-default execution.
* **Priority:** P0 for OPA Core & Rego rules; P1 for Presidio integration.
* **Detailed Steps:**
  1. Implement Rego policy files: `base.rego` (deny-by-default, scenario allowlists), `high_impact.rego` (monetary thresholds and approval gates), `data_exfil.rego` (destination and PII restrictions).
  2. Implement `backend/app/security/opa_client.py` posting context to OPA REST API; fails closed (`BLOCK`) if OPA is unavailable.
  3. Implement `backend/app/security/presidio_scanner.py` analyzing arguments for synthetic PII entities.
  4. Generate cryptographic SHA-256 action hash: `action_hash = SHA256(simulation_id + tool + operation + canonical_json(params))`.
* **Expected Files:** `backend/policies/*.rego`, `backend/app/security/opa_client.py`, `backend/app/security/presidio_scanner.py`, `backend/app/security/validator.py`, `backend/app/schemas/policy.py`.
* **Dependencies:** Phase 6, Phase 7.
* **Completion Criteria:** OPA independently returns `ALLOW`, `BLOCK`, or `REQUIRE_APPROVAL` with matched rule IDs.

---

### PHASE 9 — Mock Tool Gateway
* **Objective:** Implement the isolated, synthetic mock tool gateway that executes simulated actions strictly upon verification of an authorized OPA token.
* **Priority:** P0 (Mock Email, Mock Payment); P1 (Mock Browser, Mock Files).
* **Detailed Steps:**
  1. Implement `backend/app/mock_tools/gateway.py` verifying OPA authorization and action hash integrity before allowing execution.
  2. Implement `backend/app/mock_tools/email_tool.py` (search, read, send against local synthetic fixture).
  3. Implement `backend/app/mock_tools/payment_tool.py` (ledger transfer with limit checks).
  4. Implement `backend/app/mock_tools/browser_tool.py` (reads local HTML fixtures; no public internet).
  5. Implement `backend/app/mock_tools/file_tool.py` (sandboxed virtual filesystem in isolated memory).
  6. Return structured execution receipts and log to `tool_logs`.
* **Expected Files:** `backend/app/mock_tools/gateway.py`, `backend/app/mock_tools/email_tool.py`, `backend/app/mock_tools/payment_tool.py`, `backend/app/mock_tools/browser_tool.py`, `backend/app/mock_tools/file_tool.py`, `backend/fixtures/*.json`.
* **Dependencies:** Phase 8.
* **Completion Criteria:** Mock tools execute cleanly for permitted actions; prohibited actions are rejected before execution.

---

### PHASE 10 — Simulation Engine
* **Objective:** Build the simulation orchestrator managing the state machine (`CREATED`, `INITIALIZING`, `RUNNING`, `ANALYSING`, `AWAITING_APPROVAL`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`), human approvals, and bounded steps.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Implement `backend/app/orchestration/manager.py` managing lifecycle methods (`create_simulation`, `start_simulation`, `pause_simulation`, `resume_simulation`, `stop_simulation`).
  2. Implement background task execution runner for LangGraph simulations.
  3. Implement human-in-the-loop approval pause/resume (`POST /api/v1/approvals/{id}/decision`).
  4. Enforce maximum step limits (3 to 5 steps per scenario) and timeout bounds.
  5. Compute round results (`round_results`) and finalize overall metrics when simulation concludes.
* **Expected Files:** `backend/app/orchestration/manager.py`, `backend/app/api/v1/simulations.py`, `backend/app/api/v1/approvals.py`.
* **Dependencies:** Phase 4, Phase 8, Phase 9.
* **Completion Criteria:** Simulation advances step-by-step, pauses correctly on approval gate, and resumes upon authorized decision.

---

### PHASE 11 — Real-Time Communication
* **Objective:** Implement FastAPI WebSocket server delivering strictly ordered, typed events to the Next.js frontend with deduplication, sequence numbering, and replay support.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Define event envelope in `backend/app/schemas/event.py` adhering to PRD Section 14.
  2. Implement `backend/app/api/v1/ws.py` maintaining active WebSocket connection registry.
  3. Implement append-only event persistence in `event_repo.py` before broadcasting.
  4. Implement reconnect / replay endpoint (`GET /api/v1/simulations/{id}/events?after_sequence={seq}`).
* **Expected Files:** `backend/app/schemas/event.py`, `backend/app/api/v1/ws.py`, `backend/app/db/repositories/event_repo.py`.
* **Dependencies:** Phase 1, Phase 2, Phase 10.
* **Completion Criteria:** Live events stream in real-time to Next.js clients with monotonically increasing sequence numbers.

---

### PHASE 11.1 — Google Gmail OAuth 2.0 & Inbound Email Ingestion
* **Objective:** Implement secure server-side Google OAuth 2.0 connection to read incoming Gmail messages, sanitize untrusted bodies and attachments, and pipe them directly into the simulation pipeline via `SimulationManager.inject_incoming_email()`.
* **Priority:** P0 (Essential for real-world inbox evaluation)
* **Detailed Steps:**
  1. Add `google_client_id`, `google_client_secret` (SecretStr), `google_redirect_uri`, `google_pubsub_topic`, `google_pubsub_verification_token`, and `gmail_token_encryption_key` to `backend/app/config.py` and document template in `.env.example`.
  2. Implement `backend/app/schemas/gmail.py` enforcing `https://www.googleapis.com/auth/gmail.readonly` and zero token exposure in schemas; include `GmailMessagesResponse`, `GmailPubSubPushPayload`, and `GmailWatchResponse`.
  3. Implement attachment sanitizer in `backend/app/security/email_sanitizer.py` supporting safe text extraction (.txt and .pdf) and blocking dangerous executables/scripts (.exe, .bat, .sh, .ps1, etc.).
  4. Implement `backend/app/security/gmail_service.py` with CSRF state generation (10m TTL), code exchange, automated token refresh, token revocation, Fernet AES-128-CBC encryption at rest (`backend/.gmail_token.enc`), duplicate message filtering (`_processed_message_ids`), and strict read-only prohibition guards.
  5. Implement FastAPI routes in `backend/app/api/v1/gmail.py` (`GET /connect`, `GET /callback` with popup auto-close HTML & postMessage, `GET /status`, `GET /messages`, `POST /sync`, `POST /disconnect`, `POST /webhook`, `POST /watch`).
  6. Integrate with `SimulationManager.inject_incoming_email()` with `is_untrusted: True` and credential redaction before WebSocket broadcasting.
* **Expected Files:** `backend/app/schemas/gmail.py`, `backend/app/security/email_sanitizer.py`, `backend/app/security/gmail_service.py`, `backend/app/api/v1/gmail.py`, `backend/tests/unit/test_gmail_oauth.py`.
* **Dependencies:** Phase 1, Phase 10, Phase 11.
* **Completion Criteria:** Complete OAuth flow, encrypted token persistence, duplicate prevention, Pub/Sub webhook, safe email/attachment ingestion, 28 dedicated unit tests pass, and zero token leakage. (Status: VERIFIED & COMPLETE — 28/28 unit tests passing).

---

### PHASE 12 — Frontend Foundation (Next.js App Router)
* **Objective:** Establish the Next.js App Router frontend foundation with dark cybersecurity theme, responsive layout, Supabase client authentication, and centralized API/WebSocket clients.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Configure `frontend/next.config.ts`, `frontend/tsconfig.json`, and `frontend/postcss.config.mjs`.
  2. Implement `frontend/src/app/globals.css` with dark cybersecurity theme tokens (`#0a0d14` background).
  3. Implement `frontend/src/app/layout.tsx` (Root Layout) setting metadata, fonts, global providers (`AuthContext`, `SimulationContext`).
  4. Implement reusable UI components in `frontend/src/components/ui/` (`Button`, `Badge`, `Card`, `Modal`, `Input`, `Select`, `CodeBlock`).
  5. Implement shell layout components in `frontend/src/components/layout/` (`Navbar`, `Sidebar`, `AppShell`).
  6. Implement Supabase client utilities in `frontend/src/lib/supabase/` (`client.ts` via `createBrowserClient`, `server.ts` via `createServerClient`).
  7. Implement `frontend/src/context/AuthContext.tsx` providing authentication state and role-based checks.
  8. Implement Landing Page (`frontend/src/app/page.tsx`) and Login Page (`frontend/src/app/(auth)/login/page.tsx`).
  9. Implement FastAPI REST client in `frontend/src/lib/api.ts` with automatic Bearer token injection.
* **Expected Files:** `frontend/next.config.ts`, `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`, `frontend/src/app/globals.css`, `frontend/src/app/(auth)/login/page.tsx`, `frontend/src/components/ui/*.tsx`, `frontend/src/components/layout/*.tsx`, `frontend/src/lib/supabase/*.ts`, `frontend/src/lib/api.ts`, `frontend/src/context/AuthContext.tsx`.
* **Dependencies:** Phase 0, Phase 2.
* **Completion Criteria:** User can register, log in, view the authenticated layout in Next.js, and navigate across App Router routes.

---

### PHASE 13 — Dashboard and Battle Arena (Next.js)
* **Objective:** Build the flagship real-time Battle Arena screen in Next.js featuring live multi-agent panels, threat score visualizers, policy decisions, mock tool receipts, and simulation controls.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Build `frontend/src/app/dashboard/page.tsx` with launcher modal and active runs grid.
  2. Build custom hook `frontend/src/hooks/useSimulationSocket.ts` managing WebSocket connection and replay queue.
  3. Build dynamic route `frontend/src/app/arena/[simulationId]/page.tsx` with dedicated multi-panel cockpit:
     - `SimulationControls.tsx` (Status pill, step counter, pause/resume/stop buttons).
     - `RedTeamCard.tsx` (Attack plan, surface badge, payload with syntax box).
     - `TargetAICard.tsx` (User prompt, model reasoning stream, proposed tool action JSON).
     - `GuardianCard.tsx` (Threat radar meter 0.0 to 1.0, severity badge, indicator chips).
     - `PolicyCard.tsx` (OPA decision banner: ALLOW green / BLOCK red / REQUIRE_APPROVAL amber, matched rules).
     - `ToolExecutionCard.tsx` (Mock tool target, arguments, sandbox execution status, result payload).
     - `EventTimeline.tsx` (Monospaced chronological audit trail drawer).
  4. Build `frontend/src/components/approvals/ApprovalModal.tsx` for human approvals.
* **Expected Files:** `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/arena/[simulationId]/page.tsx`, `frontend/src/hooks/useSimulationSocket.ts`, `frontend/src/components/arena/*.tsx`, `frontend/src/components/approvals/ApprovalModal.tsx`.
* **Dependencies:** Phase 10, Phase 11, Phase 12.
* **Completion Criteria:** Operator starts a run and watches live Red -> Target -> Blue -> OPA -> Tool lifecycle in the Next.js Arena.

---

### PHASE 14 — Additional Screens (Next.js App Router)
* **Objective:** Implement auxiliary audit and analytics App Router pages: Attack Explorer, Defence Centre, Analytics Dashboard, Simulation History, and Exportable Reports.
* **Priority:** P1 (Essential for evaluation and judge demonstration).
* **Detailed Steps:**
  1. Build `frontend/src/app/attacks/page.tsx` (Attack Explorer) with filterable table of generated payloads.
  2. Build `frontend/src/app/defence/page.tsx` (Defence Centre) showing Rego rules, indicators, and approval queue.
  3. Build `frontend/src/app/analytics/page.tsx` (Analytics) with Recharts charts (Detection %, Block %, Benign Task Completion %, Latencies).
  4. Build `frontend/src/app/history/page.tsx` (Simulation History) for reviewing past runs and reports.
  5. Build `frontend/src/app/settings/page.tsx` (Settings & Configuration) for user profile and safe model metadata.
  6. Implement backend reporting endpoints `GET /api/v1/simulations/{id}/report` and `GET /api/v1/reports/metrics`.
* **Expected Files:** `frontend/src/app/attacks/page.tsx`, `frontend/src/app/defence/page.tsx`, `frontend/src/app/analytics/page.tsx`, `frontend/src/app/history/page.tsx`, `frontend/src/app/settings/page.tsx`, `frontend/src/components/attacks/*.tsx`, `frontend/src/components/defence/*.tsx`, `frontend/src/components/analytics/*.tsx`.
* **Dependencies:** Phase 13.
* **Completion Criteria:** User can inspect past attack vectors, view defense statistics, and review history in Next.js.

---

### PHASE 15 — Integration and Testing
* **Objective:** Conduct end-to-end integration testing, scenario verification, policy fuzzing, and edge-case validation across the Next.js frontend and FastAPI backend.
* **Priority:** P0 (Essential)
* **Detailed Steps:**
  1. Automated Integration Tests (`backend/tests/integration/`): Complete adversarial flow (Block), benign task flow (Allow & Complete), human approval flow (Pause & Resume).
  2. Security & Policy Boundary Verification: Mock tool gateway rejects execution if OPA decision is missing or tampered; Red Team cannot access backend tool definitions.
  3. Real-Time Reconnect Test: Disconnect WebSocket mid-run, re-subscribe with `after_sequence`, verify zero dropped events.
  4. Audit system against all 14 Acceptance Criteria (AC1–AC14) from PRD Section 23.
* **Expected Files:** `backend/tests/unit/*.py`, `backend/tests/integration/*.py`, `backend/tests/policy/*.py`.
* **Dependencies:** Phases 1 through 14.
* **Completion Criteria:** Acceptance criteria AC1 through AC14 verified and documented.

---

### PHASE 16 — Deployment and Final Optimization
* **Objective:** Deploy frontend and backend to production hosting, verify cloud environment variables, optimize asset bundles, and prepare demonstration assets.
* **Priority:** P1 (Essential for hackathon submission).
* **Detailed Steps:**
  1. Backend Deployment: Deploy FastAPI + OPA sidecar to a Python/container-capable cloud host (Railway, Render, or Fly.io) with WebSocket support.
  2. Next.js Frontend Deployment: Deploy Next.js App Router application to Vercel.
  3. Production Database & Security Audit: Run Supabase migrations on production database instance and verify RLS.
  4. Performance & Polish: Verify p95 event latency target under 1.5 seconds.
  5. Seed 3 reliable demonstration scenarios and prepare 3-minute judge walkthrough script.
* **Expected Files:** `frontend/next.config.ts`, `render.yaml` or `railway.json`, production environment configuration guides.
* **Dependencies:** Phase 15.
* **Completion Criteria:** Fully functional live web application accessible on public URLs with real-time streaming operating flawlessly.

---

## 7. Hackathon Feasibility & Scope Triage (24-Hour Horizon)

| Category | Must-Have for MVP (P0) | Post-Core Enhancements (P1) | Future Scope (P2) |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js App Router + Tailwind CSS | Page transition animations | Custom theme selector |
| **Scenarios** | 3 Scenarios: Direct Injection, Email Injection, Unauthorized Payment | All 6 Scenarios: + Webpage, Document, Data Exfil | Custom scenario builder |
| **AI Agents** | Red Team, Target AI, Blue Team Guardian via Gemini Flash | Adaptive attack mutation based on round history | Multi-model provider switching (OpenAI/Anthropic) |
| **Security** | OPA Rego evaluation (Allow, Block, Require Approval) | Microsoft Presidio PII scanning | Dynamic Rego policy pack authoring in UI |
| **Tools** | Mock Email & Mock Payment Gateway | Mock Browser & Mock File System | Custom tool schema importer |
| **Realtime** | FastAPI WebSockets + Reconnection replay | Event playback speed scrubber | Multi-tenant tournament spectator mode |
| **Screens** | Battle Arena dynamic route, Dashboard, Approval modal | Attack Explorer, Defence Centre, Analytics | Full PDF report generation engine |
