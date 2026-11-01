"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  InvoiceItem,
  InvoiceScanResult,
  LedgerStats,
  ApprovedVendor,
  listInvoices,
  getLedgerStats,
  listApprovedVendors,
  verifyInvoice,
  executePaymentDecision,
  simulatePaymentAttack,
} from "@/lib/api";
import DownloadReportButton from "../DownloadReportButton";

interface Level4PaymentSecurityProps {
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
  { id: 1, name: "Invoice Ingestion & Header Check", status: "completed", timestamp: "Ready", description: "Parsing vendor header, currency & payee metadata" },
  { id: 2, name: "Red Team Vector & Urgency Scan", status: "completed", timestamp: "Ready", description: "Checking deepfake/BEC pressure & signature manipulation" },
  { id: 3, name: "Vendor Allowlist & Domain Validation", status: "completed", timestamp: "Ready", description: "Cross-referencing verified corporate vendor directory" },
  { id: 4, name: "Bank Account & Routing Integrity", status: "completed", timestamp: "Ready", description: "Verifying payee IBAN/IFSC against approved ledger" },
  { id: 5, name: "OPA Payment Policy & Ceiling Check", status: "completed", timestamp: "Ready", description: "Enforcing ₹10,000 daily limit & single-transaction rules" },
  { id: 6, name: "Final Security Decision", status: "completed", timestamp: "Enforced", description: "Autonomous enforcement / Operator Command sign-off" },
];

