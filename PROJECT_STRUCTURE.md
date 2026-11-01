# CYBER HUNT — Master Project Directory Structure

**Document Version:** 2.1.0 (Final Synchronized Architecture)  
**Framework Stack:** Next.js 14+ (App Router) + FastAPI (Python 3.11+) + LangGraph + Google Gemini API + Open Policy Agent (Rego) + Microsoft Presidio + Supabase PostgreSQL  
**Architecture Principle:** *"The LLM recommends. The deterministic Policy Engine decides. The Mock Tool Gateway enforces."*

---

## 1. Complete Visual Project Directory Tree

```text
cyber-hunt/
│
├── .env.example                               # Unified environment template with descriptions
├── .gitignore                                 # Root git ignore (node_modules, .venv, .next, dist)
├── README.md                                  # Product overview, value prop, and setup guide
├── PROJECT_STRUCTURE.md                       # Comprehensive directory tree and component guide
├── implementation_plan.md                     # Master technical specification & phase details
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
│   │   │   │   ├── gmail.py                   # Google OAuth 2.0 & Gmail Read-Only endpoints
│   │   │   │   ├── simulations.py             # Simulation lifecycle (create, start, pause, resume, stop)
│   │   │   │   ├── approvals.py               # Human-in-the-loop approval decision endpoints
│   │   │   │   ├── reports.py                 # Security metrics, aggregates & export data
│   │   │   │   └── ws.py                      # WebSocket server for real-time live event streaming
│   │   │
│   │   ├── websocket/                         # Real-time WebSocket connection & broadcast layer
│   │   │   ├── __init__.py
│   │   │   ├── manager.py                     # ConnectionManager with heartbeat and room isolation
│   │   │   └── broadcaster.py                 # Monotonic sequencing, persistence & event emission
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
│   │   │   ├── event.py                       # WebSocket standardized event envelope (14 event types)
│   │   │   └── gmail.py                       # Google OAuth & Inbound Email schemas
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
│   │   │   ├── validator.py                   # Cryptographic SHA-256 action hash calculation
│   │   │   ├── email_sanitizer.py             # Untrusted email body & attachment scanner (.pdf, .txt)
│   │   │   └── gmail_service.py               # Google OAuth & read-only inbox service
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
│       │   ├── page.tsx                       # Public landing page (friend's implementation — DO NOT MODIFY)
│       │   ├── globals.css                    # Global Tailwind directives, dark theme, keyframe animations
│       │   └── dashboard/
│       │       └── page.tsx                   # ★ CYBER HUNT Dashboard cockpit (Phase 12/13 — COMPLETE)
│       │                                      #   3-column: EmailInboxPanel | TargetAIPanel | BlueTeamPanel
│       │                                      #   Secondary views: Files, Browser, Payment, Results
│       │
│       ├── components/                        # Modular React components
│       │   ├── layout/                        # Navbar, Sidebar, AppShell, UserProfileBadge
│       │   ├── dashboard/                     # ★ Dashboard cockpit components (Phase 12 — COMPLETE)
│       │   │   ├── DashboardNavbar.tsx        # Top nav: logo, 6 nav items, live WS indicator
│       │   │   ├── NewEmailAlert.tsx          # Red alert banner (auto-dismiss 8s, never reveals Red Team)
│       │   │   ├── EmailInboxPanel.tsx        # Gmail inbox: real/demo mode, connect/disconnect, spam pills
│       │   │   ├── TargetAIPanel.tsx          # Email detail, bank-details card, animated progress bar
│       │   │   ├── BlueTeamPanel.tsx          # 4-stage stepper, detection status, OPA decision badge
│       │   │   └── views/
│       │   │       ├── FilesView.tsx          # Sandboxed file system (OPA enforced, fixture-only)
│       │   │       ├── BrowserView.tsx        # Sandboxed browser (no external network, fixture HTML)
│       │   │       ├── PaymentView.tsx        # Simulated banking ledger (daily limit, pending approvals)
│       │   │       └── ResultsView.tsx        # Recharts: Bar, Line, Area charts + 4 stat cards
│       │   ├── arena/                         # Live cockpit cards (future arena route)
│       │   ├── attacks/                       # PayloadTable, VectorFilter, PayloadDetailModal
│       │   ├── defence/                       # RegoRuleList, ThreatRadar, ApprovalQueue
│       │   ├── analytics/                     # MetricCharts (Recharts), LatencyComparisonBar
│       │   ├── approvals/                     # ApprovalModal, ActionDiffViewer
│       │   └── ui/                            # Reusable Button, Badge, Modal, Input, CodeBlock
│       │
│       ├── hooks/                             # React custom hooks
│       │   ├── useSimulationSocket.ts         # ★ WS hook: replay, exponential backoff, 25s heartbeat (Phase 11)
│       │   ├── useSimulationLifecycle.ts      # ★ Simulation reuse: never auto-creates on refresh (Phase 12)
│       │   └── useSimulationControls.ts       # Start, pause, resume, abort dispatchers
│       │
│       ├── lib/                               # Client utility libraries
│       │   ├── supabase/
│       │   │   ├── client.ts                  # Browser Supabase client (createBrowserClient)
│       │   │   └── server.ts                  # Server Supabase helper (createServerClient)
│       │   └── api.ts                         # ★ Typed REST client — no auth tokens, LOCAL_DEMO_MODE (Phase 12)
│       │
│       ├── context/                           # React Context providers
│       │   ├── AuthContext.tsx                # User identity, session tokens, role checks
│       │   └── SimulationContext.tsx          # Active simulation live state and event queue
│       │
│       └── types/                             # TypeScript definitions matching backend schemas
│           ├── dashboard.ts                   # ★ Dashboard interfaces from actual event.py contracts (Phase 12)
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

## 2. Directory Purpose & Architectural Responsibility

### 1. `backend/app/api/`
Houses the RESTful API endpoints and WebSocket server powered by FastAPI.
* **Separation of Tiers:** This is the single backend entry point for all simulation commands, security decisions, and event feeds.
* **`ws.py`:** Hosts the authoritative real-time event pipeline (`WebSocket /api/v1/ws/simulations/{id}`).

### 2. `backend/app/orchestration/`
Implements the multi-agent control flow using **LangGraph**.
* **`state.py`:** Holds the explicit, versioned `SimulationState` TypedDict.
* **`graph.py`:** Compiles the state machine with explicit transitions (`CREATED` -> `INITIALIZING` -> `RUNNING` -> `ANALYSING` -> `AWAITING_APPROVAL` -> `PAUSED` -> `COMPLETED` / `FAILED` / `CANCELLED`).
* **`nodes/`:** Encapsulates the execution logic for each participant (Red Team, Target AI, Blue Team, Presidio, OPA, Mock Tool Gateway).

### 3. `backend/app/ai/`
Manages AI model invocations via Google GenAI SDK.
* **`gemini_client.py`:** Provides unified Gemini API calls with strict JSON output schemas, exponential backoff retries, and latency telemetry.
* **`prompts/`:** Isolates prompt templates so attacker personas, target assistant constraints, and guardian threat rubrics can be versioned and tuned independently.

### 4. `backend/app/security/` & `backend/policies/`
The independent authorization and deterministic enforcement tier.
* **`opa_client.py`:** Evaluates incoming actions against declarative Rego rules. It operates on a **deny-by-default** basis: if OPA is unreachable, actions are unconditionally blocked.
* **`presidio_scanner.py`:** Inspects untrusted text and tool arguments for sensitive synthetic PII entities.
* **`validator.py`:** Generates cryptographic SHA-256 action hashes (`action_hash = SHA256(...)`) ensuring human approvals cannot be spoofed or applied to mutated parameters.

### 5. `backend/app/mock_tools/` & `backend/fixtures/`
The isolated sandbox environment.
* **Zero Egress:** Disallows any connection to the public internet, real mail servers, payment processors, or host file systems.
* **`gateway.py`:** The only gateway authorized to execute tools, and only after verifying a valid OPA authorization token.

### 6. `backend/app/db/` & `supabase/`
Durable persistence tier.
* Stores all 10 PRD-mandated tables (`profiles`, `simulations`, `simulation_events`, `agent_runs`, `attack_logs`, `defence_logs`, `policy_decisions`, `approval_requests`, `tool_logs`, `round_results`).
* Uses Supabase Auth and Row-Level Security (RLS) to enforce authorization boundaries.

### 7. `frontend/src/app/` (Next.js App Router)
The user interface and presentation layer.
* **Role:** Strictly presents data, streams events via WebSockets, and dispatches commands to FastAPI. It does NOT implement duplicate backend business logic.
* **`arena/[simulationId]/page.tsx`:** The dynamic route for the live Battle Arena cockpit where observers witness real-time agent confrontations.
* **`dashboard/`:** Entry point for initiating simulations and inspecting global security posture.
* **`attacks/`, `defence/`, `analytics/`, `history/`, `settings/`:** Specialized audit, rule management, and metric inspection screens.

### 8. `frontend/src/lib/` & `frontend/src/context/`
Client-side infrastructure.
* **`supabase/`:** Configures browser and server authentication helpers using `@supabase/ssr`.
* **`api.ts`:** Type-safe fetch client forwarding Supabase Bearer tokens to FastAPI.
* **`websocket.ts` & `useSimulationSocket.ts`:** Manages live WebSocket subscriptions, reconnection buffers, and sequence replay.
