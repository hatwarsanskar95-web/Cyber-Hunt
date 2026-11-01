"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  EmailItem,
  TargetAIState,
  BlueTeamState,
  GmailStatus,
  SimulationEvent,
  DashboardView,
} from "@/types/dashboard";
import { useSimulationLifecycle } from "@/hooks/useSimulationLifecycle";
import { useSimulationSocket } from "@/hooks/useSimulationSocket";
import { getGmailStatus, getGmailMessages, BACKEND_URL } from "@/lib/api";

import DashboardNavbar from "@/components/dashboard/DashboardNavbar";
import NewEmailAlert from "@/components/dashboard/NewEmailAlert";
import MainDashboard from "@/components/dashboard/MainDashboard";
import Level1EmailSecurity from "@/components/dashboard/levels/Level1EmailSecurity";
import Level2FileSecurity from "@/components/dashboard/levels/Level2FileSecurity";
import Level3BrowserSecurity from "@/components/dashboard/levels/Level3BrowserSecurity";
import Level4PaymentSecurity from "@/components/dashboard/levels/Level4PaymentSecurity";
import EmailInboxPanel, { DEMO_EMAILS } from "@/components/dashboard/EmailInboxPanel";
import TargetAIPanel from "@/components/dashboard/TargetAIPanel";
import BlueTeamPanel from "@/components/dashboard/BlueTeamPanel";
import FilesView from "@/components/dashboard/views/FilesView";
import BrowserView from "@/components/dashboard/views/BrowserView";
import PaymentView from "@/components/dashboard/views/PaymentView";
import ResultsView from "@/components/dashboard/views/ResultsView";

const INITIAL_TARGET_AI: TargetAIState = {
  status: "processing",
  email: DEMO_EMAILS[0],
  progress: 62,
  rationale: "Reading email content, extracting payment details, and preparing next action...",
};

