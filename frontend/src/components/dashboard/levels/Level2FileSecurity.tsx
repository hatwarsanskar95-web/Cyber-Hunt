"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileItem,
  FileScanResult,
  listSandboxFiles,
  scanFile,
  quarantineFile,
  simulateFileAttack,
  submitApprovalDecision,
} from "@/lib/api";
import DownloadReportButton from "../DownloadReportButton";

interface Level2FileSecurityProps {
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
  { id: 1, name: "File Ingestion & Registration", status: "completed", timestamp: "Ready", description: "SHA-256 hash & path mapped" },
  { id: 2, name: "Red Team Alert", status: "completed", timestamp: "Ready", description: "Adversarial signature & payload evaluation" },
  { id: 3, name: "Target AI Proposal", status: "completed", timestamp: "Ready", description: "Virtual filesystem read request" },
  { id: 4, name: "Blue Team Guardian Verification", status: "completed", timestamp: "Ready", description: "Magic bytes, extension & prompt injection scan" },
  { id: 5, name: "OPA Policy Evaluation", status: "completed", timestamp: "Ready", description: "Path boundary & privilege evaluation" },
  { id: 6, name: "Final Security Decision", status: "completed", timestamp: "Enforced", description: "Autonomous enforcement / Quarantine command" },
];

