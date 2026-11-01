-- CYBER HUNT — Master Database Schema Migration
-- Migration: 20261031000000_init_cyberhunt_schema.sql
-- Conforms strictly to PRD v2.0 Section 15

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Mirrors auth.users with RBAC role)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('operator', 'approver', 'admin', 'judge')) DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. SIMULATIONS TABLE (Top-level simulation run entity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scenario_category TEXT NOT NULL,
    task_summary TEXT NOT NULL,
    state TEXT NOT NULL CHECK (
        state IN (
            'CREATED', 'INITIALIZING', 'RUNNING', 'ANALYSING',
            'AWAITING_APPROVAL', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'
        )
    ) DEFAULT 'CREATED',
    step_limit INT NOT NULL DEFAULT 5 CHECK (step_limit >= 1 AND step_limit <= 20),
    current_step INT NOT NULL DEFAULT 0,
    final_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. SIMULATION_EVENTS TABLE (Linear append-only event stream)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.simulation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    schema_version TEXT NOT NULL DEFAULT '1.0',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_sim_seq UNIQUE (simulation_id, sequence_number)
);

-- ============================================================================
-- 4. AGENT_RUNS TABLE (Execution audit per agent per step)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    step INT NOT NULL,
    agent_name TEXT NOT NULL CHECK (agent_name IN ('red_team', 'target_ai', 'guardian')),
    model_id TEXT NOT NULL,
    latency_ms INT,
    token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
    output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. ATTACK_LOGS TABLE (Red Team payload audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attack_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    step INT NOT NULL,
    category TEXT NOT NULL,
    strategy_summary TEXT NOT NULL,
    payload_text TEXT NOT NULL,
    target_surface TEXT NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. DEFENCE_LOGS TABLE (Blue Team Guardian threat evaluation audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.defence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    step INT NOT NULL,
    risk_score NUMERIC(4,3) NOT NULL CHECK (risk_score >= 0.0 AND risk_score <= 1.0),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    indicators TEXT[] NOT NULL DEFAULT '{}'::text[],
    explanation TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. POLICY_DECISIONS TABLE (Deterministic OPA decision audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.policy_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    step INT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'BLOCK', 'REQUIRE_APPROVAL')),
    reason_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
    matched_policy_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
    input_hash TEXT NOT NULL,
    action_id TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. APPROVAL_REQUESTS TABLE (Human-in-the-loop HITL decision queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    action_id TEXT NOT NULL,
    action_hash TEXT NOT NULL,
    approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    decision TEXT NOT NULL CHECK (decision IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
    reason TEXT,
    expiry_time TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. TOOL_LOGS TABLE (Mock Tool Gateway execution receipts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tool_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    step INT NOT NULL,
    tool_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    opa_decision TEXT NOT NULL CHECK (opa_decision IN ('ALLOW', 'BLOCK', 'REQUIRE_APPROVAL')),
    execution_status TEXT NOT NULL CHECK (execution_status IN ('SUCCESS', 'FAILED', 'BLOCKED')),
    result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 10. ROUND_RESULTS TABLE (Step-level scoring metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.round_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    step INT NOT NULL,
    attack_success BOOLEAN NOT NULL DEFAULT false,
    threat_detected BOOLEAN NOT NULL DEFAULT false,
    action_blocked BOOLEAN NOT NULL DEFAULT false,
    benign_task_completed BOOLEAN NOT NULL DEFAULT false,
    scoring_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_round_step UNIQUE (simulation_id, step)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_simulations_owner ON public.simulations(owner_id);
CREATE INDEX IF NOT EXISTS idx_simulations_state ON public.simulations(state);
CREATE INDEX IF NOT EXISTS idx_simulations_created ON public.simulations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sim_events_seq ON public.simulation_events(simulation_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_sim_events_type ON public.simulation_events(simulation_id, event_type);

CREATE INDEX IF NOT EXISTS idx_agent_runs_step ON public.agent_runs(simulation_id, step);
CREATE INDEX IF NOT EXISTS idx_attack_logs_step ON public.attack_logs(simulation_id, step);
CREATE INDEX IF NOT EXISTS idx_defence_logs_step ON public.defence_logs(simulation_id, step);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_step ON public.policy_decisions(simulation_id, step);
CREATE INDEX IF NOT EXISTS idx_approval_req_sim ON public.approval_requests(simulation_id, decision);
CREATE INDEX IF NOT EXISTS idx_tool_logs_step ON public.tool_logs(simulation_id, step);
CREATE INDEX IF NOT EXISTS idx_round_results_sim ON public.round_results(simulation_id, step);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & POLICIES
-- ============================================================================

-- Helper function to retrieve authenticated user's role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Enable RLS on all 10 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attack_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_results ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR
        public.get_current_user_role() IN ('admin', 'judge')
    );

CREATE POLICY "profiles_insert_self" ON public.profiles
    FOR INSERT WITH CHECK (
        id = auth.uid()
    );

CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE USING (
        id = auth.uid() OR public.get_current_user_role() = 'admin'
    );

-- ----------------------------------------------------------------------------
-- SIMULATIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "simulations_select_policy" ON public.simulations
    FOR SELECT USING (
        owner_id = auth.uid() OR
        public.get_current_user_role() IN ('admin', 'judge', 'approver')
    );

CREATE POLICY "simulations_insert_policy" ON public.simulations
    FOR INSERT WITH CHECK (
        owner_id = auth.uid() OR public.get_current_user_role() = 'admin'
    );

CREATE POLICY "simulations_update_policy" ON public.simulations
    FOR UPDATE USING (
        owner_id = auth.uid() OR public.get_current_user_role() = 'admin'
    );

CREATE POLICY "simulations_delete_policy" ON public.simulations
    FOR DELETE USING (
        owner_id = auth.uid() OR public.get_current_user_role() = 'admin'
    );

-- ----------------------------------------------------------------------------
-- CHILD TABLES POLICIES (Access governed by parent simulation ownership or role)
-- ----------------------------------------------------------------------------

-- Helper function to check simulation read access
CREATE OR REPLACE FUNCTION public.can_read_simulation(sim_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = sim_id AND (
            s.owner_id = auth.uid() OR
            public.get_current_user_role() IN ('admin', 'judge', 'approver')
        )
    );
$$;

-- Helper function to check simulation write access
CREATE OR REPLACE FUNCTION public.can_write_simulation(sim_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.simulations s
        WHERE s.id = sim_id AND (
            s.owner_id = auth.uid() OR
            public.get_current_user_role() = 'admin'
        )
    );
$$;

-- SIMULATION_EVENTS
CREATE POLICY "sim_events_select" ON public.simulation_events
    FOR SELECT USING (public.can_read_simulation(simulation_id));
CREATE POLICY "sim_events_insert" ON public.simulation_events
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));

-- AGENT_RUNS
CREATE POLICY "agent_runs_select" ON public.agent_runs
    FOR SELECT USING (public.can_read_simulation(simulation_id));
CREATE POLICY "agent_runs_insert" ON public.agent_runs
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));
CREATE POLICY "agent_runs_update" ON public.agent_runs
    FOR UPDATE USING (public.can_write_simulation(simulation_id));

-- ATTACK_LOGS
CREATE POLICY "attack_logs_select" ON public.attack_logs
    FOR SELECT USING (public.can_read_simulation(simulation_id));
CREATE POLICY "attack_logs_insert" ON public.attack_logs
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));