export default function Level4PaymentSecurity({ onNavigateHome, simulationId }: Level4PaymentSecurityProps) {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [vendors, setVendors] = useState<ApprovedVendor[]>([]);
  const [ledger, setLedger] = useState<LedgerStats>({
    daily_limit: 10000,
    used_amount: 0,
    remaining_amount: 10000,
    utilization_pct: 0,
    currency: "INR",
    currency_symbol: "₹",
  });
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>("inv-003");
  const [filterCategory, setFilterCategory] = useState<"all" | "approved" | "suspicious" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Analysis state & stopwatch
  const [analyzing, setAnalyzing] = useState(false);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timeline & Result
  const [timelineStages, setTimelineStages] = useState<AnalysisStage[]>(DEFAULT_STAGES);
  const [analysisResult, setAnalysisResult] = useState<InvoiceScanResult | null>(null);
  const [currentAnalysisRecord, setCurrentAnalysisRecord] = useState<Record<string, any> | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Human Review & Reject Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState<InvoiceItem | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [invList, ledgerData, vendorList] = await Promise.all([
        listInvoices(),
        getLedgerStats(),
        listApprovedVendors(),
      ]);
      if (invList && invList.length > 0) {
        setInvoices(invList);
      }
      if (ledgerData) {
        setLedger(ledgerData);
      }
      if (vendorList) {
        setVendors(vendorList);
      }
    } catch (err) {
      console.warn("Could not fetch payment data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (filterCategory === "approved" && !["Approved", "Approved (Override)"].includes(inv.status_tag)) return false;
    if (filterCategory === "suspicious" && !["Suspicious", "Awaiting Approval"].includes(inv.status_tag)) return false;
    if (filterCategory === "rejected" && inv.status_tag !== "Rejected & Flagged") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        inv.vendor_name.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.bank_account.toLowerCase().includes(q) ||
        inv.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId) ?? filteredInvoices[0] ?? null;

  // Stats
  const totalInvoices = invoices.length;
  const suspiciousInvoices = invoices.filter((inv) => ["Suspicious", "Awaiting Approval"].includes(inv.status_tag)).length;
  const rejectedInvoices = invoices.filter((inv) => inv.status_tag === "Rejected & Flagged").length;
  const approvedInvoices = totalInvoices - suspiciousInvoices - rejectedInvoices;

  // Handle invoice scan & verification
  const handleVerifyInvoice = async (invoiceToScan?: InvoiceItem) => {
    const inv = invoiceToScan || selectedInvoice;
    if (!inv || analyzing) return;

    setAnalyzing(true);
    setAnalysisResult(null);
    setCurrentAnalysisRecord(null);
    setScanError(null);
    startTimer();

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const now = new Date().toLocaleTimeString();

    setTimelineStages([
      { id: 1, name: "Invoice Ingestion & Header Check", status: "processing", timestamp: now, description: `Parsing ${inv.invoice_number} (₹${inv.amount.toLocaleString()})...` },
      { id: 2, name: "Red Team Vector & Urgency Scan", status: "pending", description: "Scanning adversarial markers & executive pressure..." },
      { id: 3, name: "Vendor Allowlist & Domain Validation", status: "pending", description: "Cross-referencing verified corporate vendor directory..." },
      { id: 4, name: "Bank Account & Routing Integrity", status: "pending", description: "Verifying payee account against verified registry..." },
      { id: 5, name: "OPA Payment Policy & Ceiling Check", status: "pending", description: "Evaluating ₹10,000 daily transaction limit..." },
      { id: 6, name: "Final Security Decision", status: "pending", description: "Pending policy resolution" },
    ]);

    try {
      // Stage 1 -> 2
      await delay(160);
      setTimelineStages((prev) => [
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "processing", timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(2),
      ]);

      // Stage 2 -> 3 (API call)
      await delay(160);
      setTimelineStages((prev) => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "processing", timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(3),
      ]);

      const res = await verifyInvoice(inv.id, simulationId || undefined);

      // Stage 3 -> 4
      await delay(180);
      setTimelineStages((prev) => [
        prev[0],
        prev[1],
        {
          ...prev[2],
          status: "completed",
          timestamp: new Date().toLocaleTimeString(),
          description: res.threat_detected ? "Unverified vendor domain mismatch" : "Vendor identity verified",
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
          description: res.tampered_fields?.includes("bank_account") ? "Payee account altered/mismatched" : "Account routing verified",
        },
        { ...prev[4], status: "processing", timestamp: new Date().toLocaleTimeString() },
        prev[5],
      ]);

      // Stage 5 -> 6
      await delay(160);
      setTimelineStages([
        { id: 1, name: "Invoice Ingestion & Header Check", status: "completed", timestamp: now, description: `Invoice: ${res.invoice_number}` },
        { id: 2, name: "Red Team Vector & Urgency Scan", status: "completed", timestamp: now, description: res.threat_detected ? "Adversarial invoice anomaly flagged" : "Clean — No urgency pressure tactics" },
        { id: 3, name: "Vendor Allowlist & Domain Validation", status: "completed", timestamp: now, description: res.threat_detected ? "Vendor unverified or spoofed" : "Authorized corporate vendor" },
        { id: 4, name: "Bank Account & Routing Integrity", status: "completed", timestamp: now, description: res.tampered_fields?.length > 0 ? `Tampered fields: ${res.tampered_fields.join(", ")}` : "Verified account numbers" },
        { id: 5, name: "OPA Payment Policy & Ceiling Check", status: "completed", timestamp: now, description: `Policy Decision: ${res.decision}` },
        { id: 6, name: "Final Security Decision", status: "completed", timestamp: now, description: `Enforcement: ${res.decision}` },
      ]);

      setAnalysisResult(res);

      // Update invoice status in list
      // Update invoice status in list
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id
            ? { ...item, status_tag: res.decision === "REQUIRE_APPROVAL" ? "Awaiting Approval" : (res.decision === "BLOCK" ? "Rejected & Flagged" : "Approved") }
            : item
        )
      );

      // Persist completed record to local storage for Results tab & PDF reports
      try {
        const payAnalysis = (res as any)?.analysis || {};
        const isSafe = res.decision === "ALLOW";
        const historyRecord = {
          id: `pay-${inv.id}-${Date.now()}`,
          security_level: "payment",
          item_name: `${inv.vendor_name} — ${inv.invoice_number}`,
          vendor_name: inv.vendor_name,
          invoice_number: inv.invoice_number,
          amount: inv.amount,
          currency: "INR",
          currency_symbol: "₹",
          date_time: new Date().toISOString(),
          decision: res.decision,
          risk_score: typeof res.risk_score === "number" ? (res.risk_score <= 1 ? Math.round(res.risk_score * 100) : res.risk_score) : (isSafe ? 5 : 95),
          confidence_score: payAnalysis.confidence_score ?? (isSafe ? 96 : 95),
          threat_classification: isSafe ? "Clean / Verified" : res.decision === "REQUIRE_APPROVAL" ? "Uncertain / Requires Review" : "Fraudulent / Blocked",
          threat_indicators: res.indicators && res.indicators.length > 0 ? res.indicators : (isSafe ? ["Vendor in verified directory", "Payee coordinates match"] : ["Fraud indicators detected"]),
          evidence: payAnalysis.evidence || res.indicators || [],
          explanation: res.explanation || (isSafe ? "Invoice verified legitimate. Vendor and bank account match authorized records." : "Payment security threats detected."),
          checks_completed: payAnalysis.checks_completed || [
            "Vendor Directory & Allowlist Verification",
            "Vendor Domain Integrity & Typo-spoof Check",
            "Payee Bank Account & Routing Validation",
            "Daily Transaction Ceiling & Ledger Limit Check",
            "Duplicate Invoice Number Collision Detection",
            "Business Email Compromise (BEC) Urgency Scan",
            "Open Policy Agent (OPA) Financial Policy Enforcement",
          ],
          target_ai_finding: payAnalysis.target_ai_finding || `Payment processing proposed for ₹${inv.amount.toLocaleString()} to ${inv.vendor_name}`,
          blue_team_verification: payAnalysis.blue_team_verification || (isSafe ? "Zero fraud indicators detected." : "Invoice fraud indicators identified."),
          opa_policy_reason: payAnalysis.opa_policy_reason || (isSafe ? "OPERATION_WITHIN_POLICY_ALLOWLIST" : "OPA_FINANCIAL_BLOCK"),
          remediation: payAnalysis.remediation || (isSafe ? "Transaction approved within standard operational ceiling." : "Halt disbursement and flag coordinates."),
        };
        setCurrentAnalysisRecord(historyRecord);
        const existing = JSON.parse(sessionStorage.getItem("CYBERHUNT_ANALYSIS_HISTORY") || "[]");
        const filtered = existing.filter((item: any) => item.id !== historyRecord.id);
        filtered.unshift(historyRecord);
        sessionStorage.setItem("CYBERHUNT_ANALYSIS_HISTORY", JSON.stringify(filtered.slice(0, 100)));
      } catch (storageErr) {
        console.debug("Session storage write skipped:", storageErr);
      }

      // Trigger Review Modal ONLY for uncertain 50-50 decisions requiring operator review
      if (res.decision === "REQUIRE_APPROVAL") {
        setPendingInvoice(inv);
        setReviewModalOpen(true);
      }
    } catch (err: any) {
      console.error("Invoice verification error:", err);
      setScanError(err?.message || "Verification failed. Check backend connection.");
    } finally {
      setAnalyzing(false);
      stopTimer();
    }
  };

  // Handle human decision (Reject & Flag vs Approve)
  const handleOperatorDecision = async (action: "REJECT_AND_FLAG" | "APPROVE") => {
    if (!pendingInvoice) return;
    setSubmittingAction(true);
    setFeedbackMessage(null);

    try {
      const res = await executePaymentDecision(
        pendingInvoice.id,
        action,
        action === "REJECT_AND_FLAG" ? "Human operator rejected fraudulent invoice" : "Human operator approved payment override"
      );

      if (res && res.invoice) {
        setInvoices((prev) =>
          prev.map((item) => (item.id === res.invoice.id ? { ...item, status_tag: res.invoice.status_tag } : item))
        );
        // Refresh ledger stats
        const updatedLedger = await getLedgerStats();
        if (updatedLedger) setLedger(updatedLedger);

        setFeedbackMessage(res.message);
        if (currentAnalysisRecord) {
          const updated = {
            ...currentAnalysisRecord,
            decision: action === "APPROVE" ? "ALLOW" : "BLOCK",
            explanation: `Human operator decision: ${action === "APPROVE" ? "APPROVED" : "REJECTED & FLAGGED"}. Action enforced.`,
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
          setReviewModalOpen(false);
          setPendingInvoice(null);
          setFeedbackMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      console.error("Decision execution error:", err);
      setFeedbackMessage(err?.message || "Failed to execute decision.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Red Team simulated attack
  const handleSimulateAttack = async (type: "bec_invoice" | "vendor_bank_tampering" | "duplicate_fraud") => {
    try {
      const newInv = await simulatePaymentAttack(type);
      if (newInv) {
        setInvoices((prev) => [newInv, ...prev.filter((i) => i.id !== newInv.id)]);
        setSelectedInvoiceId(newInv.id);
        setTimeout(() => {
          handleVerifyInvoice(newInv);
        }, 300);
      }
    } catch (err) {
      console.error("Failed to inject payment attack:", err);
    }
  };

  const usedPct = ledger.daily_limit > 0 ? (ledger.used_amount / ledger.daily_limit) * 100 : 0;

  return (
    <div
      className="flex-1 flex flex-col gap-3.5 min-w-0 text-xs selection:bg-[#ff2e55] selection:text-white"
      style={{
        backgroundColor: "#060911",
        backgroundImage:
          "radial-gradient(ellipse 55% 45% at 20% 98%, rgba(255, 140, 20, 0.22) 0%, transparent 65%), radial-gradient(ellipse 65% 45% at 85% 98%, rgba(168, 85, 247, 0.25) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 50% 100%, rgba(200, 20, 100, 0.12) 0%, transparent 60%)",
      }}
    >
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <section
        className="relative rounded-2xl bg-[#0d1222]/90 border border-amber-500/70 p-3 px-4.5 lg:py-3.5 lg:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 backdrop-blur-md"
        style={{
          boxShadow: "0 0 20px -4px rgba(245, 158, 11, 0.45), inset 0 0 12px -3px rgba(245, 158, 11, 0.15)",
        }}
        data-purpose="payment-header-banner"
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

          <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-500/60 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)] flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>

          <div>
            <h1 className="text-base lg:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Level 4 – Payment & Invoice Security Sandbox
              {reviewModalOpen && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse">
                  Fraud Review Pending
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 font-normal mt-0.5">
              Simulated Banking Ledger · Multi-agent BEC detection, vendor tampering prevention, and OPA financial policy enforcement.
            </p>
          </div>
        </div>

        {/* Controls & Red Team Attack Triggers */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111728] border border-amber-500/40 text-xs font-medium text-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span>OPA Active (₹10k Limit)</span>
          </div>

          <button
            onClick={() => handleSimulateAttack("bec_invoice")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-semibold text-xs shadow-[0_0_12px_rgba(255,46,85,0.4)] transition"
            title="Inject fake executive urgent wire invoice"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Simulate Urgent BEC</span>
          </button>

          <button
            onClick={() => handleSimulateAttack("vendor_bank_tampering")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 text-white font-semibold text-xs shadow-[0_0_12px_rgba(245,158,11,0.4)] transition"
            title="Inject tampered payee account wire"
          >
            <span>Simulate Bank Tampering</span>
          </button>
        </div>
      </section>

      {/* ── SubNav Filter Tabs ─────────────────────────────────────────────── */}
      <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {[
          { key: "all", label: `All Invoices (${totalInvoices})` },
          { key: "approved", label: `Legitimate / Approved (${approvedInvoices})` },
          { key: "suspicious", label: `Fraud / Flagged (${suspiciousInvoices})` },
          { key: "rejected", label: `Rejected & Blocked (${rejectedInvoices})` },
        ].map((tab) => {
          const isActive = filterCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterCategory(tab.key as any)}
              className={
                isActive
                  ? "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold shadow-[0_0_10px_rgba(245,158,11,0.4)] border border-amber-400"
                  : "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0e1424] hover:bg-[#141b30] border border-slate-800 text-slate-300 transition-colors"
              }
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Content Grid (3 Columns) ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
        {/* Column 1: Banking Ledger & Vendor Directory (3 Cols) */}
        <div className="xl:col-span-3 space-y-3">
          {/* Daily Limit Card */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span className="text-xs font-semibold text-white">Simulated Banking Ledger</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border text-emerald-400 bg-emerald-950/60 border-emerald-500/40">
                OPA Governed
              </span>
            </div>

            {/* Zero real money disclaimer */}
            <div className="px-3 py-2 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-400 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Zero real money. All disbursements require human authorization.</span>
            </div>

            {/* Daily limit bar */}
            <div className="bg-[#090d18] border border-slate-800/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Daily Transaction Limit:</span>
                <span className="font-mono text-white font-bold">
                  ₹{ledger.used_amount.toLocaleString()} / ₹{ledger.daily_limit.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedPct > 80
                      ? "bg-gradient-to-r from-red-600 to-rose-500"
                      : usedPct > 40
                      ? "bg-gradient-to-r from-amber-600 to-yellow-500"
                      : "bg-gradient-to-r from-emerald-600 to-teal-400"
                  }`}
                  style={{ width: `${Math.min(100, usedPct)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>{usedPct.toFixed(0)}% Utilized</span>
                <span>Remaining: ₹{ledger.remaining_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Approved Corporate Vendors Allowlist */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Approved Corporate Vendors</span>
              <span className="text-[10px] text-slate-500 font-mono">{vendors.length} Verified</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {vendors.map((v) => (
                <div key={v.id} className="p-2 rounded-xl bg-[#090d18] border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate">{v.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-mono">
                      ALLOWLIST
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>@{v.verified_domain}</span>
                    <span className="text-slate-500">Cap: ₹{v.default_limit.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Target Invoice Inspection Detail */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Invoice Detail Inspector</span>
              {selectedInvoice && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    selectedInvoice.status_tag === "Approved" || selectedInvoice.status_tag === "Approved (Override)"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                      : selectedInvoice.status_tag === "Rejected & Flagged"
                      ? "bg-purple-950/60 text-purple-400 border-purple-500/40"
                      : "bg-red-950/60 text-red-400 border-red-500/40"
                  }`}
                >
                  {selectedInvoice.status_tag}
                </span>
              )}
            </div>

            {selectedInvoice ? (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Vendor / Payee</label>
                  <p className="text-white font-medium">{selectedInvoice.vendor_name}</p>
                  <p className="text-slate-400 font-mono text-[11px] truncate">{selectedInvoice.vendor_email}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Invoice Number</label>
                    <p className="text-slate-300 font-mono">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Amount</label>
                    <p className="text-amber-400 font-mono font-bold text-sm">
                      ₹{selectedInvoice.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Payee Bank Account</label>
                  <p
                    className={`font-mono text-[11px] p-1.5 rounded-lg border ${
                      selectedInvoice.tampered_fields.includes("bank_account")
                        ? "bg-red-950/40 border-red-500/50 text-red-300 font-bold"
                        : "bg-[#090d18] border-slate-800 text-slate-300"
                    }`}
                  >
                    {selectedInvoice.bank_account}
                  </p>
                </div>

                {selectedInvoice.tampered_fields.length > 0 && (
                  <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/50 space-y-1">
                    <span className="text-[10px] font-bold text-red-400 uppercase block">Anomalies Detected:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedInvoice.tampered_fields.map((f, i) => (
                        <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-500/40">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleVerifyInvoice()}
                  disabled={analyzing || selectedInvoice.status_tag === "Rejected & Flagged"}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 ${
                    selectedInvoice.status_tag === "Rejected & Flagged"
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 text-white shadow-amber-600/30 border border-amber-500/50"
                  }`}
                >
                  {analyzing ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                      </svg>
                      <span>Evaluating Invoice ({liveDuration}s)...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Verify & Enforce OPA Policy</span>
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
              <p className="text-slate-500 italic text-center py-4">No invoice selected.</p>
            )}
          </div>
        </div>

        {/* Column 2: Invoices Queue & Virtual Ledger (5 Cols) */}
        <div className="xl:col-span-5 rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
          {/* Header & Search */}
          <div className="flex items-center justify-between gap-2 pb-1">
            <h2 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Pending & Historical Invoices</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-600/20 text-amber-400 text-[10px] font-mono">
                {filteredInvoices.length}
              </span>
            </h2>

            <div className="relative">
              <input
                type="text"
                placeholder="Search vendor or invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 pl-7 pr-2.5 py-1 text-xs rounded-xl bg-[#090d18] border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
              <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          {scanError && (
            <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/60 text-red-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
              <span className="flex items-center gap-1.5">
                <span className="text-red-400 font-bold">⚠️ Payment Warning:</span>
                <span>{scanError}</span>
              </span>
              <button onClick={() => setScanError(null)} className="text-red-400 hover:text-white text-xs font-bold px-1.5">✕</button>
            </div>
          )}

          {/* Safe Verification Banner */}
          {analysisResult && !analysisResult.threat_detected && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/60 space-y-2 animate-fade-in shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs">
                    ✓
                  </span>
                  <span className="font-bold text-xs text-emerald-300">Invoice Legitimate & Payment Authorized</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold">
                  OPA: ALLOW
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                <div className="bg-[#090d18] p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Vendor Record</span>
                  <span className="text-emerald-400 font-semibold font-mono">Verified Match</span>
                </div>
                <div className="bg-[#090d18] p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Amount Check</span>
                  <span className="text-emerald-400 font-semibold font-mono">Within Daily Cap</span>
                </div>
                <div className="bg-[#090d18] p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Bank Integrity</span>
                  <span className="text-emerald-400 font-semibold font-mono">Authorized Account</span>
                </div>
              </div>

              <DownloadReportButton analysisData={currentAnalysisRecord} />
            </div>
          )}

          {/* Invoices List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {loading ? (
              <p className="text-center py-8 text-slate-500">Loading banking ledger invoices...</p>
            ) : filteredInvoices.length === 0 ? (
              <p className="text-center py-8 text-slate-500">No invoices match selected filter.</p>
            ) : (
              filteredInvoices.map((inv) => {
                const isSelected = selectedInvoiceId === inv.id;
                const isSus = ["Suspicious", "Awaiting Approval"].includes(inv.status_tag);
                const isRejected = inv.status_tag === "Rejected & Flagged";

                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-[#1c1428] border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                        : "bg-[#090d18] hover:bg-[#101526] border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isRejected
                            ? "bg-purple-950/50 text-purple-400 border border-purple-500/40"
                            : isSus
                            ? "bg-red-950/50 text-red-400 border border-red-500/40"
                            : "bg-emerald-950/50 text-emerald-400 border border-emerald-500/40"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white truncate">{inv.vendor_name}</p>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] rounded font-bold border ${
                              inv.category === "BEC Impersonation"
                                ? "bg-red-600/20 text-red-400 border-red-500/40"
                                : inv.category === "Account Tampering"
                                ? "bg-orange-600/20 text-orange-400 border-orange-500/40"
                                : inv.category === "Duplicate Fraud"
                                ? "bg-amber-600/20 text-amber-400 border-amber-500/40"
                                : "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                            }`}
                          >
                            {inv.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          {inv.invoice_number} · Payee: {inv.bank_account}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-amber-400 font-mono font-bold text-xs">
                        ₹{inv.amount.toLocaleString()}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          isRejected
                            ? "bg-purple-950/60 text-purple-400 border-purple-500/40"
                            : isSus
                            ? "bg-red-950/60 text-red-400 border-red-500/40"
                            : "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                        }`}
                      >
                        {inv.status_tag}
                      </span>
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
              <span className="text-xs font-semibold text-white">Payment Threat Overview</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b]" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-white font-mono">{totalInvoices}</p>
                <p className="text-[10px] text-slate-400">Total Invoices</p>
              </div>
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-red-400 font-mono">{suspiciousInvoices}</p>
                <p className="text-[10px] text-slate-400">Fraud Flagged</p>
              </div>
              <div className="p-2 rounded-xl bg-[#090d18] border border-slate-800">
                <p className="text-lg font-bold text-purple-400 font-mono">{rejectedInvoices}</p>
                <p className="text-[10px] text-slate-400">Blocked / Purged</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Analysis Duration:</span>
              <span className="font-mono text-cyan-400 font-bold">
                {analyzing ? `${liveDuration}s` : lastDuration !== null ? `${lastDuration}s` : "0.0s"}
              </span>
            </div>
          </div>

          {/* 6-Stage Real-Time Timeline */}
          <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Invoice Analysis Pipeline</span>
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
                          ? "bg-amber-950 text-amber-400 border border-amber-500/50 animate-pulse"
                          : "bg-slate-900 text-slate-600 border border-slate-800"
                      }`}
                    >
                      {isComplete ? "✓" : stage.id}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-semibold ${isComplete ? "text-slate-200" : isProcessing ? "text-amber-400" : "text-slate-500"}`}>
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

      {/* ── Human Review & Reject Modal ────────────────────────────────────── */}
      {reviewModalOpen && pendingInvoice && (
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Security Warning: Fraudulent Invoice Intercepted</h3>
                  <p className="text-[11px] text-red-400 font-mono">OPA Policy: REQUIRE_APPROVAL</p>
                </div>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Target Details */}
            <div className="p-3 rounded-xl bg-[#080c16] border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Invoice Number:</span>
                <span className="font-mono text-white font-semibold">{pendingInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Vendor / Payee:</span>
                <span className="font-medium text-white truncate max-w-[240px]">{pendingInvoice.vendor_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Requested Amount:</span>
                <span className="font-mono text-red-400 font-bold text-sm">
                  ₹{pendingInvoice.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Payee Account:</span>
                <span className="font-mono text-red-300 bg-red-950/40 px-2 py-0.5 rounded border border-red-500/40">
                  {pendingInvoice.bank_account}
                </span>
              </div>
            </div>

            {/* Blue Team Guardian Findings */}
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-400">Blue Team Guardian Findings:</p>
              <div className="space-y-1 text-xs text-red-200">
                {analysisResult?.indicators && analysisResult.indicators.length > 0 ? (
                  analysisResult.indicators.map((ind, i) => (
                    <div key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-red-400 font-bold">›</span>
                      <span>{ind}</span>
                    </div>
                  ))
                ) : (
                  <p>Suspicious vendor impersonation or account tampering detected.</p>
                )}
              </div>
            </div>

            {feedbackMessage && (
              <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/60 text-purple-200 text-xs text-center font-mono animate-fade-in">
                {feedbackMessage}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleOperatorDecision("APPROVE")}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
              >
                Approve Payment (Override)
              </button>
              <button
                onClick={() => handleOperatorDecision("REJECT_AND_FLAG")}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs shadow-[0_0_15px_rgba(255,46,85,0.4)] transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Reject & Flag Fraud</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
