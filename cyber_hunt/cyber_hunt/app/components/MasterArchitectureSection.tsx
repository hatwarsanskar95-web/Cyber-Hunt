"use client";

import React from "react";

export default function MasterArchitectureSection() {
  return (
    <section id="master-architecture" className="relative min-h-screen flex flex-col items-center justify-center py-28 px-4 sm:px-6 lg:px-8 text-center pointer-events-auto overflow-hidden">
      {/* Background Volumetric Convergence */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <div className="w-[900px] h-[900px] rounded-full border border-cyan-400/20 animate-pulse" />
        <div className="absolute w-[650px] h-[650px] rounded-full border border-blue-500/20" />
      </div>

      {/* Main Headline */}
      <div className="relative z-10 max-w-4xl mx-auto space-y-4 mb-14">
        <span className="text-xs font-mono font-bold tracking-[0.3em] text-cyan-400 uppercase block">
          CENTRAL ORCHESTRATION // ARCHITECTURE
        </span>

        <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black font-sans tracking-tight text-white uppercase">
          ONE GUARDIAN. <br />
          <span className="text-cyan-400 drop-shadow-[0_0_35px_rgba(6,182,212,0.7)]">
            FOUR ATTACK SURFACES.
          </span>
        </h2>

        <p className="text-base sm:text-xl font-mono text-zinc-300 max-w-2xl mx-auto pt-2">
          One security layer for every action your AI agent takes.
        </p>

        {/* 4 Vector Badges */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
          <span className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
            EMAIL: Real Gmail
          </span>
          <span className="px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300">
            FILES: Simulated Documents
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300">
            BROWSER: Simulated Web
          </span>
          <span className="px-3 py-1 rounded-full bg-red-950/80 border border-red-500/50 text-red-300">
            FINANCE: Mock Payments
          </span>
        </div>
      </div>

      {/* 3D Visual Architecture Representation */}
      <div className="relative z-10 max-w-4xl w-full mx-auto my-8">
        <div className="relative rounded-3xl bg-black/75 backdrop-blur-2xl border border-cyan-500/40 p-8 sm:p-14 shadow-[0_0_80px_rgba(6,182,212,0.25)]">
          {/* Top Node: EMAIL */}
          <div className="flex flex-col items-center">
            <div className="px-6 py-3 rounded-xl bg-cyan-950/90 border border-cyan-400 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              ✉ EMAIL (REAL GMAIL)
            </div>
            <div className="w-0.5 h-10 bg-linear-to-b from-cyan-400 to-blue-500 my-1 animate-pulse" />
          </div>

          {/* Middle Row: FILES <-> BLUE GUARDIAN <-> BROWSER */}
          <div className="flex items-center justify-between gap-4 my-2">
            {/* Left Node: FILES */}
            <div className="flex items-center">
              <div className="px-5 py-3 rounded-xl bg-purple-950/90 border border-purple-400 text-purple-300 font-mono text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                📁 FILES (DOCUMENTS)
              </div>
              <div className="h-0.5 w-8 sm:w-16 bg-linear-to-r from-purple-400 to-blue-500 mx-1 animate-pulse" />
            </div>

            {/* Central Core: BLUE GUARDIAN */}
            <div className="relative p-6 sm:p-8 rounded-2xl bg-cyan-950 border-2 border-cyan-400 text-center shadow-[0_0_60px_rgba(6,182,212,0.8)] transform hover:scale-105 transition-transform duration-300">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-cyan-500/20 border border-cyan-300 flex items-center justify-center">
                <svg className="w-7 h-7 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-mono text-sm sm:text-base font-black text-white tracking-widest uppercase block">
                BLUE GUARDIAN
              </span>
              <span className="text-[10px] font-mono text-cyan-300 tracking-wider block mt-1">
                OPA ZERO-TRUST POLICY SENTINEL
              </span>
            </div>

            {/* Right Node: BROWSER */}
            <div className="flex items-center">
              <div className="h-0.5 w-8 sm:w-16 bg-linear-to-l from-amber-400 to-blue-500 mx-1 animate-pulse" />
              <div className="px-5 py-3 rounded-xl bg-amber-950/90 border border-amber-400 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                🌐 BROWSER (SIMULATED WEB)
              </div>
            </div>
          </div>

          {/* Bottom Row: PAYMENTS -> BUSINESS AI AGENT */}
          <div className="flex flex-col items-center mt-2">
            <div className="w-0.5 h-10 bg-linear-to-b from-blue-500 to-red-500 my-1 animate-pulse" />
            <div className="px-6 py-3 rounded-xl bg-red-950/90 border border-red-400 text-red-300 font-mono text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              💳 PAYMENTS (MOCK GATEWAY)
            </div>

            <div className="w-0.5 h-10 bg-linear-to-b from-red-500 to-white my-1" />
            <div className="px-8 py-4 rounded-2xl bg-zinc-950 border border-white/60 text-white font-mono text-sm font-black uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              🤖 BUSINESS AI AGENT (GEMINI 1.5 PRO)
            </div>
          </div>
        </div>
      </div>

      {/* Product Mission Statement */}
      <div className="relative z-10 max-w-3xl mx-auto space-y-4 pt-12">
        <h3 className="text-3xl sm:text-5xl font-black font-sans text-white uppercase tracking-tight">
          LET YOUR AI WORK. <br />
          <span className="text-cyan-400">WE&apos;LL WATCH ITS BACK.</span>
        </h3>
        <p className="text-base sm:text-lg text-zinc-300 font-sans leading-relaxed">
          Autonomous agents should be able to act — without having unchecked access to everything around them.
        </p>
      </div>
    </section>
  );
}