-- DEFENCE_LOGS
CREATE POLICY "defence_logs_select" ON public.defence_logs
    FOR SELECT USING (public.can_read_simulation(simulation_id));
CREATE POLICY "defence_logs_insert" ON public.defence_logs
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));

-- POLICY_DECISIONS
CREATE POLICY "policy_decisions_select" ON public.policy_decisions
    FOR SELECT USING (public.can_read_simulation(simulation_id));
CREATE POLICY "policy_decisions_insert" ON public.policy_decisions
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));

-- APPROVAL_REQUESTS
CREATE POLICY "approval_requests_select" ON public.approval_requests
    FOR SELECT USING (
        public.can_read_simulation(simulation_id) OR
        public.get_current_user_role() IN ('approver', 'admin')
    );
CREATE POLICY "approval_requests_insert" ON public.approval_requests
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));
CREATE POLICY "approval_requests_update" ON public.approval_requests
    FOR UPDATE USING (
        public.get_current_user_role() IN ('approver', 'admin') OR
        public.can_write_simulation(simulation_id)
    );

-- TOOL_LOGS
CREATE POLICY "tool_logs_select" ON public.tool_logs
    FOR SELECT USING (public.can_read_simulation(simulation_id));
CREATE POLICY "tool_logs_insert" ON public.tool_logs
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));

-- ROUND_RESULTS
CREATE POLICY "round_results_select" ON public.round_results
    FOR SELECT USING (public.can_read_simulation(simulation_id));
CREATE POLICY "round_results_insert" ON public.round_results
    FOR INSERT WITH CHECK (public.can_write_simulation(simulation_id));


-- ============================================================================
-- AUTOMATIC USER PROFILE TRIGGER (DB-007)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'operator')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
