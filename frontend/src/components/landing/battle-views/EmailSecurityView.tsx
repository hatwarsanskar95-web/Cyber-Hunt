"use client";

import React, { useState } from "react";

export default function EmailSecurityView() {
  const [selectedTab, setSelectedTab] = useState<"primary" | "promotions" | "social">("primary");
  const [isQuarantined, setIsQuarantined] = useState(false);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center select-none">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-xl border border-red-500/80 bg-red-950/30 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] mb-2">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-xl sm:text-2xl font-bold font-sans tracking-tight">
            Level 1: <span className="text-red-400">Email Security</span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-sans text-zinc-300">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Emails and attachments
          </span>
          <span className="text-zinc-600">|</span>
          <span className="flex items-center gap-1.5 font-medium">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="text-white">Real Gmail Integration</span>
          </span>
        </div>
      </div>

      {/* Main 3-Column Interactive Layout: Red Team -> Center Gmail -> Blue Team */}
      <div className="w-full relative flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-2">
        {/* LEFT: RED TEAM CARD */}
        <div className="w-full lg:w-48 xl:w-56 rounded-2xl border border-red-500/80 bg-[#0d070b]/95 p-4 shadow-[0_0_25px_rgba(239,68,68,0.35)] flex flex-col justify-center relative z-20 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-500/60 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              {/* Hooded Hacker Silhouette */}
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a7 7 0 00-7 7c0 2.5 1.5 4.5 3 6v1a2 2 0 002 2h4a2 2 0 002-2v-1c1.5-1.5 3-3.5 3-6a7 7 0 00-7-7zm-3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-black font-sans tracking-wider text-red-500 block uppercase">
                RED TEAM
              </span>
            </div>
          </div>
          <p className="text-[11px] font-sans text-zinc-300 leading-tight">
            Sends malicious emails &amp; attachments (e.g., phishing, malware)
          </p>

          {/* Desktop Connecting Line & Node to Gmail Row 1 */}
          <div className="hidden lg:flex items-center absolute -right-6 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-6 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <div className="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-black shadow-[0_0_10px_rgba(239,68,68,1)]" />
          </div>
        </div>

        {/* CENTER: GMAIL CLIENT INTERFACE */}
        <div className="flex-1 w-full max-w-3xl rounded-2xl border border-zinc-800 bg-[#16181f] text-zinc-200 shadow-2xl overflow-hidden relative z-10">
          <div className="flex flex-col sm:flex-row h-[360px] sm:h-[380px]">
            {/* Gmail Left Sidebar */}
            <div className="w-full sm:w-44 bg-[#111318] p-3 sm:p-4 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-zinc-800/80 shrink-0">
              <div className="space-y-4">
                {/* Logo */}
                <div className="flex items-center gap-2 px-1">
                  <svg className="w-5 h-4" viewBox="0 0 24 18" fill="none">
                    <path fill="#EA4335" d="M1.5 3.5v11c0 1.1.9 2 2 2h2.5v-8.5L12 11.5l6-3.5V16.5h2.5c1.1 0 2-.9 2-2v-11c0-.9-.7-1.6-1.5-1.5-.5 0-1 .3-1.3.7L12 7.7 4.3 2.7c-.3-.4-.8-.7-1.3-.7-.8-.1-1.5.6-1.5 1.5z" />
                  </svg>
                  <span className="font-sans font-bold text-sm text-white">Gmail</span>
                </div>

                {/* Compose Button */}
                <button className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium shadow transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Compose</span>
                </button>

                {/* Navigation Items */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-r-full bg-red-950/40 text-red-400 font-semibold border-l-2 border-red-500">
                    <span className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" /></svg>
                      Inbox
                    </span>
                    <span className="text-[10px] font-bold">3</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    Starred
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Snoozed
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    Sent
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Drafts
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-1 pt-2 border-t border-zinc-800 text-[11px]">
                <span className="text-zinc-500 uppercase tracking-widest text-[9px] px-2">Labels</span>
                <div className="flex items-center gap-2 px-2 py-0.5 text-zinc-400">
                  <span className="w-2 h-2 rounded bg-cyan-400" />
                  <span>Academic</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-0.5 text-zinc-400">
                  <span className="w-2 h-2 rounded bg-purple-500" />
                  <span>Projects</span>
                </div>
              </div>
            </div>

            {/* Gmail Right Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Header */}
              <div className="p-2.5 border-b border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#20222a] border border-zinc-700/60 text-xs text-zinc-400">
                  <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search mail</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="cursor-pointer hover:text-white">?</span>
                  <span className="cursor-pointer hover:text-white">⚙</span>
                  <span className="cursor-pointer hover:text-white">▦</span>
                  <div className="w-6 h-6 rounded-full bg-purple-700 text-white font-bold flex items-center justify-center text-[10px]">
                    V
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-800 text-xs font-medium px-2">
                <button
                  onClick={() => setSelectedTab("primary")}
                  className={`px-4 py-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                    selectedTab === "primary" ? "border-cyan-400 text-white" : "border-transparent text-zinc-400"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" /></svg>
                  Primary
                </button>
                <button
                  onClick={() => setSelectedTab("promotions")}
                  className={`px-4 py-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                    selectedTab === "promotions" ? "border-cyan-400 text-white" : "border-transparent text-zinc-400"
                  }`}
                >
                  🏷 Promotions
                </button>
                <button
                  onClick={() => setSelectedTab("social")}
                  className={`px-4 py-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                    selectedTab === "social" ? "border-cyan-400 text-white" : "border-transparent text-zinc-400"
                  }`}
                >
                  👥 Social
                </button>
              </div>

              {/* Email Rows List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 font-sans text-xs">
                {/* ROW 1: THE ATTACK ROW (Outlined in Glowing Neon Red) */}
                <div
                  onClick={() => setIsQuarantined(!isQuarantined)}
                  className="rounded-full border border-red-500/90 bg-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.45)] px-3 py-1.5 flex items-center justify-between text-zinc-200 transition-all hover:bg-red-950/30 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" readOnly checked className="accent-red-500 rounded" />
                    <span className="text-zinc-500 hover:text-amber-400">☆</span>
                    <strong className="text-white font-semibold truncate shrink-0">Account Security</strong>
                    <span className="flex items-center gap-1 text-red-400 truncate">
                      <span>⚠️</span>
                      <span className="font-medium truncate">Verify Your Account – Action Required</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-zinc-400 text-[11px]">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span>10:24 AM</span>
                  </div>
                </div>

                {/* ROW 2 */}
                <div className="px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 flex items-center justify-between text-zinc-400 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" className="rounded" />
                    <span>☆</span>
                    <span className="text-zinc-200 font-medium truncate shrink-0">College Admin</span>
                    <span className="text-zinc-400 truncate">Re: Internship Documents</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <span>📎</span>
                    <span>9:37 AM</span>
                  </div>
                </div>

                {/* ROW 3 */}
                <div className="px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 flex items-center justify-between text-zinc-400 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" className="rounded" />
                    <span>☆</span>
                    <span className="text-zinc-200 font-medium truncate shrink-0">Gmail Team</span>
                    <span className="text-zinc-400 truncate">Security alert for your account</span>
                  </div>
                  <span className="text-[11px] shrink-0">Yesterday</span>
                </div>

                {/* ROW 4 */}
                <div className="px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 flex items-center justify-between text-zinc-400 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" className="rounded" />
                    <span>☆</span>
                    <span className="text-zinc-200 font-medium truncate shrink-0">Project Update</span>
                    <span className="text-zinc-400 truncate">Team files and resources</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <span>📎</span>
                    <span>Oct 30</span>
                  </div>
                </div>

                {/* ROW 5 */}
                <div className="px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 flex items-center justify-between text-zinc-400 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" className="rounded" />
                    <span>☆</span>
                    <span className="text-zinc-200 font-medium truncate shrink-0">Event Invitation</span>
                    <span className="text-zinc-400 truncate">Cybersecurity Workshop</span>
                  </div>
                  <span className="text-[11px] shrink-0">Oct 29</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: BLUE TEAM CARD */}
        <div className="w-full lg:w-48 xl:w-56 rounded-2xl border border-blue-500/80 bg-[#070b14]/95 p-4 shadow-[0_0_25px_rgba(59,130,246,0.35)] flex flex-col justify-center relative z-20 shrink-0">
          {/* Desktop Connecting Line & Node to Gmail Row 1 */}
          <div className="hidden lg:flex items-center absolute -left-6 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 bg-black shadow-[0_0_10px_rgba(59,130,246,1)]" />
            <div className="w-6 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-950/80 border border-blue-500/60 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.5)]">
              {/* Blue Shield Avatar */}
              <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l7 3v6c0 5.25-3.5 10.15-7 11.5-3.5-1.35-7-6.25-7-11.5V5l7-3zm-1 14l5-5-1.41-1.41L11 13.17l-2.09-2.09L7.5 12.5 11 16z" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-black font-sans tracking-wider text-blue-400 block uppercase">
                BLUE TEAM
              </span>
            </div>
          </div>
          <p className="text-[11px] font-sans text-zinc-300 leading-tight">
            Analyzes the email, checks links &amp; attachments, and blocks the threat
          </p>
        </div>
      </div>

      {/* BOTTOM FLOATING ALERT BANNER */}
      <div className="mt-8 rounded-2xl border border-red-500 bg-[#120509]/95 px-6 py-3 shadow-[0_0_30px_rgba(239,68,68,0.4)] flex items-center gap-4 text-center sm:text-left">
        <div className="w-9 h-9 rounded-xl bg-red-950/80 border border-red-500/60 flex items-center justify-center text-red-400 text-lg shrink-0">
          ⚠️
        </div>
        <div>
          <h4 className="text-sm sm:text-base font-bold font-sans text-white tracking-tight">
            Suspicious Email Detected
          </h4>
          <p className="text-xs font-sans text-zinc-300">
            Potential phishing or malicious attachment
          </p>
        </div>
      </div>
    </div>
  );
}

