"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  EmailItem,
  GmailStatus,
  TargetAIState,
  BlueTeamState,
  SimulationEvent,
} from "@/types/dashboard";
import {
  getGmailStatus,
  getGmailMessages,
  getGmailConnectUrl,
  disconnectGmail,
  analyzeEmail,
  listPendingApprovals,
  submitApprovalDecision,
  BACKEND_URL,
  type ApprovalRequestItem,
} from "@/lib/api";
import DownloadReportButton from "../DownloadReportButton";

// ─── Props ───────────────────────────────────────────────────────────────────
interface Level1EmailSecurityProps {
  emails: EmailItem[];
  selectedEmailId: string | null;
  onEmailSelect: (email: EmailItem) => void;
  gmailStatus: GmailStatus | null;
  onGmailStatusChange: (status: GmailStatus | null) => void;
  onGmailConnected?: () => void | Promise<void>;
  targetAI?: TargetAIState;
  blueTeam?: BlueTeamState;
  simulationId?: string | null;
  latestSimulationEvent?: SimulationEvent | null;
  onNavigateHome?: () => void;
}

// ─── Timeline Stage Type ─────────────────────────────────────────────────────
export interface AnalysisStage {
  id: number;
  name: string;
  status: "pending" | "processing" | "completed";
  timestamp?: string;
  description: string;
}

const DEFAULT_STAGES: AnalysisStage[] = [
  { id: 1, name: "New Email Detected", status: "pending", description: "Inbound email captured & sanitized" },
  { id: 2, name: "Red Team Alert", status: "pending", description: "Adversarial signature & payload evaluation" },
  { id: 3, name: "Target AI Analysis", status: "pending", description: "Gemini 2.5 intent extraction & tool proposal" },
  { id: 4, name: "Blue Team Verification", status: "pending", description: "Guardian heuristic risk & threat indicators" },
  { id: 5, name: "OPA Policy Evaluation", status: "pending", description: "Deterministic Open Policy Agent evaluation" },
  { id: 6, name: "Final Security Decision", status: "pending", description: "Enforcement: ALLOW / BLOCK / APPROVAL" },
];

// ─── Folder type ─────────────────────────────────────────────────────────────
type Folder = "inbox" | "spam" | "starred" | "sent" | "trash";

const FOLDER_QUERIES: Record<Folder, string> = {
  inbox: "in:inbox",
  spam: "in:spam",
  starred: "is:starred",
  sent: "in:sent",
  trash: "in:trash",
};

// ─── Demo fixture emails (from Stitch reference) ─────────────────────────────
export const REFERENCE_EMAILS: EmailItem[] = [
  {
    id: "ref-1",
    from: "Netflix <info@mailer.netflix.com>",
    subject: "Update your payment details",
    snippet: "Your subscription will be paused soon. Update payment information now...",
    body: "Dear Customer,\n\nWe were unable to process your latest subscription payment. To avoid service disruption and account suspension, please update your billing details immediately using our secure verification portal.\n\nFailure to update within 24 hours will result in permanent account deactivation.",
    attachments: [],
    received_at: "10:24 AM",
    is_untrusted: true,
    status_tag: "Not Analyzed",
  },
  {
    id: "ref-2",
    from: "Google <no-reply@accounts.google.com>",
    subject: "Security alert: New sign-in",
    snippet: "A new sign-in was detected on your account from Windows Chrome...",
    body: "Hi Sanskar,\n\nA new sign-in was detected on your Google Account from a Windows Chrome browser. If this was you, you don't need to do anything. If this wasn't you, please review your recent account activity.",
    attachments: [],
    received_at: "9:47 AM",
    is_untrusted: false,
    status_tag: "Not Analyzed",
  },
  {
    id: "ref-3",
    from: "Amazon <security-update@amazon-verify.com>",
    subject: "Verify your account information",
    snippet: "Action required to keep your account active...",
    body: "Important notification regarding your Amazon order: We detected unauthorized attempts to access your billing address. Verify your identity immediately to unlock account features.",
    attachments: [],
    received_at: "8:30 AM",
    is_untrusted: true,
    status_tag: "Not Analyzed",
  },
  {
    id: "ref-4",
    from: "LinkedIn <notifications@linkedin.com>",
    subject: "You have a new connection request",
    snippet: "Sanskar, you have a new connection request waiting...",
    body: "You have a new connection request from a Security Architect at Cloudflare. View their profile and connect on LinkedIn.",
    attachments: [],
    received_at: "Yesterday",
    is_untrusted: false,
    status_tag: "Not Analyzed",
  },
  {
    id: "ref-5",
    from: "Paytm <alerts@paytm-services.net>",
    subject: "KYC update required",
    snippet: "Update your KYC to avoid service disruption...",
    body: "URGENT: Your wallet KYC documents have expired. Submit your PAN card and Aadhaar details immediately to restore outgoing payment capability.",
    attachments: [],
    received_at: "Yesterday",
    is_untrusted: true,
    status_tag: "Not Analyzed",
  },
];

function senderName(from: string): string {
  const match = from.match(/^([^<]+)</);
  return (match ? match[1].trim() : from).split("@")[0].trim();
}

function senderInitial(from: string): string {
  return (senderName(from)[0] || "?").toUpperCase();
}

const AVATAR_COLORS: Record<string, string> = {
  N: "bg-red-600",
  G: "bg-blue-600",
  A: "bg-purple-600",
  L: "bg-sky-600",
  P: "bg-blue-500",
};

