"use client";

import React, { useState, useEffect } from "react";

interface CyberHUDHeaderProps {
  scrollProgress: number;
  onScrollToTop?: () => void;
}

export default function CyberHUDHeader({
  scrollProgress,
  onScrollToTop,
}: CyberHUDHeaderProps) {
  const [utcTime, setUtcTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
        }) + " UTC"
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const scrubPercent = Math.min(100, Math.max(0, Math.round(scrollProgress * 100)));
  const isProtocolPhase = scrollProgress >= 0.7;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 py-2.5 pointer-events-auto select-none transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between rounded-xl bg-[#0a0a0c]/85 backdrop-blur-xl border border-white/10 px-4 py-2 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        {/* Left: Cyber Command Branding & Clearance */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onScrollToTop}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            title="Return to Story Ingress"
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.4)] group-hover:border-red-400 transition-colors">
              <span className="font-mono font-black text-red-400 text-xs tracking-tighter">CH</span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold tracking-wider text-white text-xs sm:text-sm">
                  CYBER<span className="text-red-500">_HUNT</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-950/80 text-red-300 border border-red-500/40 uppercase font-bold tracking-widest hidden sm:inline">
                  DEFENSE GRID
                </span>
              </div>
              <p className="text-[9px] font-mono text-zinc-400 tracking-tight">
                CLEARANCE: <strong className="text-red-400 font-semibold">LEVEL-4 RESTRICTED</strong>
              </p>
            </div>
          </button>
        </div>

        {/* Center: Live Telemetry Metadata */}
        <div className="hidden lg:flex items-center space-x-6 text-[11px] font-mono border-x border-white/10 px-6">
          {/* Live UTC Ticker */}
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>TIMELINE:</span>
            <strong className="text-zinc-200">{utcTime || "02:44:19 UTC"}</strong>
          </div>

          <span className="text-zinc-700">|</span>

          {/* Active Battle Levels Online */}
          <div className="flex items-center gap-2 text-zinc-400">
            <span>LEVELS:</span>
            <strong className="text-cyan-400">4 / 4 ONLINE</strong>
          </div>

          <span className="text-zinc-700">|</span>

          {/* OPA Policy Engine Status */}
          <div className="flex items-center gap-2 text-zinc-400">
            <span>POLICY:</span>
            <strong className="text-emerald-400">OPA v2.4 STRICT</strong>
          </div>

          <span className="text-zinc-700">|</span>

          {/* Dynamic Active Phase Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            <span className="text-zinc-500 text-[10px]">CURRENT:</span>
            <span className="text-cyan-300 font-bold uppercase tracking-wider text-[10px]">
              {isProtocolPhase ? "02 // SECURITY PROTOCOL" : "01 // DIGITAL WORKER"}
            </span>
          </div>
        </div>

        {/* Right: Telemetry Scrubber Gauge & Live Status Badge (No Arena Button) */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
            <span>SCRUB:</span>
            <span className="text-cyan-300 font-bold w-9 text-right">{scrubPercent}%</span>
            <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${scrubPercent}%` }}
              />
            </div>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>DEFENSE ACTIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
}
