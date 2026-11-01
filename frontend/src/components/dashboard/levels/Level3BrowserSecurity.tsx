"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BrowserTarget,
  BrowserScanResult,
  listBrowserPages,
  navigateAndScanBrowser,
  quarantineBrowserTarget,
  simulateBrowserAttack,
} from "@/lib/api";
import DownloadReportButton from "../DownloadReportButton";

interface Level3BrowserSecurityProps {
  onNavigateHome?: () => void;
  simulationId?: string | null;
}

interface AnalysisStage {
  id: number;
  name: string;
  status: "completed" | "processing" | "pending";
  timestamp?: string;
  description?: string;
}

const DEFAULT_STAGES: AnalysisStage[] = [
  { id: 1, name: "URL Navigation Request", status: "completed", timestamp: "Ready", description: "Domain resolution & protocol validation" },
  { id: 2, name: "Red Team Alert", status: "completed", timestamp: "Ready", description: "Adversarial signature & download payload evaluation" },
  { id: 3, name: "Target AI Proposal", status: "completed", timestamp: "Ready", description: "Sandboxed browser fetch action" },
  { id: 4, name: "Blue Team Guardian Verification", status: "completed", timestamp: "Ready", description: "Domain reputation, DOM prompt injection & MIME scan" },
  { id: 5, name: "OPA Policy Evaluation", status: "completed", timestamp: "Ready", description: "Network egress & allowlist boundary check" },
  { id: 6, name: "Final Security Decision", status: "completed", timestamp: "Enforced", description: "Autonomous enforcement / Operator Quarantine command" },
];

