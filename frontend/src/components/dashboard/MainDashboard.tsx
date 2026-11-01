"use client";

import type { DashboardView } from "@/types/dashboard";

interface MainDashboardProps {
  onNavigate: (view: DashboardView) => void;
}

export default function MainDashboard({ onNavigate }: MainDashboardProps) {
  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 py-4 flex flex-col gap-6 text-slate-200">
      {/* ── Top Header Section ───────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-800/40">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-wider">
              CYBER
            </span>
            <span className="text-2xl sm:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400">
              HUNT
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 font-medium">
            <svg
              className="w-4 h-4 text-rose-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v2m0 14v2m9-9h-2M5 12H3" />
            </svg>
            <p className="tracking-wide">
              Simulate <span className="mx-1 text-slate-600">•</span>
              Detect <span className="mx-1 text-slate-600">•</span>
              Defend <span className="mx-1 text-slate-600">•</span>
              Learn
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#081224] border border-cyan-500/30 shadow-lg shadow-cyan-950/30">
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            </div>
            <div className="pr-3 border-r border-slate-700/80 text-left">
              <p className="text-xs font-bold text-white leading-tight">System Online</p>
              <p className="text-[10px] text-slate-400">All agents operational</p>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-purple-950/50 border border-purple-500/50 text-purple-200 text-xs font-semibold shadow-sm">
              <svg className="w-3.5 h-3.5 text-purple-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Simulation Mode</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 Security Level Cards ────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {/* Card 1: Email Security — Red */}
        <article
          className="relative rounded-2xl p-5 bg-[#0c1220] border-2 border-red-500/60 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-red-400 cursor-pointer group"
          style={{ boxShadow: "0 0 22px -4px rgba(239,68,68,0.35), inset 0 0 12px -3px rgba(239,68,68,0.15)" }}
          onClick={() => onNavigate("simulation")}
        >
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-950/70 border border-red-500/60 flex items-center justify-center text-red-400 shadow-md shadow-red-950/50 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block">Level 1</span>
                <h3 className="text-base font-bold text-white leading-tight">Email Security</h3>
              </div>
            </div>
            <p className="text-xs text-slate-300/90 leading-relaxed min-h-[40px]">
              Detects phishing, spam, and malicious emails with real Gmail integration.
            </p>
          </div>
          <div className="mt-5">
            <button className="w-full py-2 px-4 rounded-xl border border-red-500/60 bg-red-950/20 group-hover:bg-red-500/20 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition group-hover:border-red-400">
              <span>Open Level</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </article>

        {/* Card 2: File Security — Purple */}
        <article
          className="relative rounded-2xl p-5 bg-[#0c1220] border-2 border-purple-500/60 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-purple-400 cursor-pointer group"
          style={{ boxShadow: "0 0 22px -4px rgba(168,85,247,0.35), inset 0 0 12px -3px rgba(168,85,247,0.15)" }}
          onClick={() => onNavigate("files")}
        >
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-500/60 flex items-center justify-center text-purple-400 shadow-md shadow-purple-950/50 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">Level 2</span>
                <h3 className="text-base font-bold text-white leading-tight">File Security</h3>
              </div>
            </div>
            <p className="text-xs text-slate-300/90 leading-relaxed min-h-[40px]">
              Scans documents (PDF, TXT, DOCX) for hidden threats and unsafe content.
            </p>
          </div>
          <div className="mt-5">
            <button className="w-full py-2 px-4 rounded-xl border border-purple-500/60 bg-purple-950/20 group-hover:bg-purple-500/20 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition group-hover:border-purple-400">
              <span>Open Level</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </article>

        {/* Card 3: Browser Security — Cyan */}
        <article
          className="relative rounded-2xl p-5 bg-[#0c1220] border-2 border-cyan-500/60 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400 cursor-pointer group"
          style={{ boxShadow: "0 0 22px -4px rgba(6,182,212,0.35), inset 0 0 12px -3px rgba(6,182,212,0.15)" }}
          onClick={() => onNavigate("browser")}
        >
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/60 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-950/50 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">Level 3</span>
                <h3 className="text-base font-bold text-white leading-tight">Browser Security</h3>
              </div>
            </div>
            <p className="text-xs text-slate-300/90 leading-relaxed min-h-[40px]">
              Analyzes websites and blocks phishing, malicious links, and unsafe navigation.
            </p>
          </div>
          <div className="mt-5">
            <button className="w-full py-2 px-4 rounded-xl border border-cyan-500/60 bg-cyan-950/20 group-hover:bg-cyan-500/20 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition group-hover:border-cyan-400">
              <span>Open Level</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </article>

        {/* Card 4: Financial Security — Emerald */}
        <article
          className="relative rounded-2xl p-5 bg-[#0c1220] border-2 border-emerald-500/60 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 cursor-pointer group"
          style={{ boxShadow: "0 0 22px -4px rgba(16,185,129,0.35), inset 0 0 12px -3px rgba(16,185,129,0.15)" }}
          onClick={() => onNavigate("payment")}
        >
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-950/50 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Level 4</span>
                <h3 className="text-base font-bold text-white leading-tight">Financial Security</h3>
              </div>
            </div>
            <p className="text-xs text-slate-300/90 leading-relaxed min-h-[40px]">
              Verifies payments, vendors, and invoices to prevent fraudulent transactions.
            </p>
          </div>
          <div className="mt-5">
            <button className="w-full py-2 px-4 rounded-xl border border-emerald-500/60 bg-emerald-950/20 group-hover:bg-emerald-500/20 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition group-hover:border-emerald-400">
              <span>Open Level</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </article>
      </section>

      {/* ── Attack Chain Workflow Bar ─────────────────────────────────── */}
      <section
        className="rounded-2xl p-4 sm:p-5 bg-[#0b101c] border border-slate-800 shadow-lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* Step 1: Red Team */}
          <div className="flex items-center justify-between sm:pr-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-500 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.2 21h15.6l-.77-3.39A8.96 8.96 0 0021 12c0-4.97-4.03-9-9-9z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-red-400">Red Team</h4>
                <p className="text-[11px] text-slate-400">Launches a simulated attack</p>
              </div>
            </div>
            <span className="text-slate-700 text-base hidden lg:inline font-light">→</span>
          </div>

          {/* Step 2: Target AI */}
          <div className="flex items-center justify-between sm:pr-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/50 flex items-center justify-center text-purple-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.523a3.75 3.75 0 01-2.98-.387M5 14.5l1.57.523a3.75 3.75 0 002.98-.387m0 0a3.75 3.75 0 013.9 0m-3.9 0V21m3.9-6.364V21" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-purple-400">Target AI</h4>
                <p className="text-[11px] text-slate-400">Analyzes the threat</p>
              </div>
            </div>
            <span className="text-slate-700 text-base hidden lg:inline font-light">→</span>
          </div>

          {/* Step 3: Blue Team */}
          <div className="flex items-center justify-between sm:pr-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/50 flex items-center justify-center text-cyan-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-cyan-400">Blue Team</h4>
                <p className="text-[11px] text-slate-400">Detects &amp; mitigates</p>
              </div>
            </div>
            <span className="text-slate-700 text-base hidden lg:inline font-light">→</span>
          </div>

          {/* Step 4: OPA */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-emerald-400 leading-tight">OPA (Policy Engine)</h4>
              <p className="text-[11px] text-slate-400 leading-tight">Decides: Allow / Block / Approve</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom Cyber Defense Hero ─────────────────────────────────── */}
      <section className="pt-2 pb-8 text-center flex flex-col items-center">
        {/* Glowing Shield Icon */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-cyan-950/50 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_25px_rgba(0,229,255,0.4)]">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
              <rect fill="currentColor" height="4" width="5" x="9.5" y="10.5" rx="1" />
              <path d="M10.5 10.5V9a1.5 1.5 0 013 0v1.5" stroke="currentColor" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Bracketed Cyber Defense Title */}
        <div className="relative px-8 py-2 mb-3">
          <span className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-purple-400/70" />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-purple-400/70" />
          <span className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-purple-400/70" />
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-purple-400/70" />
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Cyber</span>{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Defense</span>
          </h2>
        </div>

        {/* Subtitle - clean, unblocked, readable */}
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl px-4 leading-relaxed font-normal">
          Simulate real-world attacks, analyze threats with AI, enforce security policies, and learn proactive defense strategies.
        </p>
      </section>
    </div>
  );
}
