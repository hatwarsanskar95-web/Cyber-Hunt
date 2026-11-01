"use client";

import React from "react";

export default function BrowserSecurityView() {
  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center select-none">
      {/* Top Search Bar */}
      <div className="w-full max-w-2xl flex flex-col items-center mb-8">
        <div className="w-full flex items-center justify-between rounded-full bg-[#111420] border border-blue-500/50 px-4 py-2 shadow-[0_0_25px_rgba(59,130,246,0.25)]">
          <div className="flex items-center gap-3 text-zinc-300 text-sm font-sans flex-1 min-w-0 pr-2">
            <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="truncate text-white font-mono text-xs sm:text-sm">
              https://secure-login-verification.example
            </span>
          </div>

          <button className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md cursor-pointer transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        <span className="text-xs font-sans text-zinc-400 mt-2.5">
          Simulated browser &bull; isolated environment
        </span>
      </div>

      {/* Main 3-Column Interactive Layout: Red Team -> Center Browser -> Blue Team */}
      <div className="w-full relative flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-2">
        {/* LEFT: RED TEAM CARD */}
        <div className="w-full lg:w-52 xl:w-60 rounded-2xl border border-red-500/80 bg-[#0d070b]/95 p-4 shadow-[0_0_25px_rgba(239,68,68,0.35)] flex flex-col justify-center relative z-20 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-500/60 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a7 7 0 00-7 7c0 2.5 1.5 4.5 3 6v1a2 2 0 002 2h4a2 2 0 002-2v-1c1.5-1.5 3-3.5 3-6a7 7 0 00-7-7zm-3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-black font-sans tracking-wider text-red-500 block uppercase">
                RED TEAM &bull; ATTACK DETECTED
              </span>
            </div>
          </div>
          <p className="text-xs font-sans text-zinc-300">
            Malicious page injected
          </p>

          {/* Desktop Connecting Line & Node to Browser */}
          <div className="hidden lg:flex items-center absolute -right-6 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-6 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <div className="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-black shadow-[0_0_10px_rgba(239,68,68,1)]" />
          </div>
        </div>

        {/* CENTER: SIMULATED BROWSER WINDOW */}
        <div className="flex-1 w-full max-w-2xl rounded-2xl border border-zinc-700/80 bg-[#12141c] text-white shadow-2xl overflow-hidden relative z-10">
          {/* Browser Window Header */}
          <div className="px-4 py-3 bg-[#0d0f17] border-b border-zinc-800 flex items-center justify-between gap-3">
            {/* macOS Window Controls */}
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
            </div>

            {/* URL Pill in Header */}
            <div className="flex-1 max-w-md mx-auto flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[#181b26] border border-zinc-700/60 text-[11px] font-mono text-zinc-300 truncate">
              <span className="text-red-400">⚠️</span>
              <span className="truncate">https://secure-login-verification.example</span>
            </div>

            <div className="w-8 shrink-0" />
          </div>

          {/* Browser Window Page Body */}
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 bg-radial from-red-950/20 via-[#10121a] to-[#0c0d14] min-h-[260px]">
            {/* Big Red Warning Triangle */}
            <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-500/60 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)]">
              <span className="text-3xl text-red-500">⚠️</span>
            </div>

            {/* Phishing Content */}
            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-bold font-sans text-white tracking-tight">
                Account Verification Required
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-sans max-w-sm mx-auto">
                Verify your account to continue accessing services.
              </p>
            </div>

            {/* Red Verify Now Action Button */}
            <div className="pt-2">
              <button className="px-8 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-sans font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all cursor-pointer">
                Verify Now
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: BLUE TEAM CARD */}
        <div className="w-full lg:w-52 xl:w-60 rounded-2xl border border-blue-500/80 bg-[#070b14]/95 p-4 shadow-[0_0_25px_rgba(59,130,246,0.35)] flex flex-col justify-center relative z-20 shrink-0">
          {/* Desktop Connecting Line & Node to Browser */}
          <div className="hidden lg:flex items-center absolute -left-6 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 bg-black shadow-[0_0_10px_rgba(59,130,246,1)]" />
            <div className="w-6 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-950/80 border border-blue-500/60 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.5)]">
              <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l7 3v6c0 5.25-3.5 10.15-7 11.5-3.5-1.35-7-6.25-7-11.5V5l7-3zm-1 14l5-5-1.41-1.41L11 13.17l-2.09-2.09L7.5 12.5 11 16z" />
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-black font-sans tracking-wider text-blue-400 block uppercase">
                BLUE TEAM &bull; GUARDIAN ACTIVE
              </span>
            </div>
          </div>
          <p className="text-xs font-sans text-zinc-300">
            Analyzing URL...
            <br />
            Blocking unsafe navigation
          </p>
        </div>
      </div>

      {/* BOTTOM FLOATING ALERT BANNER */}
      <div className="mt-8 rounded-full border border-red-500 bg-[#16060a]/95 px-8 py-3 shadow-[0_0_35px_rgba(239,68,68,0.5)] flex items-center gap-3">
        <span className="text-red-500 text-lg">🚫</span>
        <span className="text-xs sm:text-sm font-bold font-sans text-red-400 tracking-wider uppercase">
          UNSAFE WEBSITE — ACTION BLOCKED
        </span>
      </div>
    </div>
  );
}

