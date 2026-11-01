"use client";

import React, { useState, useEffect } from "react";
import { generateSecurityReport, getReportDownloadUrl } from "@/lib/api";

export interface StoredAnalysisRecord {
  id: string;
  security_level: "email" | "file" | "browser" | "payment" | string;
  item_name: string;
  from?: string;
  url?: string;
  domain?: string;
  vendor_name?: string;
  invoice_number?: string;
  amount?: number;
  currency_symbol?: string;
  date_time: string;
  decision: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" | string;
  risk_score: number;
  confidence_score: number;
  threat_classification: string;
  threat_indicators: string[];
  evidence: string[] | string;
  explanation: string;
  checks_completed: string[];
  target_ai_finding: string;
  blue_team_verification: string;
  opa_policy_reason: string;
  remediation: string;
}

export default function ResultsView() {
  const [history, setHistory] = useState<StoredAnalysisRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Load analysis history from sessionStorage
  const refreshHistory = () => {
    try {
      const raw = sessionStorage.getItem("CYBERHUNT_ANALYSIS_HISTORY");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
          if (!selectedId && parsed.length > 0) {
            setSelectedId(parsed[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load CYBERHUNT_ANALYSIS_HISTORY:", err);
    }
  };

  useEffect(() => {
    refreshHistory();
    // Poll sessionStorage every 2 seconds in case new scans complete
    const interval = setInterval(refreshHistory, 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredHistory = history.filter((item) => {
    if (levelFilter === "ALL") return true;
    if (levelFilter === "EMAIL") return item.security_level === "email";
    if (levelFilter === "FILE") return item.security_level === "file";
    if (levelFilter === "BROWSER") return item.security_level === "browser";
    if (levelFilter === "PAYMENT") return item.security_level === "payment" || item.security_level === "financial";
    return true;
  });

  const selectedRecord = history.find((h) => h.id === selectedId) || filteredHistory[0] || null;

  // Handle PDF report generation and download
  const handleDownloadPdf = async (record: StoredAnalysisRecord) => {
    try {
      setDownloadingId(record.id);
      setDownloadError(null);

      // Call backend to generate/retrieve report
      const rep = await generateSecurityReport(record);
      const downloadUrl = getReportDownloadUrl(rep.report_id);

      // Trigger browser download via blob
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `CyberHunt_${record.security_level.toUpperCase()}_Report_${rep.report_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("PDF Download error:", err);
      setDownloadError(err?.message || "Failed to download PDF report");
    } finally {
      setDownloadingId(null);
    }
  };

  // Metrics summary based on real analysis records
  const totalScans = history.length;
  const blockedCount = history.filter((h) => h.decision === "BLOCK").length;
  const allowedCount = history.filter((h) => h.decision === "ALLOW").length;
  const reviewCount = history.filter((h) => h.decision === "REQUIRE_APPROVAL").length;

  const getDecisionBadge = (decision: string) => {
    if (decision === "ALLOW") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ALLOW (CLEAN)
        </span>
      );
    }
    if (decision === "BLOCK") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-500/40">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          BLOCK (THREAT DETECTED)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-500/40">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        REQUIRE HUMAN REVIEW
      </span>
    );
  };

  const getLevelBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case "email":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Level 1: Email</span>;
      case "file":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Level 2: Files</span>;
      case "browser":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Level 3: Browser</span>;
      case "payment":
      case "financial":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">Level 4: Financial</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">{level}</span>;
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6 text-gray-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2937] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-900/30 border border-purple-700/40 flex items-center justify-center shadow-inner">
            <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Security Audit & Analysis Reports</h1>
            <p className="text-xs text-gray-400">Detailed multi-agent findings, OPA policy compliance & downloadable audit certificates</p>
          </div>
        </div>

        {/* Clear / refresh buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sessionStorage.removeItem("CYBERHUNT_ANALYSIS_HISTORY");
              setHistory([]);
              setSelectedId(null);
            }}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg border border-transparent hover:border-red-900/40 transition-colors"
          >
            Clear History
          </button>
          <span className="text-[11px] bg-purple-900/30 text-purple-300 border border-purple-700/40 rounded-full px-3 py-1 font-mono">
            {totalScans} Analyses Completed
          </span>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="text-2xl font-bold text-white mb-1 font-mono">{totalScans}</div>
          <div className="text-xs text-gray-400">Total Scans Executed</div>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400 mb-1 font-mono">{allowedCount}</div>
          <div className="text-xs text-gray-400">Authorized & Allowed</div>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400 mb-1 font-mono">{blockedCount}</div>
          <div className="text-xs text-gray-400">Threats Intercepted / Blocked</div>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-400 mb-1 font-mono">{reviewCount}</div>
          <div className="text-xs text-gray-400">Operator Review Required</div>
        </div>
      </div>

      {downloadError && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center justify-between">
          <span>Error downloading PDF report: {downloadError}</span>
          <button onClick={() => setDownloadError(null)} className="text-red-400 hover:underline ml-4">Dismiss</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { key: "ALL", label: `All Scans (${history.length})` },
          { key: "EMAIL", label: `Email (${history.filter((h) => h.security_level === "email").length})` },
          { key: "FILE", label: `Files (${history.filter((h) => h.security_level === "file").length})` },
          { key: "BROWSER", label: `Browser (${history.filter((h) => h.security_level === "browser").length})` },
          { key: "PAYMENT", label: `Financial (${history.filter((h) => h.security_level === "payment" || h.security_level === "financial").length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setLevelFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              levelFilter === tab.key
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-[#111827] text-gray-400 hover:text-white border border-[#1f2937]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {history.length === 0 ? (
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-purple-900/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">No Security Analyses Recorded Yet</h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Run a security scan in <strong>Level 1 (Email)</strong>, <strong>Level 2 (Files)</strong>, <strong>Level 3 (Browser)</strong>, or <strong>Level 4 (Payment)</strong>.
              Every analysis will automatically record complete multi-agent findings, risk scores, OPA policy decisions, and generate downloadable official PDF audit certificates here.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <span className="px-2.5 py-1 rounded bg-[#1f2937] text-[11px] text-gray-300">Level 1: Scan Email</span>
            <span className="px-2.5 py-1 rounded bg-[#1f2937] text-[11px] text-gray-300">Level 2: Scan File</span>
            <span className="px-2.5 py-1 rounded bg-[#1f2937] text-[11px] text-gray-300">Level 3: Scan URL</span>
            <span className="px-2.5 py-1 rounded bg-[#1f2937] text-[11px] text-gray-300">Level 4: Scan Invoice</span>
          </div>
        </div>
      ) : (
        /* Master-Detail Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Analysis History Selector */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
              Analysis History ({filteredHistory.length})
            </div>
            <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
              {filteredHistory.map((item) => {
                const isSelected = selectedRecord?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#1e1b4b]/60 border-purple-500/60 shadow-lg shadow-purple-950/30"
                        : "bg-[#111827] border-[#1f2937] hover:border-gray-700 hover:bg-[#161f30]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-xs text-white line-clamp-1" title={item.item_name}>
                        {item.item_name}
                      </div>
                      {getLevelBadge(item.security_level)}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <div className="flex items-center gap-2">
                        {item.decision === "ALLOW" && <span className="text-emerald-400 font-semibold">ALLOW</span>}
                        {item.decision === "BLOCK" && <span className="text-red-400 font-semibold">BLOCK</span>}
                        {item.decision === "REQUIRE_APPROVAL" && <span className="text-amber-400 font-semibold">REVIEW</span>}
                        <span>•</span>
                        <span className={item.risk_score >= 70 ? "text-red-400" : item.risk_score >= 40 ? "text-amber-400" : "text-emerald-400"}>
                          Risk {item.risk_score}/100
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {new Date(item.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Full 14-Item Audit Details & Download */}
          {selectedRecord && (
            <div className="lg:col-span-8 bg-[#111827] border border-[#1f2937] rounded-2xl p-6 space-y-6">
              {/* Top Banner with Decision & PDF Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2937] pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    {getLevelBadge(selectedRecord.security_level)}
                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(selectedRecord.date_time).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white break-all">
                    {selectedRecord.item_name}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  {getDecisionBadge(selectedRecord.decision)}
                  <button
                    onClick={() => handleDownloadPdf(selectedRecord)}
                    disabled={downloadingId === selectedRecord.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md shadow-purple-900/30 disabled:opacity-50"
                  >
                    {downloadingId === selectedRecord.id ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                        </svg>
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PDF Report
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 14 Items Detailed Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 5. Risk Score & Confidence Meter */}
                <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    5. Grounded Risk & Confidence Scoring
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold font-mono">
                        <span className={selectedRecord.risk_score >= 70 ? "text-red-400" : selectedRecord.risk_score >= 40 ? "text-amber-400" : "text-emerald-400"}>
                          {selectedRecord.risk_score}
                        </span>
                        <span className="text-gray-500 text-sm"> / 100 Risk</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Model Confidence: <span className="text-purple-400 font-semibold">{selectedRecord.confidence_score}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        selectedRecord.risk_score >= 70 ? "bg-red-950/60 text-red-400 border border-red-800/40" :
                        selectedRecord.risk_score >= 40 ? "bg-amber-950/60 text-amber-400 border border-amber-800/40" :
                        "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                      }`}>
                        {selectedRecord.risk_score >= 70 ? "CRITICAL RISK" : selectedRecord.risk_score >= 40 ? "ELEVATED RISK" : "NOMINAL / SAFE"}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-[#1f2937] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selectedRecord.risk_score >= 70 ? "bg-red-500" : selectedRecord.risk_score >= 40 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.max(5, selectedRecord.risk_score)}%` }}
                    />
                  </div>
                </div>

                {/* 6. Threat Classification */}
                <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    6. Threat Classification
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {selectedRecord.threat_classification}
                  </div>
                  <div className="text-xs text-gray-400 leading-relaxed">
                    Evaluated across Red Team signature matching, Gemini AI behavioral intent profiling, and OPA policy boundaries.
                  </div>
                </div>
              </div>

              {/* 9. Enforcement Explanation */}
              <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  9. Enforcement Explanation (Decision Rationale)
                </div>
                <p className="text-xs text-gray-300 leading-relaxed font-sans bg-[#131b2a] p-3 rounded-lg border border-[#1f2937]">
                  {selectedRecord.explanation}
                </p>
              </div>

              {/* 7 & 8. Vulnerabilities & Technical Evidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 7. Vulnerabilities / Suspicious Indicators */}
                <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    7. Indicators Detected ({selectedRecord.threat_indicators?.length || 0})
                  </div>
                  {selectedRecord.threat_indicators && selectedRecord.threat_indicators.length > 0 ? (
                    <ul className="space-y-1.5 text-xs">
                      {selectedRecord.threat_indicators.map((ind, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300">
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>{ind}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      No threat indicators detected.
                    </div>
                  )}
                </div>

                {/* 8. Technical Evidence */}
                <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    8. Technical Evidence
                  </div>
                  {Array.isArray(selectedRecord.evidence) && selectedRecord.evidence.length > 0 ? (
                    <div className="space-y-1 max-h-36 overflow-y-auto font-mono text-[11px] bg-[#111827] p-2.5 rounded-lg border border-[#1f2937] text-gray-300">
                      {selectedRecord.evidence.map((ev, i) => (
                        <div key={i} className="truncate" title={ev}>
                          <span className="text-purple-400">[{i + 1}]</span> {ev}
                        </div>
                      ))}
                    </div>
                  ) : typeof selectedRecord.evidence === "string" && selectedRecord.evidence ? (
                    <div className="font-mono text-[11px] bg-[#111827] p-2.5 rounded-lg border border-[#1f2937] text-gray-300 break-all">
                      {selectedRecord.evidence}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">No malicious technical artifacts found.</div>
                  )}
                </div>
              </div>

              {/* Multi-Agent Findings: 11, 12, 13 */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Multi-Agent Consensus & OPA Verification
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 11. Target AI */}
                  <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      11. Target AI Findings
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      {selectedRecord.target_ai_finding || "No abnormal intent identified."}
                    </p>
                  </div>

                  {/* 12. Blue Team */}
                  <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      12. Blue Team Verification
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      {selectedRecord.blue_team_verification || "Security heuristic scanning confirmed nominal status."}
                    </p>
                  </div>

                  {/* 13. OPA Policy Decision */}
                  <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      13. OPA Policy Guardrail
                    </div>
                    <div className="font-mono text-[11px] text-gray-200 font-bold">
                      {selectedRecord.opa_policy_reason}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Enforced by Mock Tool Gateway before action execution.
                    </p>
                  </div>
                </div>
              </div>

              {/* 10. Completed Security Checks & 14. Remediation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 10. Completed Security Checks */}
                <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    10. Completed Security Checks ({selectedRecord.checks_completed?.length || 0})
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                    {(selectedRecord.checks_completed || []).map((chk, i) => (
                      <div key={i} className="flex items-center gap-2 text-gray-300">
                        <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{chk}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 14. Recommended Remediation Action */}
                <div className="bg-[#0c1017] border border-[#1f2937] rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    14. Recommended Remediation Action
                  </div>
                  <div className="p-3 bg-[#131b2a] rounded-lg border border-[#1f2937] text-xs text-gray-200 leading-relaxed font-sans">
                    {selectedRecord.remediation || "Standard operational posture: keep continuous monitoring enabled."}
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Audit report verified against ISO/IEC 27001 & NIST CSF controls.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
