"use client";

import React, { useState, useEffect } from "react";

interface NavbarProps {
  onOpenArena: () => void;
  activeLevel?: number;
}

export default function Navbar({ onOpenArena }: NavbarProps) {
  const [tickerTime, setTickerTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTickerTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " UTC"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 py-3 pointer-events-auto">
      <div className="max-w-7xl mx-auto flex items-center justify-between rounded-xl bg-black/70 backdrop-blur-md border border-red-500/30 px-4 py-2.5 shadow-[0_0_25px_rgba(239,68,68,0.15)] transition-all">
        {/* Brand & Status Indicator */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
            <span className="font-mono font-black text-red-500 text-sm tracking-tighter">CH</span>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-wider text-white text-sm">
                CYBER<span className="text-red-500">_HUNT</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-widest">
                v2.4 OPA
              </span>
            </div>
            <p className="text-[10px] font-mono text-zinc-400 tracking-tight">AI DEFENSE MATRIX</p>
          </div>
        </div>

        {/* Live Platform Telemetry Ticker */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-mono text-zinc-400 border-x border-zinc-800 px-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Simulations: <strong className="text-zinc-200">142 Active</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">|</span>
            <span>
              Policy Engine: <strong className="text-emerald-400">OPA v2.4 Active</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">|</span>
            <span>
              Gateway: <strong className="text-cyan-400">Secure</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">{tickerTime || "00:00:00 UTC"}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenArena}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-semibold tracking-wider uppercase rounded-lg bg-red-600/90 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-400/50 transition-all active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Battle Arena</span>
          </button>
        </div>
      </div>
    </header>
  );
}

