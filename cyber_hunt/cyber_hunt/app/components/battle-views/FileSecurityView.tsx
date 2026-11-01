"use client";

import React, { useState } from "react";

export default function FileSecurityView() {
  const [selectedFolder, setSelectedFolder] = useState<string>("Challenge_Files");

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center select-none">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-xl border border-purple-500/80 bg-purple-950/30 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] mb-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xl sm:text-2xl font-bold font-sans tracking-tight">
            Level 2: <span className="text-purple-400">File Security</span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-sans text-zinc-300">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF, TXT and documents
          </span>
          <span className="text-zinc-600">|</span>
          <span className="flex items-center gap-1.5 font-medium text-white">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Simulated Files (Lab Environment)
          </span>
        </div>
      </div>

      {/* Main 3-Column Interactive Layout: Red Team -> Center File Explorer -> Blue Team */}
      <div className="w-full relative flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-2">
        {/* LEFT: RED TEAM CARD */}
        <div className="w-full lg:w-48 xl:w-56 rounded-2xl border border-red-500/80 bg-[#0d070b]/95 p-4 shadow-[0_0_25px_rgba(239,68,68,0.35)] flex flex-col justify-center relative z-20 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-500/60 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
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
            Plants malicious files (PDF, TXT, DOC, etc.)
          </p>

          {/* Desktop Connecting Line & Node to File Explorer */}
          <div className="hidden lg:flex items-center absolute -right-6 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-6 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <div className="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-black shadow-[0_0_10px_rgba(239,68,68,1)]" />
          </div>
        </div>

        {/* CENTER: FILE EXPLORER CLIENT INTERFACE */}
        <div className="flex-1 w-full max-w-3xl rounded-2xl border border-zinc-800 bg-[#13151b] text-zinc-200 shadow-2xl overflow-hidden relative z-10">
          <div className="flex flex-col sm:flex-row h-[360px] sm:h-[380px]">
            {/* File Explorer Left Sidebar */}
            <div className="w-full sm:w-44 bg-[#0e1015] p-3 sm:p-4 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-zinc-800/80 shrink-0">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2 px-1 text-white font-bold text-xs tracking-wider">
                  <span className="text-amber-400">📁</span>
                  <span>File Explorer</span>
                </div>

                {/* Directory Tree */}
                <div className="space-y-1 text-xs">
                  <button
                    onClick={() => setSelectedFolder("Challenge_Files")}
                    className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
                      selectedFolder === "Challenge_Files"
                        ? "bg-[#1f2330] text-white border border-zinc-700/80"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span>📁</span>
                    <span>Challenge_Files</span>
                  </button>
                  <button
                    onClick={() => setSelectedFolder("Documents")}
                    className="w-full text-left flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <span>📄</span>
                    <span>Documents</span>
                  </button>
                  <button
                    onClick={() => setSelectedFolder("Downloads")}
                    className="w-full text-left flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <span>⬇</span>
                    <span>Downloads</span>
                  </button>
                  <button
                    onClick={() => setSelectedFolder("Desktop")}
                    className="w-full text-left flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <span>🖥</span>
                    <span>Desktop</span>
                  </button>
                  <button
                    onClick={() => setSelectedFolder("Recycle Bin")}
                    className="w-full text-left flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <span>🗑</span>
                    <span>Recycle Bin</span>
                  </button>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
                Isolated Sandbox / L2
              </div>
            </div>

            {/* File Explorer Right Grid Pane */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Address Bar & Search Header */}
              <div className="p-2.5 border-b border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="cursor-pointer hover:text-white">←</span>
                  <span className="cursor-pointer hover:text-white">→</span>
                  <div className="px-3 py-1 rounded-lg bg-[#0e1015] border border-zinc-700 text-zinc-300 font-mono text-[11px]">
                    / Challenge_Files
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1015] border border-zinc-700 text-[11px] text-zinc-400">
                    <span>🔍</span>
                    <span>Search files...</span>
                  </div>
                  <span className="cursor-pointer text-zinc-400 hover:text-white">▦</span>
                  <span className="cursor-pointer text-zinc-400 hover:text-white">☰</span>
                </div>
              </div>

              {/* Files Grid (4 columns x 2 rows) */}
              <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 overflow-y-auto">
                {/* 1. Reports Folder */}
                <div className="p-2.5 rounded-xl hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700 flex flex-col items-center text-center cursor-pointer transition-all">
                  <div className="w-12 h-10 bg-amber-500/20 border border-amber-500/40 rounded-lg flex items-center justify-center text-xl mb-1 shadow-sm">
                    📁
                  </div>
                  <span className="text-[11px] font-sans font-medium text-zinc-200 truncate w-full">Reports</span>
                </div>

                {/* 2. Case_Files Folder */}
                <div className="p-2.5 rounded-xl hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700 flex flex-col items-center text-center cursor-pointer transition-all">
                  <div className="w-12 h-10 bg-amber-500/20 border border-amber-500/40 rounded-lg flex items-center justify-center text-xl mb-1 shadow-sm">
                    📁
                  </div>
                  <span className="text-[11px] font-sans font-medium text-zinc-200 truncate w-full">Case_Files</span>
                </div>

                {/* 3. Internship_Guide.pdf */}
                <div className="p-2.5 rounded-xl hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700 flex flex-col items-center text-center cursor-pointer transition-all">
                  <div className="w-10 h-12 bg-red-950/40 border border-red-500/40 rounded flex flex-col items-center justify-center mb-1">
                    <span className="text-[9px] font-bold text-red-400 font-mono">PDF</span>
                  </div>
                  <span className="text-[11px] font-sans text-zinc-300 truncate w-full">Internship_Guide.pdf</span>
                </div>

                {/* 4. Notes.txt */}
                <div className="p-2.5 rounded-xl hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700 flex flex-col items-center text-center cursor-pointer transition-all">
                  <div className="w-10 h-12 bg-blue-950/40 border border-blue-500/40 rounded flex flex-col items-center justify-center mb-1">
                    <span className="text-[9px] font-bold text-blue-400 font-mono">TXT</span>
                  </div>
                  <span className="text-[11px] font-sans text-zinc-300 truncate w-full">Notes.txt</span>
                </div>

                {/* 5. Project_Details.docx */}
                <div className="p-2.5 rounded-xl hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700 flex flex-col items-center text-center cursor-pointer transition-all">
                  <div className="w-10 h-12 bg-blue-950/40 border border-blue-500/40 rounded flex flex-col items-center justify-center mb-1">
                    <span className="text-[11px] font-bold text-blue-400 font-mono">W</span>
                  </div>
                  <span className="text-[11px] font-sans text-zinc-300 truncate w-full">Project_Details.docx</span>
                </div>

                {/* 6. Offer_Letter.pdf — THE MALICIOUS THREAT FILE (Highlighted in Glowing Neon Red) */}
                <div
                  className="relative p-2.5 rounded-xl border-2 border-red-500 bg-red-950/20 shadow-[0_0_25px_rgba(239,68,68,0.55)] flex flex-col items-center text-center cursor-pointer transition-all animate-pulse"
                >
                  {/* Alert Triangle Badge */}
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md">
                    ⚠️
                  </div>

                  <div className="w-10 h-12 bg-red-950/80 border border-red-500 rounded flex flex-col items-center justify-center mb-1">
                    <span className="text-[9px] font-bold text-red-400 font-mono">PDF</span>
                  </div>
                  <span className="text-[11px] font-sans font-bold text-red-300 truncate w-full">
                    Offer_Letter.pdf
                  </span>
                </div>

                {/* 7. Credentials.txt */}
                <div className="p-2.5 rounded-xl hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700 flex flex-col items-center text-center cursor-pointer transition-all">
                  <div className="w-10 h-12 bg-blue-950/40 border border-blue-500/40 rounded flex flex-col items-center justify-center mb-1">
                    <span className="text-[9px] font-bold text-blue-400 font-mono">TXT</span>
                  </div>
                  <span className="text-[11px] font-sans text-zinc-300 truncate w-full">Credentials.txt</span>
                </div>

                {/* 8. Readme.docx */}
                <div className="p-2.5 rounded-xl hover:bg-zinc-800/40 border border-transparent hover:border-zinc-700 flex flex-col items-center text-center cursor-pointer transition-all">
                  <div className="w-10 h-12 bg-blue-950/40 border border-blue-500/40 rounded flex flex-col items-center justify-center mb-1">
                    <span className="text-[11px] font-bold text-blue-400 font-mono">W</span>
                  </div>
                  <span className="text-[11px] font-sans text-zinc-300 truncate w-full">Readme.docx</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: BLUE TEAM CARD */}
        <div className="w-full lg:w-48 xl:w-56 rounded-2xl border border-blue-500/80 bg-[#070b14]/95 p-4 shadow-[0_0_25px_rgba(59,130,246,0.35)] flex flex-col justify-center relative z-20 shrink-0">
          {/* Desktop Connecting Line & Node to File Explorer */}
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
              <span className="text-xs font-black font-sans tracking-wider text-blue-400 block uppercase">
                BLUE TEAM
              </span>
            </div>
          </div>
          <p className="text-[11px] font-sans text-zinc-300 leading-tight">
            Analyzes files, detects hidden threats, and prevents execution
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
            Suspicious File Detected
          </h4>
          <p className="text-xs font-sans text-zinc-300">
            This file may contain a hidden threat
          </p>
        </div>
      </div>
    </div>
  );
}