const INITIAL_BLUE_TEAM: BlueTeamState = {
  stage: 2,
  risk_score: 85,
  severity: "high",
  threat_indicators: ["Possible Phishing"],
  decision: null,
  analysisProgress: 75,
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<DashboardView>("home");
  const [emailList, setEmailList] = useState<EmailItem[]>(DEMO_EMAILS);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>("demo-1");
  const [alertEmail, setAlertEmail] = useState<EmailItem | null>(DEMO_EMAILS[0]);
  const [targetAI, setTargetAI] = useState<TargetAIState>(INITIAL_TARGET_AI);
  const [blueTeam, setBlueTeam] = useState<BlueTeamState>(INITIAL_BLUE_TEAM);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [latestSimulationEvent, setLatestSimulationEvent] = useState<SimulationEvent | null>(null);

  const { simulationId, isLoading, createNew } = useSimulationLifecycle();

  const loadGmailData = useCallback(async () => {
    try {
      const status = await getGmailStatus();
      setGmailStatus(status);
      if (status && status.connected) {
        const msgs = await getGmailMessages(10);
        setEmailList(msgs);
        if (msgs && msgs.length > 0) {
          setSelectedEmailId(msgs[0].id);
          setAlertEmail(null);
          setTargetAI({
            status: "idle",
            email: msgs[0],
            progress: 0,
          });
          setBlueTeam({
            stage: 1,
            risk_score: 0,
            severity: null,
            threat_indicators: [],
            decision: null,
            analysisProgress: 0,
          });
        }
      } else {
        // Disconnected or Demo Mode: Keep synthetic fixtures isolated
        setEmailList(DEMO_EMAILS);
        setSelectedEmailId("demo-1");
      }
    } catch (err) {
      console.warn("Could not load Gmail status/messages:", err);
    }
  }, []);

  // Load Gmail status on mount and listen for OAuth completion
  useEffect(() => {
    setMounted(true);
    loadGmailData();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("gmail") === "connected") {
        loadGmailData();
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    const onMessage = async (e: MessageEvent) => {
      // Validate origin against backend endpoints
      const allowedOrigins = [
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        BACKEND_URL,
      ];
      if (!allowedOrigins.includes(e.origin)) {
        return;
      }
      if (e.data?.type === "GMAIL_CONNECTED") {
        await loadGmailData();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadGmailData]);

  // Event handler — maps backend event_type → state updates
  const handleEvent = useCallback((evt: SimulationEvent) => {
    setLatestSimulationEvent(evt);
    const { event_type, payload } = evt;

    if (event_type === "email.received") {
      const emailId = (payload.id as string) || evt.event_id || `msg-${Date.now()}`;
      const email: EmailItem = {
        id: emailId,
        from: (payload.from as string) ?? "Unknown",
        to: payload.to as string | undefined,
        subject: (payload.subject as string) ?? "(no subject)",
        snippet: (payload.snippet as string) ?? "",
        body: (payload.body as string) ?? "",
        attachments: (payload.attachments as EmailItem["attachments"]) ?? [],
        received_at: (payload.received_at as string) ?? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        is_untrusted: (payload.is_untrusted as boolean) ?? false,
        status_tag: (payload.is_untrusted as boolean) ? "Suspicious" : "Safe",
      };
      setEmailList((prev) => [email, ...prev.filter((e) => e.id !== email.id)]);
      setAlertEmail(email);
      setSelectedEmailId(email.id);
      setTargetAI({ status: "processing", email, progress: 10, rationale: undefined });
      setBlueTeam((prev) => ({ ...prev, stage: 1 }));
    }

    if (event_type === "target_ai.action_proposed") {
      setTargetAI((prev) => ({
        ...prev,
        status: "action_proposed",
        progress: 80,
        proposed_action: {
          tool_name: (payload.tool_name as string) ?? "",
          operation: (payload.operation as string) ?? "",
          parameters: (payload.parameters as Record<string, unknown>) ?? {},
          rationale: (payload.rationale as string) ?? "",
          thought_process: payload.thought_process as string | undefined,
        },
        rationale: (payload.rationale as string) ?? undefined,
      }));
      setBlueTeam((prev) => ({
        ...prev,
        stage: Math.max(prev.stage, 2) as BlueTeamState["stage"],
        analysisProgress: 60,
      }));
    }

    if (event_type === "guardian.analysis_completed") {
      const severity = (payload.severity as BlueTeamState["severity"]) ?? null;
      const threats = (payload.threat_indicators as string[]) ?? [];
      setBlueTeam((prev) => ({
        ...prev,
        stage: Math.max(prev.stage, 2) as BlueTeamState["stage"],
        risk_score: (payload.risk_score as number) ?? 0,
        severity,
        threat_indicators: threats,
        analysisProgress: 100,
      }));
    }

    if (event_type === "policy.decision_made") {
      const decision = (payload.decision as BlueTeamState["decision"]) ?? null;
      setBlueTeam((prev) => ({
        ...prev,
        stage: 4,
        decision,
      }));
      setTargetAI((prev) => ({ ...prev, progress: 100 }));
    }

    if (event_type === "tool.executed" || event_type === "tool.blocked") {
      setBlueTeam((prev) => ({
        ...prev,
        stage: Math.max(prev.stage, 3) as BlueTeamState["stage"],
      }));
    }

    if (event_type === "simulation.status_changed") {
      const status = payload.status as string;
      if (status === "RUNNING") {
        setTargetAI((prev) => ({
          ...prev,
          status: prev.status === "idle" ? "processing" : prev.status,
        }));
      }
      if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
        setTargetAI((prev) => ({ ...prev, status: "idle", progress: 100 }));
      }
    }
  }, []);

  const { connected: wsConnected } = useSimulationSocket({
    simulationId,
    onEvent: handleEvent,
  });

  const selectedEmail =
    emailList.find((e) => e.id === selectedEmailId) ?? (emailList.length > 0 ? emailList[0] : null);

  const handleEmailSelect = (email: EmailItem) => {
    setSelectedEmailId(email.id);
    if (targetAI.status === "idle") {
      setTargetAI({
        status: "processing",
        email,
        progress: 30,
        rationale: "Analyzing email content and extracting key details...",
      });
      setBlueTeam((prev) => ({ ...prev, stage: Math.max(prev.stage, 1) as BlueTeamState["stage"] }));
    } else {
      setTargetAI((prev) => ({ ...prev, email }));
    }
  };

  const inboxBadge = emailList.filter((e) => e.is_untrusted).length;

  return (
    <div
      className="text-slate-200 font-sans antialiased min-h-screen select-none relative overflow-x-hidden bg-[#030611]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 15% 95%, rgba(236,72,153,0.18) 0%, transparent 45%), radial-gradient(ellipse at 85% 95%, rgba(6,182,212,0.18) 0%, transparent 45%), radial-gradient(circle at 50% 10%, rgba(168,85,247,0.10) 0%, transparent 40%)",
      }}
    >
      {/* ── Sticky Top Navigation Bar (Always Visible Across All Views) ── */}
      <header className="sticky top-0 z-50 w-full bg-[#040817]/90 backdrop-blur-md border-b border-slate-800/60 px-4 py-2.5">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
          {/* Navigation Pill Tabs */}
          <nav className="flex items-center space-x-2 overflow-x-auto py-0.5">
            {[
              {
                id: "home" as const,
                label: "Dashboard",
                icon: (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                id: "simulation" as const,
                label: "Level 1: Email",
                hasDot: inboxBadge > 0,
                icon: (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                id: "files" as const,
                label: "Level 2: Files",
                icon: (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                id: "browser" as const,
                label: "Level 3: Browser",
                icon: (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                id: "payment" as const,
                label: "Level 4: Payment",
                icon: (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect height="14" rx="2" width="20" x="2" y="5" />
                    <line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                ),
              },
              {
                id: "results" as const,
                label: "Results",
                icon: (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
            ].map((item) => {
              const isActive = view === item.id || (item.id === "simulation" && view === "inbox");
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg shadow-purple-600/40 border border-purple-400/40"
                      : "bg-[#090e1d]/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium border border-slate-700/60 hover:border-slate-500/60"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.hasDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Dashboard Wrapper */}
      <div className="max-w-[1720px] mx-auto flex flex-col gap-3.5">
        {/* Alert Banner */}
        {alertEmail && (
          <NewEmailAlert
            email={alertEmail}
            onDismiss={() => setAlertEmail(null)}
          />
        )}

        {/* Content area */}
        <main className={`flex-1 ${view === "home" ? "p-4 lg:p-6" : "p-3.5 lg:p-4"}`}>
          {/* Home / Main Dashboard */}
          {view === "home" && (
            <MainDashboard onNavigate={setView} />
          )}

          {/* Level 1: Email Security */}
          {(view === "simulation" || view === "inbox") && (
            <Level1EmailSecurity
              emails={emailList}
              selectedEmailId={selectedEmailId}
              onEmailSelect={handleEmailSelect}
              gmailStatus={gmailStatus}
              onGmailStatusChange={(status) => {
                setGmailStatus(status);
                if (!status?.connected) {
                  setEmailList(DEMO_EMAILS);
                  setSelectedEmailId("demo-1");
                  setTargetAI(INITIAL_TARGET_AI);
                  setBlueTeam(INITIAL_BLUE_TEAM);
                }
              }}
              onGmailConnected={loadGmailData}
              targetAI={targetAI}
              blueTeam={blueTeam}
              simulationId={simulationId}
              latestSimulationEvent={latestSimulationEvent}
              onNavigateHome={() => setView("home")}
            />
          )}

            {/* Level 2: Files Security */}
            {view === "files" && (
              <Level2FileSecurity
                onNavigateHome={() => setView("home")}
                simulationId={simulationId}
              />
            )}

            {/* Level 3: Browser Security */}
            {view === "browser" && (
              <Level3BrowserSecurity
                onNavigateHome={() => setView("home")}
                simulationId={simulationId}
              />
            )}

            {/* Level 4: Payment Security */}
            {view === "payment" && (
              <Level4PaymentSecurity
                onNavigateHome={() => setView("home")}
                simulationId={simulationId}
              />
            )}

            {/* Results */}
            {view === "results" && (
              <div className="cyber-card rounded-xl border border-[#1c243a] p-2 min-h-[600px]">
                <ResultsView />
              </div>
            )}
          </main>

        {/* Standby simulation starter pill if no active simulation */}
        {!isLoading && !simulationId && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#0d121f] border border-purple-500/40 rounded-xl px-5 py-2.5 shadow-lg glow-purple">
            <span className="text-xs text-slate-300 font-mono">No active simulation session.</span>
            <button
              onClick={createNew}
              className="text-xs bg-gradient-to-r from-purple-700 to-indigo-600 hover:brightness-110 text-white rounded-lg px-3.5 py-1.5 font-semibold transition"
            >
              Start Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