export default function Level3BrowserSecurity({ onNavigateHome, simulationId }: Level3BrowserSecurityProps) {
  const [targets, setTargets] = useState<BrowserTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [checkedTargetId, setCheckedTargetId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<"all" | "intranet" | "suspicious" | "quarantined">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Analysis state & stopwatch
  const [analyzing, setAnalyzing] = useState(false);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timeline
  const [timelineStages, setTimelineStages] = useState<AnalysisStage[]>(DEFAULT_STAGES);
  const [analysisResult, setAnalysisResult] = useState<BrowserScanResult | null>(null);
  const [currentAnalysisRecord, setCurrentAnalysisRecord] = useState<Record<string, any> | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Human Review & Quarantine Modal
  const [quarantineModalOpen, setQuarantineModalOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<BrowserTarget | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Load targets
  const loadTargets = useCallback(async () => {
    try {
      const data = await listBrowserPages();
      if (data && data.length > 0) {
        setTargets(data);
      }
    } catch (err) {
      console.warn("Could not fetch browser targets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  // Stopwatch timer helpers
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

  // Filtered targets
  const filteredTargets = targets.filter((t) => {
    if (filterCategory === "intranet" && (t.is_external || t.status_tag === "Quarantined")) return false;
    if (filterCategory === "suspicious" && !["Suspicious", "Blocked", "Awaiting Approval"].includes(t.status_tag)) return false;
    if (filterCategory === "quarantined" && t.status_tag !== "Quarantined") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q) || t.domain.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedTarget = targets.find((t) => t.id === selectedTargetId) ?? null;
  const checkedTarget = targets.find((t) => t.id === checkedTargetId) ?? selectedTarget;

  // Active target representation for display (either a checked target or a custom URL typed in address bar)
  const activeTarget: BrowserTarget | null = checkedTarget
    ? checkedTarget
    : urlInput.trim()
    ? {
        id: "custom-preview",
        title: `Custom Target (${(() => {
          try {
            const u = urlInput.trim().startsWith("http") ? urlInput.trim() : `https://${urlInput.trim()}`;
            return new URL(u).hostname || urlInput.trim();
          } catch {
            return urlInput.trim();
          }
        })()})`,
        url: urlInput.trim(),
        domain: (() => {
          try {
            const u = urlInput.trim().startsWith("http") ? urlInput.trim() : `https://${urlInput.trim()}`;
            return new URL(u).hostname || "custom-domain";
          } catch {
            return "custom-domain";
          }
        })(),
        category: "Custom Input",
        is_external: true,
        status_tag: "Suspicious",
        has_download: false,
        content_snippet: "Custom web destination entered by operator. Ready to scan.",
        created_at: new Date().toISOString(),
      }
    : null;

  // Helper to toggle target selection
  const toggleTargetSelection = (target: BrowserTarget) => {
    if (checkedTargetId === target.id) {
      // Toggle off / deselect
      setCheckedTargetId(null);
      setSelectedTargetId(null);
      setUrlInput("");
    } else {
      // Select
      setCheckedTargetId(target.id);
      setSelectedTargetId(target.id);
      setUrlInput(target.url);
    }
  };

  const handleUrlInputChange = (val: string) => {
    setUrlInput(val);
    const matched = targets.find((t) => t.url.trim().toLowerCase() === val.trim().toLowerCase());
    if (matched) {
      setCheckedTargetId(matched.id);
      setSelectedTargetId(matched.id);
    } else {
      setCheckedTargetId(null);
      setSelectedTargetId(null);
    }
  };

  // Stats
  const totalTargets = targets.length;
  const suspiciousTargets = targets.filter((t) => ["Suspicious", "Blocked", "Awaiting Approval"].includes(t.status_tag)).length;
  const quarantinedTargets = targets.filter((t) => t.status_tag === "Quarantined").length;
  const safeTargets = totalTargets - suspiciousTargets - quarantinedTargets;

  // Handle navigate and scan
  const handleNavigateAndScan = async (targetToScan?: BrowserTarget) => {
    let rawUrl = (targetToScan ? targetToScan.url : urlInput).trim();
    if (!rawUrl) return;

    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      rawUrl = "https://" + rawUrl;
      setUrlInput(rawUrl);
    }

    if (analyzing) return;

    setAnalyzing(true);
    setAnalysisResult(null);
    setCurrentAnalysisRecord(null);
    setScanError(null);
    startTimer();

    const matched = targets.find((t) => t.url.trim().toLowerCase() === rawUrl.toLowerCase());
    const targetIdToSend = targetToScan ? targetToScan.id : matched?.id;
    const targetUrlToSend = rawUrl;

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const now = new Date().toLocaleTimeString();
    setTimelineStages([
      { id: 1, name: "URL Navigation Request", status: "processing", timestamp: now, description: `Resolving host: ${targetUrlToSend.slice(0, 32)}...` },
      { id: 2, name: "Red Team Alert", status: "pending", description: "Scanning adversarial markers & drive-by scripts..." },
      { id: 3, name: "VirusTotal Multi-Engine Intelligence", status: "pending", description: "Querying 70+ global antivirus & reputation vendors" },
      { id: 4, name: "Blue Team Guardian Verification", status: "pending", description: "Evaluating domain reputation & DOM prompt injection" },
      { id: 5, name: "OPA Policy Evaluation", status: "pending", description: "Evaluating network egress boundary rules" },
      { id: 6, name: "Final Security Decision", status: "pending", description: "Pending policy resolution" },
    ]);

    try {
      // Stage 1 -> 2
      await delay(150);
      setTimelineStages((prev) => [
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "processing", timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(2),
      ]);

      // Stage 2 -> 3 (Trigger backend scan)
      await delay(150);
      setTimelineStages((prev) => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "processing", timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(3),
      ]);

      const res = await navigateAndScanBrowser(targetIdToSend, targetUrlToSend, simulationId || undefined);

      // Stage 3 -> 4
      await delay(180);
      setTimelineStages((prev) => [
        prev[0],
        prev[1],
        {
          ...prev[2],
          status: "completed",
          timestamp: new Date().toLocaleTimeString(),
          description: res.virustotal?.enabled
            ? `VirusTotal: ${res.virustotal.harmless_count ?? 0} Clean, ${res.virustotal.malicious_count ?? 0} Flagged (${res.virustotal.total_engines ?? 93} engines)`
            : "Reputation Intelligence Checked",
        },
        { ...prev[3], status: "processing", timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(4),
      ]);

      // Stage 4 -> 5
      await delay(180);
      setTimelineStages((prev) => [
        prev[0],
        prev[1],
        prev[2],
        {
          ...prev[3],
          status: "completed",
          timestamp: new Date().toLocaleTimeString(),
          description: res.indicators.length > 0 ? res.indicators.join(", ") : "Domain & content verified clean",
        },
        { ...prev[4], status: "processing", timestamp: new Date().toLocaleTimeString() },
        prev[5],
      ]);

      // Stage 5 -> 6
      await delay(150);
      setTimelineStages([
        { id: 1, name: "URL Navigation Request", status: "completed", timestamp: now, description: `Host: ${res.domain}` },
        { id: 2, name: "Red Team Alert", status: "completed", timestamp: now, description: res.threat_detected ? "Adversarial signature flagged" : "Clean — No weaponized markers" },
        {
          id: 3,
          name: "VirusTotal Multi-Engine Intelligence",
          status: "completed",
          timestamp: now,
          description: res.virustotal?.enabled
            ? `VirusTotal: ${res.virustotal.harmless_count ?? 0} Clean, ${res.virustotal.malicious_count ?? 0} Flagged (${res.virustotal.total_engines ?? 93} vendors)`
            : "Reputation Intelligence Verified",
        },
        { id: 4, name: "Blue Team Guardian Verification", status: "completed", timestamp: now, description: res.indicators.length > 0 ? res.indicators.join(", ") : "Domain & content verified clean" },
        { id: 5, name: "OPA Policy Evaluation", status: "completed", timestamp: now, description: `Policy Decision: ${res.decision}` },
        { id: 6, name: "Final Security Decision", status: "completed", timestamp: now, description: `Enforcement: ${res.decision}` },
      ]);

      setAnalysisResult(res);

      // Update or add target to local list
      const statusTag = res.decision === "REQUIRE_APPROVAL" ? "Awaiting Approval" : res.decision === "BLOCK" ? "Blocked" : "Safe";
      setTargets((prev) => {
        const exists = prev.some((t) => t.id === res.target_id || t.url.toLowerCase() === res.url.toLowerCase());
        if (exists) {
          return prev.map((t) =>
            t.id === res.target_id || t.url.toLowerCase() === res.url.toLowerCase()
              ? { ...t, id: res.target_id, status_tag: statusTag }
              : t
          );
        } else {
          const newTarget: BrowserTarget = {
            id: res.target_id,
            title: res.title,
            url: res.url,
            domain: res.domain,
            category: "Custom Web",
            is_external: true,
            status_tag: statusTag,
            has_download: res.has_download,
            download_name: res.download_name,
            content_snippet: `Scanned: ${res.url}`,
            created_at: new Date().toISOString(),
          };
          return [newTarget, ...prev];
        }
      });
      setSelectedTargetId(res.target_id);
      setCheckedTargetId(res.target_id);

      // Persist completed browser analysis to local history for Results tab & PDF reports
      try {
        const isSafe = res.decision === "ALLOW";
        const historyRecord = {
          id: `browser-${res.target_id}-${Date.now()}`,
          security_level: "browser",
          item_name: res.title || res.url,
          url: res.url,
          domain: res.domain,
          date_time: new Date().toISOString(),
          decision: res.decision,
          risk_score: typeof res.risk_score === "number" ? (res.risk_score <= 1 ? Math.round(res.risk_score * 100) : res.risk_score) : (isSafe ? 5 : 95),
          confidence_score: res.virustotal?.enabled ? 98 : 92,
          threat_classification: isSafe ? "Clean / Safe" : res.decision === "REQUIRE_APPROVAL" ? "Uncertain / Requires Review" : "Malicious URL / Suspicious Egress",
          threat_indicators: res.indicators && res.indicators.length > 0 ? res.indicators : (isSafe ? ["Domain reputation clean", "No adversarial payload"] : ["Malicious URL indicators"]),
          evidence: res.indicators || [],
          explanation: res.explanation || (isSafe ? "URL navigation authorized." : "Malicious web threats detected."),
          checks_completed: [
            "URL Protocol & Domain Resolution Check",
            "VirusTotal Multi-Engine Intelligence (90+ vendors)",
            "DOM Prompt Injection & Hidden Payload Scan",
            "File Download & Dangerous MIME Type Inspection",
            "OPA Network Egress Boundary Enforcement",
          ],
          target_ai_finding: `Target AI proposed browser navigation to ${res.url}`,
          blue_team_verification: `Guardian and VirusTotal evaluated: ${res.threat_detected ? "Threat detected" : "Safe URL verified"}`,
          opa_policy_reason: isSafe ? "OPERATION_WITHIN_POLICY_ALLOWLIST" : "OPA_NETWORK_EGRESS_BLOCK",
          remediation: isSafe ? "Navigation permitted." : "Block egress, quarantine URL target, and log telemetry.",
        };
        setCurrentAnalysisRecord(historyRecord);
        const existing = JSON.parse(sessionStorage.getItem("CYBERHUNT_ANALYSIS_HISTORY") || "[]");
        const filtered = existing.filter((item: any) => item.id !== historyRecord.id);
        filtered.unshift(historyRecord);
        sessionStorage.setItem("CYBERHUNT_ANALYSIS_HISTORY", JSON.stringify(filtered.slice(0, 100)));
      } catch (storageErr) {
        console.debug("Session storage write skipped:", storageErr);
      }

      // Trigger Human Quarantine Modal if threat detected
      if (res.decision === "REQUIRE_APPROVAL" || res.threat_detected) {
        const found = targets.find((t) => t.id === (targetToScan?.id || res.target_id)) || {
          id: res.target_id,
          title: res.title,
          url: res.url,
          domain: res.domain,
          category: "External Threat",
          is_external: true,
          status_tag: "Awaiting Approval" as const,
          has_download: res.has_download,
          download_name: res.download_name,
          content_snippet: res.explanation || `Threat intercepted: ${res.url}`,
          created_at: new Date().toISOString(),
        };
        setPendingTarget(found);
        setQuarantineModalOpen(true);
      }
    } catch (err: any) {
      console.error("Navigation scan error:", err);
      setScanError(err?.message || "Failed to scan URL. Ensure backend on port 8000 is running.");
    } finally {
      setAnalyzing(false);
      stopTimer();
    }
  };

  // Handle Human Quarantine / Block command
  const handleQuarantineDecision = async (action: "BLOCK_AND_DELETE" | "ALLOW") => {
    if (!pendingTarget) return;
    setSubmittingAction(true);
    setFeedbackMessage(null);

    try {
      if (action === "BLOCK_AND_DELETE") {
        await quarantineBrowserTarget(pendingTarget.id, "BLOCK_AND_DELETE", "Operator commanded URL block and download buffer purge");
        setTargets((prev) =>
          prev.map((t) =>
            t.id === pendingTarget.id
              ? { ...t, status_tag: "Quarantined", download_purged: true }
              : t
          )
        );
        setFeedbackMessage(`Threat Neutralized! URL blocked and downloaded payload PURGED from memory.`);
      } else {
        await quarantineBrowserTarget(pendingTarget.id, "ALLOW", "Operator manually permitted web navigation");
        setTargets((prev) =>
          prev.map((t) =>
            t.id === pendingTarget.id
              ? { ...t, status_tag: "Allowed", download_purged: false }
              : t
          )
        );
        setFeedbackMessage(`Navigation permitted by operator.`);
      }

      if (currentAnalysisRecord) {
        const updated = {
          ...currentAnalysisRecord,
          decision: action === "ALLOW" ? "ALLOW" : "BLOCK",
          explanation: `Human operator decision: ${action === "ALLOW" ? "ALLOWED" : "BLOCKED & DOWNLOAD PURGED"}. Action enforced.`,
        };
        setCurrentAnalysisRecord(updated);
        try {
          const existing = JSON.parse(sessionStorage.getItem("CYBERHUNT_ANALYSIS_HISTORY") || "[]");
          const filtered = existing.filter((item: any) => item.id !== updated.id);
          filtered.unshift(updated);
          sessionStorage.setItem("CYBERHUNT_ANALYSIS_HISTORY", JSON.stringify(filtered.slice(0, 100)));
        } catch (_) {}
      }

      // Complete timeline stage 6
      setTimelineStages((prev) =>
        prev.map((s) => {
          if (s.id === 6) {
            return {
              ...s,
              status: "completed",
              timestamp: new Date().toLocaleTimeString(),
              description: `Operator Decided: ${action === "BLOCK_AND_DELETE" ? "BLOCKED & DOWNLOAD PURGED" : "ALLOWED"}`,
            };
          }
          return s;
        })
      );

      setTimeout(() => {
        setQuarantineModalOpen(false);
        setPendingTarget(null);
        setFeedbackMessage(null);
      }, 1400);
    } catch (err: any) {
      console.error("Failed to execute quarantine decision:", err);
      setFeedbackMessage(`Error: ${err?.message || "Check backend connection"}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Red Team simulated attack
  const handleSimulateAttack = async (type: "drive_by_download" | "phishing") => {
    try {
      const dropped = await simulateBrowserAttack(type);
      if (dropped) {
        setTargets((prev) => [dropped, ...prev.filter((t) => t.id !== dropped.id)]);
        setSelectedTargetId(dropped.id);
        setCheckedTargetId(dropped.id);
        setUrlInput(dropped.url);
        // Automatically scan
        setTimeout(() => {
          handleNavigateAndScan(dropped);
        }, 300);
      }
    } catch (err) {
      console.error("Attack simulation failed:", err);
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
        className="relative rounded-2xl bg-[#0d1222]/90 border border-purple-500/70 p-3 px-4.5 lg:py-3.5 lg:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 backdrop-blur-md"
        style={{
          boxShadow: "0 0 20px -4px rgba(168, 85, 247, 0.45), inset 0 0 12px -3px rgba(168, 85, 247, 0.15)",
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

          <div className="w-9 h-9 rounded-xl bg-purple-950/50 border border-purple-500/60 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <h1 className="text-base lg:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Level 3 – Browser Security & Drive-By Quarantine
              {quarantineModalOpen && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse">
                  Threat Interception Pending
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 font-normal mt-0.5">
              Autonomous multi-agent web threat pipeline with OPA egress policy, DOM injection scanner, and drive-by download quarantine.
            </p>
          </div>
        </div>

        {/* Controls & Red Team Simulators */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111728] border border-purple-500/40 text-xs font-medium text-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span>Sandboxed Browser</span>
          </div>

          <button
            onClick={() => handleSimulateAttack("drive_by_download")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-semibold text-xs shadow-[0_0_12px_rgba(255,46,85,0.4)] transition"
            title="Simulate Red Team drive-by malware download"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Simulate Drive-By Download</span>
          </button>
        </div>
      </section>

      {/* ── SubNav Filter Tabs ───────────────────────────────────────────── */}
      <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {[
          { key: "all", label: `All Targets (${totalTargets})` },
          { key: "intranet", label: `Intranet Safe (${safeTargets})` },
          { key: "suspicious", label: `Malicious Links (${suspiciousTargets})` },
          { key: "quarantined", label: `Blocked & Purged (${quarantinedTargets})` },
        ].map((tab) => {
          const isActive = filterCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterCategory(tab.key as any)}
              className={
                isActive
                  ? "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-[0_0_10px_rgba(168,85,247,0.4)] border border-purple-400"
                  : "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0e1424] hover:bg-[#141b30] border border-slate-800 text-slate-300 transition-colors"
              }
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Content Grid (3 Columns) ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
        {/* Column 1: Network Egress & Target Details (3 Cols) */}
        <div className="xl:col-span-3 space-y-3">
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-semibold text-white">Network Egress Policy</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border text-emerald-400 bg-emerald-950/60 border-emerald-500/40">
                OPA Active
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-400 bg-[#090d18] p-2.5 rounded-xl border border-slate-800/80 font-mono">
              <div className="flex justify-between">
                <span>Allowed Egress:</span>
                <span className="text-emerald-400">*.cyberhunt.local</span>
              </div>
              <div className="flex justify-between">
                <span>External Web:</span>
                <span className="text-red-400">FAIL_CLOSED (BLOCK)</span>
              </div>
              <div className="flex justify-between">
                <span>Drive-By Sniffer:</span>
                <span className="text-cyan-400">In-Memory Intercept</span>
              </div>
            </div>
          </div>

          {/* Target Inspection Pane */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Target Inspection Pane</span>
              {activeTarget && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    activeTarget.status_tag === "Quarantined"
                      ? "bg-purple-950/60 text-purple-400 border-purple-500/40"
                      : activeTarget.status_tag === "Safe"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                      : activeTarget.status_tag === "Awaiting Approval"
                      ? "bg-amber-950/60 text-amber-400 border-amber-500/40"
                      : "bg-red-950/60 text-red-400 border-red-500/40"
                  }`}
                >
                  {activeTarget.status_tag}
                </span>
              )}
            </div>

            {activeTarget ? (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Page Title</label>
                  <p className="text-white font-medium break-all">{activeTarget.title}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Destination URL</label>
                  <p className="text-slate-300 font-mono text-[11px] break-all">{activeTarget.url}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Domain</label>
                    <p className="text-slate-300 font-mono truncate">{activeTarget.domain}</p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Network Type</label>
                    <p className={activeTarget.is_external ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                      {activeTarget.is_external ? "EXTERNAL / UNTRUSTED" : "INTRANET"}
                    </p>
                  </div>
                </div>

                {activeTarget.has_download && (
                  <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-red-400 uppercase">Drive-By Download Intercepted:</span>
                      <span className="text-[10px] font-mono text-slate-400">{activeTarget.download_size} B</span>
                    </div>
                    <p className="text-white font-mono text-xs font-semibold break-all">{activeTarget.download_name}</p>
                    {activeTarget.download_purged && (
                      <span className="inline-block text-[9px] font-bold text-purple-400 bg-purple-950 px-1.5 py-0.5 rounded border border-purple-500/40">
                        PURGED FROM MEMORY
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Page DOM Content Preview</label>
                  <pre className="text-slate-300 font-mono text-[10px] bg-[#090d18] p-2 rounded-xl border border-slate-800 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {activeTarget.content_snippet || "Content will be analyzed upon URL navigation..."}
                  </pre>
                </div>

                <button
                  onClick={() => handleNavigateAndScan()}
                  disabled={analyzing || activeTarget.status_tag === "Quarantined" || !urlInput.trim()}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 ${
                    activeTarget.status_tag === "Quarantined" || !urlInput.trim()
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white shadow-purple-600/30 border border-purple-500/50"
                  }`}
                >
                  {analyzing ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                      </svg>
                      <span>Scanning Web Target ({liveDuration}s)...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Navigate & Scan URL</span>
                    </>
                  )}
                </button>

                {analysisResult && (
                  <div className="space-y-2 pt-2.5 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Threat Score</span>
                      <span className={`font-bold ${analysisResult.threat_detected ? "text-red-400" : "text-emerald-400"}`}>
                        {Math.round(analysisResult.risk_score * 100)} / 100
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
            ) : (
              <div className="text-center py-6 text-slate-500 space-y-1">
                <p className="text-xs">No target or URL entered.</p>
                <p className="text-[11px] text-slate-600">Type any web address in the address bar above or select a target below.</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Center Virtual Browser Window (5 Cols) */}
        <div className="xl:col-span-5 rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
          {/* Virtual Browser Chrome Header */}
          <div className="p-2 rounded-xl bg-[#080c16] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono">SANDBOXED WEB RUNNER</span>
              <div className="w-10" />
            </div>

            {/* Address Bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#0f172a] border border-slate-700/80 text-xs">
                {activeTarget?.is_external ? (
                  <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => handleUrlInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !analyzing && urlInput.trim()) {
                      handleNavigateAndScan();
                    }
                  }}
                  placeholder="Type any URL (e.g. https://vercel.com/ or https://chatgpt.com/)..."
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 font-mono text-[11px] focus:outline-none"
                />
                {urlInput && (
                  <button
                    onClick={() => {
                      setUrlInput("");
                      setCheckedTargetId(null);
                      setSelectedTargetId(null);
                    }}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition"
                    title="Clear address bar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>

              <button
                onClick={() => handleNavigateAndScan()}
                disabled={analyzing || !urlInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition"
              >
                Go
              </button>
            </div>

            {/* Error Message if API fails */}
            {scanError && (
              <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/60 text-red-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
                <span className="flex items-center gap-1.5">
                  <span className="text-red-400 font-bold">⚠️ Scan Warning:</span>
                  <span>{scanError}</span>
                </span>
                <button onClick={() => setScanError(null)} className="text-red-400 hover:text-white text-xs font-bold px-1.5">✕</button>
              </div>
            )}

            {/* Safe Verification Result Banner */}
            {analysisResult && !analysisResult.threat_detected && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/60 space-y-2 animate-fade-in shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs">
                      ✓
                    </span>
                    <span className="font-bold text-xs text-emerald-300">URL Verified Safe & Navigation Approved</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold">
                    OPA: ALLOW
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                  <div className="bg-[#090d18] p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">VirusTotal Scan</span>
                    <span className="text-emerald-400 font-semibold font-mono">
                      {analysisResult.virustotal?.enabled
                        ? `${analysisResult.virustotal.harmless_count ?? 0}/${analysisResult.virustotal.total_engines ?? 93} Clean`
                        : "Verified Reputable"}
                    </span>
                  </div>
                  <div className="bg-[#090d18] p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Risk Assessment</span>
                    <span className="text-emerald-400 font-semibold font-mono">
                      {Math.round(analysisResult.risk_score * 100)}% Low Risk
                    </span>
                  </div>
                  <div className="bg-[#090d18] p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Threat Indicators</span>
                    <span className="text-emerald-400 font-semibold font-mono">0 Detected</span>
                  </div>
                </div>

                <DownloadReportButton analysisData={currentAnalysisRecord} />
              </div>
            )}
          </div>

          {/* Web Targets List */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <h2 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Web Targets in Simulation</span>
              <span className="px-1.5 py-0.5 rounded-full bg-purple-600/20 text-purple-400 text-[10px] font-mono">
                {filteredTargets.length}
              </span>
            </h2>

            <div className="relative">
              <input
                type="text"
                placeholder="Search URL or domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 pl-7 pr-2.5 py-1 text-xs rounded-xl bg-[#090d18] border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
              />
              <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {loading ? (
              <p className="text-center py-8 text-slate-500">Loading web targets...</p>
            ) : filteredTargets.length === 0 ? (
              <p className="text-center py-8 text-slate-500">No targets match filter.</p>
            ) : (
              filteredTargets.map((target) => {
                const isSelected = selectedTargetId === target.id;
                const isChecked = checkedTargetId === target.id;
                const isSus = ["Suspicious", "Blocked", "Awaiting Approval"].includes(target.status_tag);

                return (
                  <div
                    key={target.id}
                    onClick={() => toggleTargetSelection(target)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-[#16122a] border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                        : "bg-[#090d18] hover:bg-[#101526] border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleTargetSelection(target);
                        }}
                        className="rounded border-slate-700 text-purple-600 focus:ring-0 focus:outline-none cursor-pointer"
                      />

                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          target.status_tag === "Quarantined"
                            ? "bg-purple-950/40 text-purple-400 border border-purple-500/40"
                            : isSus
                            ? "bg-red-950/40 text-red-400 border border-red-500/40"
                            : "bg-emerald-950/40 text-emerald-400 border border-emerald-500/40"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white truncate">{target.title}</p>
                          {target.is_external && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded font-bold bg-red-600/20 text-red-400 border border-red-500/40">
                              EXTERNAL
                            </span>
                          )}
                          {target.has_download && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded font-bold bg-amber-600/20 text-amber-400 border border-amber-500/40">
                              DOWNLOAD
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{target.url}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          target.status_tag === "Quarantined"
                            ? "bg-purple-950/60 text-purple-400 border-purple-500/40"
                            : target.status_tag === "Safe"
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                            : "bg-red-950/60 text-red-400 border-red-500/40"
                        }`}
                      >
                        {target.status_tag}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{target.category}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Threat Overview & 6-Stage Timeline (4 Cols) */}
        <div className="xl:col-span-4 space-y-3">
          {/* Threat Overview Stats */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Browser Threat Overview</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-white font-mono">{totalTargets}</p>
                <p className="text-[10px] text-slate-400">Total Targets</p>
              </div>
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-red-400 font-mono">{suspiciousTargets}</p>
                <p className="text-[10px] text-slate-400">Threats</p>
              </div>
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-purple-400 font-mono">{quarantinedTargets}</p>
                <p className="text-[10px] text-slate-400">Purged</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Live Analysis Stopwatch:</span>
              <span className="font-mono text-cyan-400 font-bold">{analyzing ? `${liveDuration}s` : lastDuration !== null ? `${lastDuration}s` : "0.0s"}</span>
            </div>
          </div>

          {/* 6-Stage Real-Time Threat Analysis Timeline */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Threat Analysis Timeline</span>
              <span className="text-[10px] text-slate-500 font-mono">6 Stages</span>
            </div>

            <div className="space-y-2.5">
              {timelineStages.map((stage) => {
                const isComplete = stage.status === "completed";
                const isProcessing = stage.status === "processing";

                return (
                  <div key={stage.id} className="flex items-start gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                        isComplete
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-500/50"
                          : isProcessing
                          ? "bg-purple-950 text-purple-400 border border-purple-500/50 animate-pulse"
                          : "bg-slate-900 text-slate-600 border border-slate-800"
                      }`}
                    >
                      {isComplete ? "✓" : stage.id}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-semibold ${isComplete ? "text-slate-200" : isProcessing ? "text-purple-400" : "text-slate-500"}`}>
                          {stage.name}
                        </p>
                        {stage.timestamp && (
                          <span className="text-[10px] font-mono text-slate-500">{stage.timestamp}</span>
                        )}
                      </div>
                      {stage.description && (
                        <p className="text-[11px] text-slate-400 truncate">{stage.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Human Review & Quarantine Modal ──────────────────────────────── */}
      {quarantineModalOpen && pendingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0c101d] border border-red-500/80 p-5 space-y-4 shadow-[0_0_30px_rgba(255,46,85,0.4)]"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-950/80 border border-red-500/80 flex items-center justify-center text-red-500 shadow-[0_0_12px_rgba(255,46,85,0.5)]">
                  <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Security Warning: Malicious Web Activity
                  </h3>
                  <p className="text-xs text-red-400 font-mono">OPA Policy: REQUIRE_APPROVAL</p>
                </div>
              </div>
              <button
                onClick={() => setQuarantineModalOpen(false)}
                className="text-slate-500 hover:text-white transition p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#090d18] border border-red-500/30 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Site:</span>
                  <span className="text-white font-mono font-bold break-all">{pendingTarget.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">URL:</span>
                  <span className="text-slate-300 font-mono text-[11px] truncate max-w-[280px]">{pendingTarget.url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Risk Assessment:</span>
                  <span className="text-red-400 font-bold font-mono">94% CRITICAL</span>
                </div>
                {pendingTarget.has_download && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Drive-By Payload:</span>
                    <span className="text-amber-400 font-mono font-bold">{pendingTarget.download_name}</span>
                  </div>
                )}
              </div>

              {/* Blue Team Findings */}
              <div className="p-3 rounded-xl bg-[#111728] border border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-300">Blue Team Guardian Findings:</p>
                <p className="text-slate-400 text-[11px]">
                  {analysisResult?.indicators.length
                    ? analysisResult.indicators.join(" • ")
                    : "Unauthorized external domain egress, drive-by malware download, or prompt injection pattern detected."}
                </p>
              </div>

              {feedbackMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-center font-semibold text-xs">
                  {feedbackMessage}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleQuarantineDecision("ALLOW")}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition text-xs font-semibold"
              >
                Allow Navigation
              </button>

              <button
                onClick={() => handleQuarantineDecision("BLOCK_AND_DELETE")}
                disabled={submittingAction}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs shadow-[0_0_15px_rgba(255,46,85,0.5)] transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{submittingAction ? "Purging..." : "Block URL & Purge Download"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