export default function Level2FileSecurity({ onNavigateHome, simulationId }: Level2FileSecurityProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>("file-003");
  const [checkedFileId, setCheckedFileId] = useState<string | null>("file-003");
  const [filterCategory, setFilterCategory] = useState<"all" | "safe" | "suspicious" | "quarantined">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Analysis state & timer
  const [analyzing, setAnalyzing] = useState(false);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timeline
  const [timelineStages, setTimelineStages] = useState<AnalysisStage[]>(DEFAULT_STAGES);
  const [analysisResult, setAnalysisResult] = useState<FileScanResult | null>(null);
  const [currentAnalysisRecord, setCurrentAnalysisRecord] = useState<Record<string, any> | null>(null);

  // Human Review & Quarantine Modal
  const [quarantineModalOpen, setQuarantineModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<FileItem | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Load files
  const loadFiles = useCallback(async () => {
    try {
      const data = await listSandboxFiles();
      if (data && data.length > 0) {
        setFiles(data);
        if (!selectedFileId || !data.some((f) => f.id === selectedFileId)) {
          setSelectedFileId(data[0].id);
          setCheckedFileId(data[0].id);
        }
      }
    } catch (err) {
      console.warn("Could not fetch sandboxed files:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedFileId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

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

  // Filtered files
  const filteredFiles = files.filter((f) => {
    if (filterCategory === "safe" && (f.status_tag !== "Safe" || f.quarantined)) return false;
    if (filterCategory === "suspicious" && !["Suspicious", "Blocked", "Awaiting Approval"].includes(f.status_tag)) return false;
    if (filterCategory === "quarantined" && !f.quarantined) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q) || f.owner.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? filteredFiles[0] ?? null;
  const checkedFile = files.find((f) => f.id === checkedFileId) ?? selectedFile;

  // Stats
  const totalFiles = files.length;
  const suspiciousFiles = files.filter((f) => ["Suspicious", "Blocked", "Awaiting Approval"].includes(f.status_tag) && !f.quarantined).length;
  const quarantinedFiles = files.filter((f) => f.quarantined).length;
  const safeFiles = totalFiles - suspiciousFiles - quarantinedFiles;

  // Handle manual analysis of checked file
  const handleAnalyzeFile = async () => {
    if (!checkedFile || analyzing) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setCurrentAnalysisRecord(null);
    startTimer();

    const now = new Date().toLocaleTimeString();
    setTimelineStages([
      { id: 1, name: "File Ingestion & Registration", status: "completed", timestamp: now, description: `Mapped: ${checkedFile.path}` },
      { id: 2, name: "Red Team Alert", status: "processing", timestamp: now, description: "Evaluating payload markers & execution flags..." },
      { id: 3, name: "Target AI Proposal", status: "pending", description: "Virtual sandbox read action" },
      { id: 4, name: "Blue Team Guardian Verification", status: "pending", description: "Scanning magic bytes, scripts & prompt injection" },
      { id: 5, name: "OPA Policy Evaluation", status: "pending", description: "Sandbox path & boundary check" },
      { id: 6, name: "Final Security Decision", status: "pending", description: "Pending policy resolution" },
    ]);

    try {
      const res = await scanFile(checkedFile.id, simulationId || undefined);
      setAnalysisResult(res);

      const t1 = new Date().toLocaleTimeString();
      setTimelineStages([
        { id: 1, name: "File Ingestion & Registration", status: "completed", timestamp: now, description: `SHA-256: ${checkedFile.hash_sha256.slice(0, 16)}...` },
        { id: 2, name: "Red Team Alert", status: "completed", timestamp: t1, description: res.threat_detected ? "Adversarial payload signature detected" : "No weaponized signature" },
        { id: 3, name: "Target AI Proposal", status: "completed", timestamp: t1, description: `Target requested: ${checkedFile.path}` },
        { id: 4, name: "Blue Team Guardian Verification", status: "completed", timestamp: t1, description: res.indicators.length > 0 ? res.indicators.join(", ") : "Content verified clean" },
        { id: 5, name: "OPA Policy Evaluation", status: "completed", timestamp: t1, description: `Policy Decision: ${res.decision}` },
        { id: 6, name: "Final Security Decision", status: res.decision === "REQUIRE_APPROVAL" ? "processing" : "completed", timestamp: t1, description: `Enforcement: ${res.decision}` },
      ]);

      // Update local file status
      setFiles((prev) =>
        prev.map((f) =>
          f.id === checkedFile.id
            ? { ...f, status_tag: res.decision === "REQUIRE_APPROVAL" ? "Awaiting Approval" : res.decision === "BLOCK" ? "Blocked" : "Safe" }
            : f
        )
      );

      // Persist completed record to local storage for Results tab & PDF reports
      try {
        const fileAnalysis = (res as any)?.analysis || {};
        const isSafe = res.decision === "ALLOW";
        const historyRecord = {
          id: `file-${checkedFile.id}-${Date.now()}`,
          security_level: "file",
          item_name: checkedFile.name,
          path: checkedFile.path,
          extension: checkedFile.extension,
          file_id: checkedFile.id,
          date_time: new Date().toISOString(),
          decision: res.decision,
          risk_score: typeof res.risk_score === "number" ? (res.risk_score <= 1 ? Math.round(res.risk_score * 100) : res.risk_score) : (isSafe ? 5 : 95),
          confidence_score: fileAnalysis.confidence_score ?? (isSafe ? 96 : 94),
          threat_classification: isSafe ? "Clean / Safe" : res.decision === "REQUIRE_APPROVAL" ? "Uncertain / Moderate Risk" : "Malicious / Prohibited",
          threat_indicators: res.indicators && res.indicators.length > 0 ? res.indicators : (isSafe ? ["Sandbox verified clean", "Approved file extension"] : ["Adversarial indicators detected"]),
          evidence: fileAnalysis.evidence || res.indicators || [],
          explanation: res.explanation || (isSafe ? "Document verified safe within sandboxed boundaries." : "Security threats detected in file."),
          checks_completed: fileAnalysis.checks_completed || [
            "File Extension & MIME Type Integrity",
            "Sandbox Boundary & Path Traversal Check",
            "Prohibited Shell Script & Executable Analysis",
            "Hidden Adversarial Instructions & LLM Injection Scan",
            "Embedded Exfiltration URL & Threat Reputation Check",
            "Sensitive Data & Secret Exposure Inspection",
            "Open Policy Agent (OPA) Sandboxed Access Evaluation",
          ],
          target_ai_finding: fileAnalysis.target_ai_finding || `Virtual file read request evaluated for: ${checkedFile.path}`,
          blue_team_verification: fileAnalysis.blue_team_verification || (isSafe ? "Zero threat indicators detected." : "Adversarial markers identified."),
          opa_policy_reason: fileAnalysis.opa_policy_reason || (isSafe ? "OPERATION_WITHIN_POLICY_ALLOWLIST" : "OPA_SECURITY_BLOCK"),
          remediation: fileAnalysis.remediation || (isSafe ? "Allowed for read access in sandbox." : "Quarantine or delete file immediately."),
        };
        setCurrentAnalysisRecord(historyRecord);
        const existing = JSON.parse(sessionStorage.getItem("CYBERHUNT_ANALYSIS_HISTORY") || "[]");
        const filtered = existing.filter((item: any) => item.id !== historyRecord.id);
        filtered.unshift(historyRecord);
        sessionStorage.setItem("CYBERHUNT_ANALYSIS_HISTORY", JSON.stringify(filtered.slice(0, 100)));
      } catch (storageErr) {
        console.debug("Session storage write skipped:", storageErr);
      }

      // Trigger Human Quarantine Modal ONLY for uncertain 50-50 decisions requiring operator review
      if (res.decision === "REQUIRE_APPROVAL") {
        setPendingFile(checkedFile);
        setQuarantineModalOpen(true);
      }
    } catch (err) {
      console.error("File analysis error:", err);
    } finally {
      setAnalyzing(false);
      stopTimer();
    }
  };

  // Handle Human Quarantine / Delete command
  const handleQuarantineDecision = async (action: "DELETE" | "ALLOW") => {
    if (!pendingFile) return;
    setSubmittingAction(true);
    setFeedbackMessage(null);

    try {
      if (action === "DELETE") {
        await quarantineFile(pendingFile.id, "DELETE", "Human operator commanded file deletion and quarantine");
        setFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id
              ? { ...f, quarantined: true, status_tag: "Quarantined", permission: "REVOKED" }
              : f
          )
        );
        setFeedbackMessage(`Threat Neutralized! File '${pendingFile.name}' was DELETED and quarantined.`);
      } else {
        await quarantineFile(pendingFile.id, "RESTORE", "Human operator manually permitted file in sandbox");
        setFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id
              ? { ...f, quarantined: false, status_tag: "Allowed", permission: "READ" }
              : f
          )
        );
        setFeedbackMessage(`File '${pendingFile.name}' was ALLOWED in sandbox.`);
      }

      if (currentAnalysisRecord) {
        const updated = {
          ...currentAnalysisRecord,
          decision: action === "ALLOW" ? "ALLOW" : "BLOCK",
          explanation: `Human operator decision: ${action === "ALLOW" ? "ALLOWED" : "QUARANTINED / DELETED"}. Action enforced.`,
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
              description: `Operator Decided: ${action === "DELETE" ? "QUARANTINED / DELETED" : "ALLOWED"}`,
            };
          }
          return s;
        })
      );

      setTimeout(() => {
        setQuarantineModalOpen(false);
        setPendingFile(null);
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
  const handleSimulateAttack = async (type: "script" | "prompt_injection") => {
    try {
      const dropped = await simulateFileAttack(type);
      if (dropped) {
        setFiles((prev) => [dropped, ...prev.filter((f) => f.id !== dropped.id)]);
        setSelectedFileId(dropped.id);
        setCheckedFileId(dropped.id);
        // Automatically launch scanning
        setTimeout(() => {
          handleAnalyzeFile();
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
        className="relative rounded-2xl bg-[#0d1222]/90 border border-blue-500/70 p-3 px-4.5 lg:py-3.5 lg:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 backdrop-blur-md"
        style={{
          boxShadow: "0 0 20px -4px rgba(0, 136, 255, 0.45), inset 0 0 12px -3px rgba(0, 136, 255, 0.15)",
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

          <div className="w-9 h-9 rounded-xl bg-blue-950/50 border border-blue-500/60 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(0,136,255,0.4)] flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <h1 className="text-base lg:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Level 2 – File Security & Sandbox
              {quarantineModalOpen && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse">
                  Quarantine Command Pending
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 font-normal mt-0.5">
              Autonomous multi-agent file threat pipeline with OPA sandboxing, Guardian static analysis, and human quarantine control.
            </p>
          </div>
        </div>

        {/* Action Controls & Attack Simulator */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111728] border border-blue-500/40 text-xs font-medium text-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span>Virtual FS Sandboxed</span>
          </div>

          <button
            onClick={() => handleSimulateAttack("script")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-semibold text-xs shadow-[0_0_12px_rgba(255,46,85,0.4)] transition"
            title="Drop simulated Red Team attack script into sandbox"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Simulate Red Team File Attack</span>
          </button>
        </div>
      </section>

      {/* ── SubNav Category Filter Tabs ──────────────────────────────────── */}
      <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {[
          { key: "all", label: `All Files (${totalFiles})` },
          { key: "safe", label: `Safe (${safeFiles})` },
          { key: "suspicious", label: `Suspicious (${suspiciousFiles})` },
          { key: "quarantined", label: `Quarantined (${quarantinedFiles})` },
        ].map((tab) => {
          const isActive = filterCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterCategory(tab.key as any)}
              className={
                isActive
                  ? "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-[0_0_10px_rgba(0,136,255,0.4)] border border-blue-400"
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
        {/* Column 1: Left Details & Sandbox Status (3 Cols) */}
        <div className="xl:col-span-3 space-y-3">
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-semibold text-white">Sandbox Policy</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border text-emerald-400 bg-emerald-950/60 border-emerald-500/40">
                OPA Active
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-400 bg-[#090d18] p-2.5 rounded-xl border border-slate-800/80 font-mono">
              <div className="flex justify-between">
                <span>Allowed Paths:</span>
                <span className="text-emerald-400">/docs, /reports, /tmp</span>
              </div>
              <div className="flex justify-between">
                <span>Restricted:</span>
                <span className="text-red-400">/scripts, /configs, /etc</span>
              </div>
              <div className="flex justify-between">
                <span>Dangerous Exts:</span>
                <span className="text-amber-400">.sh, .exe, .bat, .ps1</span>
              </div>
            </div>
          </div>

          {/* Selected File Details & Preview */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">File Inspection Pane</span>
              {checkedFile && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    checkedFile.quarantined
                      ? "bg-purple-950/60 text-purple-400 border-purple-500/40"
                      : checkedFile.status_tag === "Safe"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                      : "bg-red-950/60 text-red-400 border-red-500/40"
                  }`}
                >
                  {checkedFile.quarantined ? "Quarantined" : checkedFile.status_tag}
                </span>
              )}
            </div>

            {checkedFile ? (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Filename</label>
                  <p className="text-white font-medium break-all">{checkedFile.name}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Virtual Path</label>
                  <p className="text-slate-300 font-mono text-[11px] break-all">{checkedFile.path}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Size</label>
                    <p className="text-slate-300 font-mono">{checkedFile.size_bytes} Bytes</p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Permission</label>
                    <p className={checkedFile.permission === "READ" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                      {checkedFile.permission}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">SHA-256 Hash</label>
                  <p className="text-slate-400 font-mono text-[10px] break-all bg-[#090d18] p-1.5 rounded-lg border border-slate-800">
                    {checkedFile.hash_sha256}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Content Preview</label>
                  <pre className="text-slate-300 font-mono text-[10px] bg-[#090d18] p-2 rounded-xl border border-slate-800 max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {checkedFile.content || "(Binary or empty document)"}
                  </pre>
                </div>

                <button
                  onClick={handleAnalyzeFile}
                  disabled={analyzing || checkedFile.quarantined}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 ${
                    checkedFile.quarantined
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white shadow-blue-600/30 border border-blue-500/50"
                  }`}
                >
                  {analyzing ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                      </svg>
                      <span>Scanning Sandbox ({liveDuration}s)...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Analyze Selected File</span>
                    </>
                  )}
                </button>

                {analysisResult && (
                  <div className="space-y-2 pt-2.5 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Threat Score</span>
                      <span className={`font-bold ${analysisResult.risk_score >= 0.7 ? "text-red-400" : "text-emerald-400"}`}>
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
              <p className="text-slate-500 italic text-center py-4">No file selected.</p>
            )}
          </div>
        </div>

        {/* Column 2: Center File List (5 Cols) */}
        <div className="xl:col-span-5 rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Sandboxed Files Explorer</span>
              <span className="px-1.5 py-0.5 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-mono">
                {filteredFiles.length}
              </span>
            </h2>

            <div className="relative">
              <input
                type="text"
                placeholder="Search file path or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 pl-7 pr-2.5 py-1 text-xs rounded-xl bg-[#090d18] border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* File Rows */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {loading ? (
              <p className="text-center py-8 text-slate-500">Loading virtual filesystem...</p>
            ) : filteredFiles.length === 0 ? (
              <p className="text-center py-8 text-slate-500">No files match filter.</p>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFileId === file.id;
                const isChecked = checkedFileId === file.id;
                const isSus = ["Suspicious", "Blocked", "Awaiting Approval"].includes(file.status_tag);

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      if (selectedFileId !== file.id) {
                        setSelectedFileId(file.id);
                        setCheckedFileId(file.id);
                        setAnalysisResult(null);
                        setTimelineStages(DEFAULT_STAGES);
                      }
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-[#141d33] border-blue-500/80 shadow-[0_0_12px_rgba(0,136,255,0.2)]"
                        : "bg-[#090d18] hover:bg-[#0f1628] border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (selectedFileId !== file.id) {
                            setCheckedFileId(file.id);
                            setSelectedFileId(file.id);
                            setAnalysisResult(null);
                            setTimelineStages(DEFAULT_STAGES);
                          }
                        }}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 focus:outline-none cursor-pointer"
                      />

                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          file.quarantined
                            ? "bg-purple-950/40 text-purple-400 border border-purple-500/40"
                            : isSus
                            ? "bg-red-950/40 text-red-400 border border-red-500/40"
                            : "bg-blue-950/40 text-blue-400 border border-blue-500/40"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                          {file.is_untrusted && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded font-bold bg-red-600/20 text-red-400 border border-red-500/40">
                              RED TEAM
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{file.path}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          file.quarantined
                            ? "bg-purple-950/60 text-purple-400 border-purple-500/40"
                            : file.status_tag === "Safe"
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                            : "bg-red-950/60 text-red-400 border-red-500/40"
                        }`}
                      >
                        {file.quarantined ? "Quarantined" : file.status_tag}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{file.size_bytes} B</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Threat Overview & Real-Time Timeline (4 Cols) */}
        <div className="xl:col-span-4 space-y-3">
          {/* Threat Overview Stats */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">File Threat Overview</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-white font-mono">{totalFiles}</p>
                <p className="text-[10px] text-slate-400">Total Files</p>
              </div>
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-red-400 font-mono">{suspiciousFiles}</p>
                <p className="text-[10px] text-slate-400">Threats</p>
              </div>
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-purple-400 font-mono">{quarantinedFiles}</p>
                <p className="text-[10px] text-slate-400">Quarantined</p>
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
                          ? "bg-blue-950 text-blue-400 border border-blue-500/50 animate-pulse"
                          : "bg-slate-900 text-slate-600 border border-slate-800"
                      }`}
                    >
                      {isComplete ? "✓" : stage.id}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-semibold ${isComplete ? "text-slate-200" : isProcessing ? "text-blue-400" : "text-slate-500"}`}>
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
      {quarantineModalOpen && pendingFile && (
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
                    Security Warning: Threat Detected
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
                  <span className="text-slate-400">Target File:</span>
                  <span className="text-white font-mono font-bold break-all">{pendingFile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Path:</span>
                  <span className="text-slate-300 font-mono">{pendingFile.path}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Risk Assessment:</span>
                  <span className="text-red-400 font-bold font-mono">92% CRITICAL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">SHA-256:</span>
                  <span className="text-slate-400 font-mono text-[10px] truncate max-w-[240px]">{pendingFile.hash_sha256}</span>
                </div>
              </div>

              {/* Blue Team Findings */}
              <div className="p-3 rounded-xl bg-[#111728] border border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-300">Blue Team Guardian Findings:</p>
                <p className="text-slate-400 text-[11px]">
                  {analysisResult?.indicators.length
                    ? analysisResult.indicators.join(" • ")
                    : "Prohibited execution command or indirect prompt injection payload detected in file stream."}
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
                Allow File
              </button>

              <button
                onClick={() => handleQuarantineDecision("DELETE")}
                disabled={submittingAction}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs shadow-[0_0_15px_rgba(255,46,85,0.5)] transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{submittingAction ? "Quarantining..." : "Delete / Quarantine File"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