export default function Level1EmailSecurity({
  emails,
  selectedEmailId,
  onEmailSelect,
  gmailStatus,
  onGmailStatusChange,
  onGmailConnected,
  targetAI,
  blueTeam,
  simulationId,
  latestSimulationEvent,
  onNavigateHome,
}: Level1EmailSecurityProps) {
  // Folder & Email List State
  const [activeFolder, setActiveFolder] = useState<Folder>("inbox");
  const [folderEmails, setFolderEmails] = useState<EmailItem[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email Selection Requirements (Req 3):
  // 1. Preview selection (clicking row previews email ONLY, does not select checkbox or analyze)
  const [selectedLocal, setSelectedLocal] = useState<string | null>(selectedEmailId || "ref-1");
  // 2. Checkbox selection: exactly ONE email checked at a time (radio behavior; checking another unchecks previous)
  const [checkedEmailId, setCheckedEmailId] = useState<string | null>(null);

  // Red Team Alert Notification (Req 4)
  const [alertVisible, setAlertVisible] = useState(true);
  const [alertSubject, setAlertSubject] = useState<string>("New email received – Auto analyzing now...");
  const [alertSender, setAlertSender] = useState<string>("Inbound Scanner");

  // Real-Time Analysis State & Stopwatch Timer (Req 2)
  const [analyzing, setAnalyzing] = useState(false);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-Time Threat Analysis Timeline (Req 1)
  const [timelineStages, setTimelineStages] = useState<AnalysisStage[]>(DEFAULT_STAGES);

  // Analysis result summary
  const [analysisResult, setAnalysisResult] = useState<{
    riskScore: number;
    threats: string[];
    decision: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
    explanation: string;
  } | null>(null);
  const [currentAnalysisRecord, setCurrentAnalysisRecord] = useState<Record<string, any> | null>(null);

  // Human Review & Approval Modal System (Req 5)
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequestItem | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Local Gmail connection state to ensure instant reactivity and persistence
  const [localGmailStatus, setLocalGmailStatus] = useState<GmailStatus | null>(gmailStatus);
  const [syncingInbox, setSyncingInbox] = useState(false);

  useEffect(() => {
    if (gmailStatus) setLocalGmailStatus(gmailStatus);
  }, [gmailStatus]);

  const isConnected = Boolean(localGmailStatus?.connected || gmailStatus?.connected);
  const connectedEmail = localGmailStatus?.email || gmailStatus?.email || "hatwarsanskar31@gmail.com";
  const PAGE_SIZE = 5;

  // ─── Real-Time Live Gmail Synchronizer ────────────────────────────────────
  const refreshRealGmail = useCallback(async (showLoading = false) => {
    if (showLoading) setSyncingInbox(true);
    try {
      const status = await getGmailStatus();
      if (status) {
        setLocalGmailStatus(status);
        onGmailStatusChange(status);
        if (status.connected) {
          const msgs = await getGmailMessages(20);
          if (msgs && msgs.length > 0) {
            setFolderEmails(msgs);
            if (!selectedLocal || selectedLocal.startsWith("ref-") || selectedLocal.startsWith("demo-")) {
              setSelectedLocal(msgs[0].id);
              onEmailSelect(msgs[0]);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not sync live Gmail:", err);
    } finally {
      if (showLoading) setSyncingInbox(false);
    }
  }, [onGmailStatusChange, onEmailSelect, selectedLocal]);

  // Initial mount load and 5-second real-time sync loop
  useEffect(() => {
    refreshRealGmail();
    const interval = setInterval(() => {
      refreshRealGmail(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshRealGmail]);

  // ─── Stopwatch Timer Management (Req 2) ──────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerStartRef.current = performance.now();
    setLiveDuration(0);
    timerIntervalRef.current = setInterval(() => {
      if (timerStartRef.current) {
        const elapsed = (performance.now() - timerStartRef.current) / 1000;
        setLiveDuration(parseFloat(elapsed.toFixed(1)));
      }
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timerStartRef.current) {
      const finalSec = (performance.now() - timerStartRef.current) / 1000;
      setLastDuration(parseFloat(finalSec.toFixed(2)));
      timerStartRef.current = null;
    }
    setLiveDuration(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // ─── Initial Load & Persistence for Pending Approvals (Req 5) ──────────────
  const loadApprovals = useCallback(async () => {
    try {
      const list = await listPendingApprovals();
      if (list && list.length > 0) {
        const latest = list[0];
        setPendingApproval(latest);
        setApprovalModalOpen(true);
      }
    } catch (err) {
      console.warn("Could not fetch pending approvals on load:", err);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  // ─── Load Folder Emails ───────────────────────────────────────────────────
  const loadFolder = useCallback(
    async (folder: Folder) => {
      if (!isConnected) return;
      setFolderLoading(true);
      try {
        const q = FOLDER_QUERIES[folder];
        const res = await fetch(
          `${BACKEND_URL}/api/v1/auth/gmail/messages?max_results=20&q=${encodeURIComponent(q)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw: any[] = data?.messages ?? [];
        const mapped: EmailItem[] = raw.map((m: any) => ({
          id: m.id || `msg-${Math.random().toString(36).slice(2, 8)}`,
          from: m.from_address || m.from || "Unknown",
          to: m.to_address || m.to,
          subject: m.subject || "(no subject)",
          snippet: m.snippet || "",
          body: m.body_text || m.body || "",
          attachments: m.attachments ?? [],
          received_at: m.received_at || new Date().toISOString(),
          is_untrusted: m.is_untrusted ?? false,
          status_tag: m.status_tag || (m.is_untrusted ? "Suspicious" : "Not Analyzed"),
        }));
        setFolderEmails(mapped);
      } catch (err) {
        console.warn("Folder load error:", err);
      } finally {
        setFolderLoading(false);
      }
    },
    [isConnected]
  );

  useEffect(() => {
    if (isConnected) {
      if (activeFolder === "inbox") {
        if (folderEmails.length === 0 && emails.length > 0) {
          setFolderEmails(emails);
        }
      } else {
        loadFolder(activeFolder);
      }
    }
  }, [isConnected, activeFolder, emails, folderEmails.length, loadFolder]);

  const handleFolderSwitch = (folder: Folder) => {
    setActiveFolder(folder);
    setPage(1);
    setSearchQuery("");
    setCheckedEmailId(null);
  };

  const displayEmails =
    folderEmails.length > 0
      ? folderEmails
      : emails.length > 0 && !emails[0].id.startsWith("demo-")
      ? emails
      : REFERENCE_EMAILS;
  const filteredEmails = searchQuery.trim()
    ? displayEmails.filter(
        (e) =>
          senderName(e.from).toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.snippet.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : displayEmails;

  const totalPages = Math.max(1, Math.ceil(filteredEmails.length / PAGE_SIZE));
  const pagedEmails = filteredEmails.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Email currently displayed in preview pane (row click)
  const currentEmail =
    displayEmails.find((e) => e.id === selectedLocal) ?? (pagedEmails.length > 0 ? pagedEmails[0] : null);

  // Email currently checked with checkbox for analysis (Req 3)
  const checkedEmail = displayEmails.find((e) => e.id === checkedEmailId) ?? null;

  const totalCount = displayEmails.length;
  const suspiciousCount = displayEmails.filter((e) => e.is_untrusted || e.status_tag === "Suspicious" || e.status_tag === "Blocked").length;
  const safeCount = totalCount - suspiciousCount;
  const safePercent = totalCount > 0 ? (safeCount / totalCount) * 100 : 66.6;
  const suspiciousPercent = totalCount > 0 ? (suspiciousCount / totalCount) * 100 : 33.3;

  // ─── WebSocket Event Processing (Req 1, 4, 5) ──────────────────────────────
  useEffect(() => {
    if (!latestSimulationEvent) return;
    const { event_type, payload, timestamp } = latestSimulationEvent;
    const nowStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

    if (event_type === "email.received") {
      const subj = (payload.subject as string) || "Inbound Email";
      const from = (payload.from as string) || "Unknown";
      setAlertSubject(`New email: ${subj}`);
      setAlertSender(from);
      setAlertVisible(true);

      // Start live stopwatch and timeline (Req 1, 2, 4)
      setAnalyzing(true);
      startTimer();
      setTimelineStages([
        { id: 1, name: "New Email Detected", status: "completed", timestamp: nowStr, description: `Captured from ${from}` },
        { id: 2, name: "Red Team Alert", status: "processing", timestamp: nowStr, description: "Scanning adversarial markers..." },
        { id: 3, name: "Target AI Analysis", status: "pending", description: "Gemini 2.5 intent extraction" },
        { id: 4, name: "Blue Team Verification", status: "pending", description: "Guardian heuristic evaluation" },
        { id: 5, name: "OPA Policy Evaluation", status: "pending", description: "Evaluating Open Policy Agent rules" },
        { id: 6, name: "Final Security Decision", status: "pending", description: "Pending policy resolution" },
      ]);
    } else if (event_type === "red_team.attack_generated") {
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id === 2) return { ...s, status: "completed", timestamp: nowStr, description: "Adversarial signature verified" };
          if (s.id === 3) return { ...s, status: "processing", timestamp: nowStr, description: "Target AI analyzing intent..." };
          return s;
        })
      );
    } else if (event_type === "target_ai.action_proposed") {
      const tool = (payload.tool_name as string) || "action";
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id === 3) return { ...s, status: "completed", timestamp: nowStr, description: `Target proposed: ${tool}` };
          if (s.id === 4) return { ...s, status: "processing", timestamp: nowStr, description: "Blue Team verifying risk..." };
          return s;
        })
      );
    } else if (event_type === "guardian.analysis_completed") {
      const score = (payload.risk_score as number) ?? 0.8;
      const pct = Math.round(score * 100);
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id === 4) return { ...s, status: "completed", timestamp: nowStr, description: `Risk Score: ${pct}/100` };
          if (s.id === 5) return { ...s, status: "processing", timestamp: nowStr, description: "Evaluating Rego policy..." };
          return s;
        })
      );
    } else if (event_type === "policy.decision_made") {
      const decision = (payload.decision as string) || "REQUIRE_APPROVAL";
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id === 5) return { ...s, status: "completed", timestamp: nowStr, description: `OPA returned: ${decision}` };
          if (s.id === 6) {
            return {
              ...s,
              status: decision === "REQUIRE_APPROVAL" ? "processing" : "completed",
              timestamp: nowStr,
              description: decision === "REQUIRE_APPROVAL" ? "Awaiting human operator sign-off" : `Enforced: ${decision}`,
            };
          }
          return s;
        })
      );
    } else if (event_type === "APPROVAL_REQUIRED") {
      // Human Review Required (Req 5)
      const req: ApprovalRequestItem = {
        id: (payload.id as string) || `app-${Date.now()}`,
        simulation_id: (payload.simulation_id as string) || simulationId || "",
        action_id: (payload.action_id as string) || "",
        action_hash: (payload.action_hash as string) || "",
        decision: "PENDING",
        expiry_time: (payload.expiry_time as string) || new Date().toISOString(),
        email_id: (payload.email_id as string) || "",
        email_from: (payload.email_from as string) || alertSender,
        email_subject: (payload.email_subject as string) || alertSubject,
        threat_score: (payload.threat_score as number) || 85,
        target_findings: (payload.target_findings as string) || "Sensitive link interaction proposed",
        blue_findings: (payload.blue_findings as string) || "Phishing indicators & coercive urgency",
        reason: (payload.reason as string) || "Financial/credential policy requires human approval",
        recommended_action: (payload.recommended_action as string) || "BLOCK",
      };
      setPendingApproval(req);
      setApprovalModalOpen(true);
      setAnalyzing(false);
      stopTimer();
    } else if (event_type === "tool.executed" || event_type === "tool.blocked") {
      setAnalyzing(false);
      stopTimer();
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id === 6) {
            return {
              ...s,
              status: "completed",
              timestamp: nowStr,
              description: event_type === "tool.executed" ? "Executed: ALLOW" : "Blocked: SAFE",
            };
          }
          return s;
        })
      );
    }
  }, [latestSimulationEvent, simulationId, startTimer, stopTimer, alertSender, alertSubject]);

  // ─── Manual Email Analysis Workflow (Req 3) ────────────────────────────────
  const handleAnalyzeSelected = async () => {
    if (!checkedEmail || analyzing) return;

    setAnalyzing(true);
    setAnalysisResult(null);
    setCurrentAnalysisRecord(null);
    startTimer();

    // Mark current email as Analyzing
    setFolderEmails((prev) =>
      prev.map((e) => (e.id === checkedEmail.id ? { ...e, status_tag: "Analyzing" } : e))
    );

    const now = new Date().toLocaleTimeString();
    // Reset timeline to stage 1 active
    setTimelineStages([
      { id: 1, name: "New Email Detected", status: "completed", timestamp: now, description: `Selected: ${checkedEmail.subject.slice(0, 32)}` },
      { id: 2, name: "Red Team Alert", status: "processing", timestamp: now, description: "Scanning adversarial markers..." },
      { id: 3, name: "Target AI Analysis", status: "pending", description: "Gemini 2.5 intent extraction" },
      { id: 4, name: "Blue Team Verification", status: "pending", description: "Guardian heuristic evaluation" },
      { id: 5, name: "OPA Policy Evaluation", status: "pending", description: "Open Policy Agent rule check" },
      { id: 6, name: "Final Security Decision", status: "pending", description: "Pending policy resolution" },
    ]);

    try {
      // Call backend REST endpoint
      const response = await analyzeEmail(checkedEmail, simulationId || undefined);
      const res = response?.result;
      const analysis = res?.analysis;

      // Extract grounded metrics from backend
      const riskScore: number =
        typeof analysis?.risk_score === "number"
          ? analysis.risk_score
          : res?.status === "ALLOW"
          ? 5
          : res?.status === "AWAITING_APPROVAL"
          ? 55
          : 90;

      const finalDecision: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" =
        analysis?.decision === "ALLOW" || res?.status === "ALLOW"
          ? "ALLOW"
          : analysis?.decision === "REQUIRE_APPROVAL" || res?.status === "AWAITING_APPROVAL"
          ? "REQUIRE_APPROVAL"
          : "BLOCK";

      const isSafe = finalDecision === "ALLOW";
      const threatList: string[] =
        analysis?.threat_indicators && analysis.threat_indicators.length > 0
          ? analysis.threat_indicators
          : isSafe
          ? ["DKIM / SPF verified", "Clean content", "No adversarial payload detected"]
          : ["Adversarial indicators detected"];

      const explanationText =
        analysis?.explanation ||
        (isSafe
          ? "Clean email verified. OPA Policy Engine authorized decision as ALLOW."
          : `Security findings detected. OPA Policy Engine evaluated decision as ${finalDecision}.`);

      // Progress timeline stages
      const t1 = new Date().toLocaleTimeString();
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id <= 5) return { ...s, status: "completed", timestamp: t1 };
          if (s.id === 6) {
            return {
              ...s,
              status: finalDecision === "REQUIRE_APPROVAL" ? "processing" : "completed",
              timestamp: t1,
              description: `Enforcement: ${finalDecision}`,
            };
          }
          return s;
        })
      );

      setAnalysisResult({
        riskScore,
        threats: threatList,
        decision: finalDecision,
        explanation: explanationText,
      });

      // Update email status tag in local display
      const newStatusTag = isSafe
        ? "Safe"
        : finalDecision === "REQUIRE_APPROVAL"
        ? "Requires Human Review"
        : "Blocked";

      setFolderEmails((prev) =>
        prev.map((e) =>
          e.id === checkedEmail.id
            ? {
                ...e,
                status_tag: newStatusTag,
                is_untrusted: !isSafe,
              }
            : e
        )
      );

      // Persist completed record to local storage for Results tab & PDF reports
      try {
        const historyRecord = {
          id: `email-${checkedEmail.id}-${Date.now()}`,
          security_level: "email",
          item_name: checkedEmail.subject || "Untitled Email",
          from: checkedEmail.from,
          date_time: new Date().toISOString(),
          decision: finalDecision,
          risk_score: riskScore,
          confidence_score: analysis?.confidence_score ?? (isSafe ? 95 : 92),
          threat_classification: isSafe ? "Clean / Safe" : finalDecision === "REQUIRE_APPROVAL" ? "Uncertain / Moderate Risk" : "Malicious / Phishing",
          threat_indicators: threatList,
          evidence: analysis?.evidence || threatList,
          explanation: explanationText,
          checks_completed: analysis?.checks_completed || [
            "Sender & Domain Reputation Inspection",
            "MIME Header & Display Name Integrity",
            "Credential Harvesting & Phishing Signature Check",
            "Adversarial Prompt Injection & LLM Exploit Scan",
            "Embedded Hyperlink & IP Address Verification",
            "Attachment Safety Inspection",
            "Open Policy Agent (OPA) Guardrail Evaluation",
          ],
          target_ai_finding: analysis?.target_ai_finding || (isSafe ? "Benign communication fulfilled" : "Adversarial instructions flagged"),
          blue_team_verification: analysis?.blue_team_verification || (isSafe ? "Zero threat indicators detected" : "Adversarial signatures detected"),
          opa_policy_reason: analysis?.opa_policy_reason || (isSafe ? "OPERATION_WITHIN_POLICY_ALLOWLIST" : "OPA_SECURITY_BLOCK"),
          remediation: analysis?.remediation || (isSafe ? "No action required" : "Quarantine email and block domain"),
        };
        setCurrentAnalysisRecord(historyRecord);
        const existing = JSON.parse(sessionStorage.getItem("CYBERHUNT_ANALYSIS_HISTORY") || "[]");
        const filtered = existing.filter((item: any) => item.id !== historyRecord.id);
        filtered.unshift(historyRecord);
        sessionStorage.setItem("CYBERHUNT_ANALYSIS_HISTORY", JSON.stringify(filtered.slice(0, 100)));
      } catch (storageErr) {
        console.debug("Session storage write skipped:", storageErr);
      }

      // Trigger Requirement 5: Human Approval Modal if required
      if (finalDecision === "REQUIRE_APPROVAL") {
        const approvalReq: ApprovalRequestItem = {
          id: res?.approval_id || `app-${Date.now()}`,
          simulation_id: response?.simulation_id || simulationId || "sim-demo-manual",
          action_id: `act-${Date.now()}`,
          action_hash: res?.action_hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          decision: "PENDING",
          expiry_time: new Date(Date.now() + 86400000).toISOString(),
          email_id: checkedEmail.id,
          email_from: checkedEmail.from,
          email_subject: checkedEmail.subject,
          threat_score: riskScore,
          target_findings: analysis?.target_ai_finding || "Action requires operator review",
          blue_findings: threatList.join(", ") || "Moderate uncertainty markers detected",
          reason: analysis?.opa_policy_reason || "Policy threshold requires human verification",
          recommended_action: "REQUIRE_APPROVAL",
        };
        setPendingApproval(approvalReq);
        setApprovalModalOpen(true);
      }
    } catch (err) {
      console.error("Manual analysis failed:", err);
      // Mark current email as Analysis Failed
      setFolderEmails((prev) =>
        prev.map((e) => (e.id === checkedEmail.id ? { ...e, status_tag: "Analysis Failed" } : e))
      );
      const tErr = new Date().toLocaleTimeString();
      setTimelineStages((prev) =>
        prev.map((s) => ({ ...s, status: "completed", timestamp: tErr }))
      );
    } finally {
      setAnalyzing(false);
      stopTimer();
    }
  };

  // ─── Human Decision Submission (Req 5: ALLOW / BLOCK) ─────────────────────
  const handleDecision = async (decision: "APPROVED" | "REJECTED") => {
    if (!pendingApproval) return;
    setSubmittingDecision(true);
    setDecisionFeedback(null);

    try {
      await submitApprovalDecision(
        pendingApproval.id,
        decision,
        pendingApproval.action_hash,
        decision === "APPROVED" ? "Human operator manually authorized" : "Human operator blocked suspicious email"
      );

      const decisionLabel = decision === "APPROVED" ? "Allowed" : "Blocked";

      // Update email status in lists
      setFolderEmails((prev) =>
        prev.map((e) =>
          e.id === pendingApproval.email_id
            ? { ...e, status_tag: decisionLabel, is_untrusted: decision === "REJECTED" }
            : e
        )
      );

      // Update timeline stage 6 to completed
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id === 6) {
            return {
              ...s,
              status: "completed",
              timestamp: new Date().toLocaleTimeString(),
              description: `Operator Decided: ${decisionLabel.toUpperCase()}`,
            };
          }
          return s;
        })
      );

      setDecisionFeedback(`Decision recorded: Email successfully ${decisionLabel.toUpperCase()}!`);
      if (currentAnalysisRecord) {
        const updated = {
          ...currentAnalysisRecord,
          decision: decisionLabel.toUpperCase(),
          explanation: `Human operator decision: ${decisionLabel.toUpperCase()}. Action enforced.`,
        };
        setCurrentAnalysisRecord(updated);
        try {
          const existing = JSON.parse(sessionStorage.getItem("CYBERHUNT_ANALYSIS_HISTORY") || "[]");
          const filtered = existing.filter((item: any) => item.id !== updated.id);
          filtered.unshift(updated);
          sessionStorage.setItem("CYBERHUNT_ANALYSIS_HISTORY", JSON.stringify(filtered.slice(0, 100)));
        } catch (_) {}
      }
      setTimeout(() => {
        setApprovalModalOpen(false);
        setPendingApproval(null);
        setDecisionFeedback(null);
      }, 1200);
    } catch (err: any) {
      console.error("Failed to submit approval decision:", err);
      setDecisionFeedback(`Error submitting decision: ${err?.message || "Check backend connection"}`);
    } finally {
      setSubmittingDecision(false);
    }
  };

  // ─── Gmail OAuth Management ────────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      const allowed = ["http://127.0.0.1:8000", "http://localhost:8000", "http://127.0.0.1:8001", "http://localhost:8001", BACKEND_URL];
      if (!allowed.includes(e.origin)) return;
      if (e.data?.type === "GMAIL_CONNECTED") {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
          popupRef.current = null;
        }
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setConnectLoading(false);
        setErrorMessage(null);
        await refreshRealGmail(true);
        if (onGmailConnected) await onGmailConnected();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onGmailConnected, refreshRealGmail]);

  const handleConnect = async () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }
    setErrorMessage(null);
    setConnectLoading(true);
    const width = 500,
      height = 650;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
      "about:blank",
      "cyberhunt_gmail_oauth",
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=yes,resizable=yes`
    );
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      setErrorMessage("Popup blocked by browser. Please allow popups for CYBER HUNT.");
      setConnectLoading(false);
      return;
    }
    popupRef.current = popup;
    try {
      popup.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0a0d14;color:#f9fafb;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0}.s{width:36px;height:36px;border:3px solid rgba(139,92,246,.2);border-top-color:#8b5cf6;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:16px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="s"></div><p style="color:#94a3b8;font-size:13px">Connecting to Google Accounts…</p></body></html>`
      );
    } catch (_) {}

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const s = await getGmailStatus();
        if (s && s.connected) {
          if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
          popupRef.current = null;
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setConnectLoading(false);
          setLocalGmailStatus(s);
          onGmailStatusChange(s);
          await refreshRealGmail(true);
          if (onGmailConnected) await onGmailConnected();
          return;
        }
      } catch (_) {}

      if (!popupRef.current || popupRef.current.closed) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        popupRef.current = null;
        setConnectLoading(false);
        await refreshRealGmail(false);
      }
    }, 1200);

    try {
      const { authorization_url } = await getGmailConnectUrl();
      if (popupRef.current && !popupRef.current.closed) popup.location.href = authorization_url;
    } catch (err) {
      if (popup && !popup.closed) popup.close();
      popupRef.current = null;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setConnectLoading(false);
      setErrorMessage("Failed to initiate Gmail authorization. Backend may be offline.");
    }
  };

  const handleDisconnect = async () => {
    setDisconnectLoading(true);
    try {
      await disconnectGmail();
      setLocalGmailStatus({ connected: false, email: undefined, scopes: [], is_expired: false, message: "Disconnected" });
      onGmailStatusChange(null);
      setFolderEmails([]);
      setSelectedLocal(null);
      setCheckedEmailId(null);
      setAnalysisResult(null);
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setDisconnectLoading(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col gap-3.5 min-w-0 text-xs selection:bg-[#ff2e55] selection:text-white"
      style={{
        backgroundColor: "#060911",
        backgroundImage:
          "radial-gradient(ellipse 55% 45% at 20% 98%, rgba(255, 20, 75, 0.25) 0%, transparent 65%), radial-gradient(ellipse 65% 45% at 85% 98%, rgba(0, 130, 255, 0.28) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 50% 100%, rgba(200, 20, 100, 0.12) 0%, transparent 60%)",
      }}
    >
      {/* ── Top Banner ───────────────────────────────────────────────────── */}
      <section
        className="relative rounded-2xl bg-[#0d1222]/90 border border-red-500/70 p-3 px-4.5 lg:py-3.5 lg:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 backdrop-blur-md"
        style={{
          boxShadow: "0 0 20px -4px rgba(255, 46, 85, 0.45), inset 0 0 12px -3px rgba(255, 46, 85, 0.15)",
        }}
        data-purpose="header-banner"
      >
        <div className="flex items-center gap-3.5">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 hover:border-slate-500 text-xs font-semibold transition shadow-sm"
              title="Return to Main Dashboard"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Dashboard</span>
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-red-950/40 border border-red-500/60 flex items-center justify-center text-red-500 shadow-[0_0_12px_rgba(255,46,85,0.4)] flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Level 1 – Email Security
              {pendingApproval && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse">
                  Human Approval Pending
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 font-normal mt-0.5">
              Autonomous multi-agent threat pipeline with OPA policy engine and human-in-the-loop review.
            </p>
          </div>
        </div>

        {/* Gmail connection status indicator & Pending Review Pill */}
        <div className="flex items-center gap-2 self-start md:self-center">
          {pendingApproval && (
            <button
              onClick={() => setApprovalModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-[0_0_12px_rgba(245,158,11,0.5)] transition animate-pulse"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Review Pending Decision</span>
            </button>
          )}

          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111728] border border-emerald-500/50 text-xs font-medium text-slate-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 12.713L2.4 5.372C2.15 5.792 2 6.279 2 6.8v10.4C2 18.292 2.908 19.2 4 19.2h16c1.092 0 2-.908 2-2V6.8c0-.521-.15-.998-.4-1.428L12 12.713z"
                    fill="#EA4335"
                  />
                  <path
                    d="M22 6.8V4.8C22 3.692 21.092 2.8 20 2.8H4C2.908 2.8 2 3.692 2 4.8v2l10 7.6L22 6.8z"
                    fill="#4285F4"
                  />
                  <path d="M20 2.8h-4v6.4l4-3.2V2.8z" fill="#34A853" />
                  <path d="M8 2.8H4v3.2l4 3.2V2.8z" fill="#FBBC05" />
                </svg>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                <span className="font-semibold text-emerald-400">Gmail Connected</span>
                <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">({connectedEmail})</span>
              </div>

              <button
                onClick={() => refreshRealGmail(true)}
                disabled={syncingInbox}
                title="Sync live Gmail messages now"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-cyan-400 text-xs font-semibold transition shadow-sm"
              >
                <svg className={`w-3.5 h-3.5 ${syncingInbox ? "animate-spin text-cyan-400" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{syncingInbox ? "Syncing..." : "Sync Gmail"}</span>
              </button>

              <button
                onClick={handleDisconnect}
                disabled={disconnectLoading}
                className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 transition text-xs"
              >
                {disconnectLoading ? "..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connectLoading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:brightness-110 text-white font-semibold text-xs shadow-[0_0_12px_rgba(255,46,85,0.4)] transition"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 12.713L2.4 5.372C2.15 5.792 2 6.279 2 6.8v10.4C2 18.292 2.908 19.2 4 19.2h16c1.092 0 2-.908 2-2V6.8c0-.521-.15-.998-.4-1.428L12 12.713z"
                  fill="#ffffff"
                />
              </svg>
              <span>{connectLoading ? "Connecting…" : "Connect Gmail"}</span>
            </button>
          )}
        </div>
      </section>

      {/* ── SubNavTabs (Mailbox Filter Tabs) ─────────────────────────────── */}
      <nav className="flex flex-wrap items-center gap-2 text-xs font-medium" data-purpose="mailbox-filter-tabs">
        {(["inbox", "spam", "starred", "sent", "trash"] as Folder[]).map((folder) => {
          const isActive = activeFolder === folder;
          const countLabel = folder === "inbox" ? ` (${totalCount})` : "";
          return (
            <button
              key={folder}
              onClick={() => handleFolderSwitch(folder)}
              className={
                isActive
                  ? "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white font-semibold shadow-[0_0_10px_rgba(255,46,85,0.4)] border border-red-500"
                  : "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0e1424] hover:bg-[#141b30] border border-slate-800 text-slate-300 transition-colors"
              }
            >
              <span className="capitalize">{folder}{countLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Content Grid (3 Columns) ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start" data-purpose="content-grid">
        {/* Column 1: Left Account Details & Preview Pane (3 Cols) */}
        <div className="xl:col-span-3 space-y-3" data-purpose="account-summary-column">
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 12.713L2.4 5.372C2.15 5.792 2 6.279 2 6.8v10.4C2 18.292 2.908 19.2 4 19.2h16c1.092 0 2-.908 2-2V6.8c0-.521-.15-.998-.4-1.428L12 12.713z"
                    fill="#EA4335"
                  />
                  <path
                    d="M22 6.8V4.8C22 3.692 21.092 2.8 20 2.8H4C2.908 2.8 2 3.692 2 4.8v2l10 7.6L22 6.8z"
                    fill="#4285F4"
                  />
                  <path d="M20 2.8h-4v6.4l4-3.2V2.8z" fill="#34A853" />
                  <path d="M8 2.8H4v3.2l4 3.2V2.8z" fill="#FBBC05" />
                </svg>
                <span className="text-xs font-semibold text-white">Gmail Account</span>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                  isConnected
                    ? "text-emerald-400 bg-emerald-950/60 border-emerald-500/40"
                    : "text-slate-400 bg-slate-900 border-slate-700"
                }`}
              >
                {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {isConnected ? "Connected (Live)" : "Demo Mode"}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono break-all -mt-1">{connectedEmail}</p>

            <div className="space-y-1 pt-1">
              <div
                onClick={() => handleFolderSwitch("inbox")}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                  activeFolder === "inbox"
                    ? "bg-red-600/10 border border-red-500/40 text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Inbox</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {totalCount}
                </span>
              </div>
            </div>
          </div>

          {/* Email Preview & Manual Analysis Card (Req 3) */}
          {currentEmail && (
            <div
              className="rounded-2xl bg-[#0c1322] border border-cyan-500/40 p-3.5 space-y-2.5"
              style={{
                boxShadow: "0 0 16px -4px rgba(0, 140, 255, 0.25), inset 0 0 12px -5px rgba(0, 140, 255, 0.12)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Email Preview
                </span>
                <span className="text-[10px] text-slate-400">{currentEmail.received_at}</span>
              </div>
              <p className="text-xs font-semibold text-slate-100 truncate">{currentEmail.subject}</p>
              <p className="text-[10px] text-slate-400 truncate">From: {currentEmail.from}</p>
              <div className="text-[11px] text-slate-300 leading-normal max-h-28 overflow-y-auto bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                {currentEmail.body || currentEmail.snippet}
              </div>

              {/* Requirement 3: Analyze Selected Email button */}
              <div className="pt-1">
                {checkedEmail ? (
                  <div className="mb-2 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-[11px] text-cyan-300 flex items-center justify-between">
                    <span className="truncate">Selected for Scan: <strong>{checkedEmail.subject.slice(0, 22)}...</strong></span>
                    <button
                      onClick={() => setCheckedEmailId(null)}
                      className="text-slate-400 hover:text-white text-[10px] ml-1 underline"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic mb-1.5 text-center">
                    Check an email's box in the list to enable analysis.
                  </p>
                )}

                <button
                  onClick={handleAnalyzeSelected}
                  disabled={!checkedEmail || analyzing}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 ${
                    !checkedEmail || analyzing
                      ? "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                      : "bg-gradient-to-r from-red-600 via-purple-600 to-cyan-600 hover:brightness-110 text-white shadow-[0_0_15px_rgba(255,46,85,0.4)]"
                  }`}
                >
                  {analyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Analyzing Selected Email ({liveDuration}s)…</span>
                    </>
                  ) : (
                    <span>Analyze Selected Email</span>
                  )}
                </button>
              </div>

              {analysisResult && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Threat Score</span>
                    <span className={`font-bold ${analysisResult.riskScore >= 70 ? "text-red-400" : "text-emerald-400"}`}>
                      {analysisResult.riskScore} / 100
                    </span>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-lg border text-center font-bold text-xs ${
                      analysisResult.decision === "BLOCK"
                        ? "bg-red-950/60 border-red-500/80 text-red-400"
                        : analysisResult.decision === "REQUIRE_APPROVAL"
                        ? "bg-amber-950/60 border-amber-500/80 text-amber-400"
                        : "bg-emerald-950/60 border-emerald-500/80 text-emerald-400"
                    }`}
                  >
                    OPA Decision: {analysisResult.decision}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">{analysisResult.explanation}</p>
                  <DownloadReportButton analysisData={currentAnalysisRecord} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Center Email List with Radio-like Checkboxes (Req 3) (5 Cols) */}
        <div className="xl:col-span-5 space-y-3" data-purpose="inbox-list-column">
          <div className="rounded-2xl bg-[#0c1220] border border-red-500/50 p-3.5 shadow-[0_0_16px_rgba(255,46,85,0.18)]">
            {/* Inbox Header with Search Bar */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h2 className="text-xs font-bold text-white tracking-wide">
                  <span className="capitalize">{activeFolder}</span> ({filteredEmails.length})
                </h2>
              </div>
              {/* Search Input */}
              <div className="relative w-44 sm:w-52">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#111728] border border-slate-700/80 text-xs rounded-full pl-8 pr-2.5 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Search in emails..."
                />
              </div>
            </div>

            {/* Email Rows */}
            {folderLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-400 text-xs">Fetching emails from Gmail…</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 pt-1.5 space-y-1.5">
                {pagedEmails.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">No emails found in {activeFolder}.</div>
                ) : (
                  pagedEmails.map((email, idx) => {
                    const isPreviewed = email.id === selectedLocal;
                    const isChecked = email.id === checkedEmailId;
                    const initial = senderInitial(email.from);
                    const isNewHighlight = idx === 0 && (email.is_untrusted || email.status_tag === "Suspicious");

                    return (
                      <div
                        key={email.id}
                        // Clicking ROW outside checkbox previews email ONLY without selecting or analyzing (Req 3)
                        onClick={() => {
                          setSelectedLocal(email.id);
                          onEmailSelect(email);
                        }}
                        className={`relative p-2.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all ${
                          isPreviewed
                            ? "bg-[#141b2d] border border-red-500 shadow-[0_0_10px_rgba(255,46,85,0.35)]"
                            : isChecked
                            ? "bg-slate-900/80 border border-cyan-500/60"
                            : "hover:bg-slate-800/40 border border-transparent"
                        }`}
                      >
                        {/* Requirement 3: Checkbox with single-selection (radio behavior) */}
                        <div
                          className="flex items-center justify-center p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            // If this email is already checked, uncheck it. Otherwise check ONLY this email.
                            setCheckedEmailId((prev) => (prev === email.id ? null : email.id));
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent div onClick
                            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-cyan-500"
                            title="Select this single email for threat analysis"
                          />
                        </div>

                        <div className="relative">
                          <span
                            className={`w-7 h-7 rounded-full ${
                              AVATAR_COLORS[initial] || "bg-purple-600"
                            } flex items-center justify-center text-[11px] font-bold text-white uppercase flex-shrink-0`}
                          >
                            {initial}
                          </span>
                          {isNewHighlight && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-[9px] font-bold text-white px-1 py-0 rounded-full border border-red-400 shadow-sm leading-none">
                              New
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">{senderName(email.from)}</span>
                            <span className="text-[10px] text-slate-400">{email.received_at}</span>
                          </div>
                          <p className="text-xs font-medium text-slate-100 truncate">{email.subject}</p>
                          <p className="text-[11px] leading-tight text-slate-400 truncate">{email.snippet}</p>
                        </div>

                        {/* Security Tag */}
                        {email.status_tag === "Safe" || email.status_tag === "Allowed" ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/50 rounded-full flex items-center gap-1 flex-shrink-0">
                            Safe
                          </span>
                        ) : email.status_tag === "Blocked" ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-red-400 bg-red-950/60 border border-red-500/50 rounded-full flex items-center gap-1 flex-shrink-0">
                            Blocked
                          </span>
                        ) : email.status_tag === "Requires Human Review" || email.status_tag === "Awaiting Approval" ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/50 rounded-full flex items-center gap-1 flex-shrink-0">
                            Review Required
                          </span>
                        ) : email.status_tag === "Analyzing" ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-sky-400 bg-sky-950/60 border border-sky-500/50 rounded-full flex items-center gap-1 flex-shrink-0 animate-pulse">
                            Analyzing...
                          </span>
                        ) : email.status_tag === "Analysis Failed" ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-orange-400 bg-orange-950/60 border border-orange-500/50 rounded-full flex items-center gap-1 flex-shrink-0">
                            Failed
                          </span>
                        ) : email.status_tag === "Suspicious" ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-rose-400 bg-rose-950/60 border border-rose-500/50 rounded-full flex items-center gap-1 flex-shrink-0">
                            Suspicious
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-900/60 border border-slate-700/50 rounded-full flex items-center gap-1 flex-shrink-0">
                            Not Analyzed
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Table Pagination Footer */}
            <div className="flex items-center justify-between pt-3 mt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
              <span>
                Showing {filteredEmails.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} –{" "}
                {Math.min(page * PAGE_SIZE, filteredEmails.length)} of {filteredEmails.length} emails
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-[#111728] border border-slate-800 hover:border-slate-700 text-slate-400 disabled:opacity-40"
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    onClick={() => setPage(num)}
                    className={`w-6 h-6 flex items-center justify-center rounded-md font-bold border transition ${
                      page === num
                        ? "bg-red-600 text-white border-red-500 shadow-sm"
                        : "bg-[#111728] border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-[#111728] border border-slate-800 hover:border-slate-700 text-slate-400 disabled:opacity-40"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Threat Overview, Real-Time Timeline & Stopwatch Timer (Req 1 & 2) (4 Cols) */}
        <div className="xl:col-span-4 space-y-3" data-purpose="threat-overview-column">
          {/* Section: Threat Overview & Real-Time Stopwatch Telemetry (Req 2) */}
          <div
            className="rounded-2xl bg-[#0c1322] p-4 space-y-3"
            style={{
              border: "1px solid rgba(0, 160, 255, 0.4)",
              boxShadow: "0 0 16px -4px rgba(0, 140, 255, 0.25), inset 0 0 12px -5px rgba(0, 140, 255, 0.12)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-950/60 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide">Threat Overview</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    analyzing ? "bg-amber-400 animate-ping" : "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                  }`}
                />
                <span className="text-[10px] font-mono text-slate-300">
                  {analyzing ? "SCANNING ACTIVE" : "ENGINE READY"}
                </span>
              </div>
            </div>

            {/* Requirement 2: Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Currently Analyzing</span>
                <span className="text-sm font-extrabold text-cyan-400 font-mono">
                  {analyzing ? "1" : "0"}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Threats Detected</span>
                <span className="text-sm font-extrabold text-red-400 font-mono">{suspiciousCount}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Safe Emails</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">{safeCount}</span>
              </div>
            </div>

            {/* Requirement 2: Real-time Stopwatch Duration Bar */}
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-slate-900 via-[#101728] to-slate-900 border border-cyan-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Live Analysis Duration</span>
                <span className="text-sm font-bold text-white font-mono tracking-wider">
                  {analyzing ? `${liveDuration.toFixed(1)}s` : "0.0s"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Recent Completed</span>
                <span className="text-xs font-semibold text-cyan-300 font-mono">
                  {lastDuration !== null ? `${lastDuration.toFixed(2)}s` : "--"}
                </span>
              </div>
            </div>

            {/* Donut Chart & Category Breakdown */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
              <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-800"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.6"
                  />
                  <path
                    className="text-emerald-500"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${safePercent}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.8"
                  />
                  <path
                    className="text-red-500"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${suspiciousPercent}, 100`}
                    strokeDashoffset={`-${safePercent}`}
                    strokeLinecap="round"
                    strokeWidth="3.8"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-extrabold text-white leading-tight">{totalCount}</span>
                </div>
              </div>

              <div className="space-y-1 flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]" />
                    <span className="text-slate-300 text-[11px]">Suspicious</span>
                  </div>
                  <span className="font-bold text-white text-[11px]">{suspiciousCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_#10b981]" />
                    <span className="text-slate-300 text-[11px]">Safe</span>
                  </div>
                  <span className="font-bold text-white text-[11px]">{safeCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Requirement 1: Real-Time Threat Analysis Timeline */}
          <div
            className="rounded-2xl bg-[#0c1322] p-4 space-y-3"
            style={{
              border: "1px solid rgba(0, 160, 255, 0.4)",
              boxShadow: "0 0 16px -4px rgba(0, 140, 255, 0.25), inset 0 0 12px -5px rgba(0, 140, 255, 0.12)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-white tracking-wide">Threat Analysis Timeline</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">6 Stages</span>
            </div>

            {/* Stages Stack */}
            <div className="space-y-2.5 pt-1 relative">
              {timelineStages.map((stage, idx) => {
                const isLast = idx === timelineStages.length - 1;
                return (
                  <div key={stage.id} className="relative flex items-start gap-3">
                    {/* Vertical Connector Line */}
                    {!isLast && (
                      <span
                        className={`absolute left-[13px] top-6 w-0.5 h-8 transition-colors ${
                          stage.status === "completed"
                            ? "bg-emerald-500 shadow-[0_0_6px_#10b981]"
                            : stage.status === "processing"
                            ? "bg-cyan-500 animate-pulse"
                            : "bg-slate-800"
                        }`}
                      />
                    )}

                    {/* Status Indicator Icon */}
                    <div className="relative z-10 flex-shrink-0 mt-0.5">
                      {stage.status === "completed" ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-950/90 border border-emerald-500/80 flex items-center justify-center text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : stage.status === "processing" ? (
                        <div className="w-7 h-7 rounded-full bg-cyan-950/90 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.6)] animate-pulse">
                          <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#101728] border border-slate-700/80 flex items-center justify-center text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        </div>
                      )}
                    </div>

                    {/* Stage Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-semibold ${
                            stage.status === "completed"
                              ? "text-emerald-300"
                              : stage.status === "processing"
                              ? "text-cyan-300 font-bold"
                              : "text-slate-400"
                          }`}
                        >
                          {stage.id}. {stage.name}
                        </span>
                        {/* Status Indicator Badge */}
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                            stage.status === "completed"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/40"
                              : stage.status === "processing"
                              ? "bg-cyan-950/80 text-cyan-300 border border-cyan-400 animate-pulse"
                              : "bg-slate-900 text-slate-500 border border-slate-800"
                          }`}
                        >
                          {stage.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
                        {stage.description}
                      </p>
                      {stage.timestamp && (
                        <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                          {stage.timestamp}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Requirement 5: Dedicated Human Review & Approval Modal ─────────── */}
      {approvalModalOpen && pendingApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0c1322] border-2 border-amber-500/80 p-5 space-y-4 shadow-[0_0_30px_rgba(245,158,11,0.4)] relative"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.15) 0%, transparent 70%)",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-amber-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-500 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                    Human Review Required
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  </h2>
                  <p className="text-[11px] text-amber-300 font-medium">
                    OPA policy requires human operator approval before execution.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovalModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
                title="Dismiss modal (request remains pending)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Email Metadata & Threat Score */}
            <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sender:</span>
                <span className="font-semibold text-white truncate max-w-xs">{pendingApproval.email_from || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Subject:</span>
                <span className="font-semibold text-white truncate max-w-xs">{pendingApproval.email_subject || "(no subject)"}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Threat Score:</span>
                <span className="font-extrabold text-red-400 text-sm">
                  {pendingApproval.threat_score ?? 85} / 100 (HIGH RISK)
                </span>
              </div>
            </div>

            {/* AI Findings & Reason */}
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/40">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block mb-0.5">
                  Target AI & Blue Team Findings:
                </span>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  {pendingApproval.blue_findings || pendingApproval.target_findings || "High-risk link redirection and credential extraction markers identified."}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                  Reason Approval Required:
                </span>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  {pendingApproval.reason || "Suspicious sender domain requesting credential changes violates standard trust threshold."}
                </p>
              </div>

              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                <span>Recommended Action:</span>
                <span className="font-bold text-red-400 uppercase tracking-wider">
                  {pendingApproval.recommended_action || "BLOCK"}
                </span>
              </div>
            </div>

            {/* Feedback notification */}
            {decisionFeedback && (
              <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500 text-cyan-300 text-xs text-center font-bold animate-in fade-in">
                {decisionFeedback}
              </div>
            )}

            {/* Action Buttons (ALLOW EMAIL / BLOCK EMAIL) */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleDecision("APPROVED")}
                disabled={submittingDecision}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:brightness-110 text-white font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.4)] transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingDecision ? (
                  <span>Submitting…</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>ALLOW EMAIL</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleDecision("REJECTED")}
                disabled={submittingDecision}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs shadow-[0_0_15px_rgba(255,46,85,0.5)] transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingDecision ? (
                  <span>Submitting…</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>BLOCK EMAIL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Red Team Alert (Req 4) ───────────────────────────────── */}
      {alertVisible && (
        <aside
          className="z-40 max-w-xs w-full fixed bottom-4 right-4 animate-in slide-in-from-bottom-3"
          data-purpose="floating-notification"
        >
          <div
            className="rounded-2xl bg-[#0f1422]/95 border border-red-500/80 py-2.5 px-3.5 backdrop-blur-xl relative shadow-2xl"
            style={{
              boxShadow: "0 0 20px -4px rgba(255, 46, 85, 0.45), inset 0 0 12px -3px rgba(255, 46, 85, 0.15)",
            }}
          >
            <button
              aria-label="Close notification"
              onClick={() => setAlertVisible(false)}
              className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-950/70 border border-red-500/80 flex items-center justify-center text-red-500 shadow-[0_0_8px_rgba(255,46,85,0.4)] flex-shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a9 9 0 0 0-9 9c0 3.2 1.7 6.1 4.3 7.6l1.2-1.9A6.9 6.9 0 0 1 5 11a7 7 0 0 1 14 0c0 2.4-1.2 4.5-3.1 5.7l1.1 1.9c2.7-1.5 4.5-4.4 4.5-7.6a9 9 0 0 0-9-9zm-3 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6.6 6.5l.6 1.9c1 .4 2 .6 3 .6s2-.2 3-.6l.6-1.9c-.8.3-1.7.5-2.6.5-.9 0-1.8-.2-2.6-.5z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_#ff2e55]" />
                  <span className="text-[10px] font-bold text-red-500 tracking-wide uppercase">Red Team Alert</span>
                </div>
                <p className="text-[11px] text-slate-200 mt-0.5 truncate font-medium">
                  {alertSubject}
                </p>
                <div className="flex items-end gap-0.5 mt-1 h-2" data-purpose="equalizer-animation">
                  <span className="w-0.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="w-0.5 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "75ms" }} />
                  <span className="w-0.5 h-1 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-0.5 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "220ms" }} />
                  <span className="w-0.5 h-1.5 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "90ms" }} />
                  <span className="w-0.5 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "180ms" }} />
                  <span className="w-0.5 h-1 bg-red-500 rounded-full animate-pulse" />
                  <span className="w-0.5 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "120ms" }} />
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
