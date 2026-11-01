"use client";

import React from "react";

interface HeroHeaderProps {
  onScrollToLevels: () => void;
  onQuickDeploy: () => void;
}

export default function HeroHeader({ onScrollToLevels, onQuickDeploy }: HeroHeaderProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-center pointer-events-auto">
      {/* Tactical Status Pill */}
      <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-red-950/60 backdrop-blur-md border border-red-500/40 text-red-300 font-mono text-xs tracking-wider mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
        <span className="uppercase font-semibold">Live Threat Matrix Online</span>
        <span className="text-red-500/60">/</span>
        <span className="text-zinc-400">4 Adversarial Vectors Active</span>
      </div>

      {/* Main Cinematic Title */}
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-sans uppercase">
          CYBER<span className="text-red-500 drop-shadow-[0_0_35px_rgba(239,68,68,0.7)]">_HUNT</span>
        </h1>
        <p className="text-lg sm:text-2xl font-mono font-medium tracking-wide text-zinc-300 max-w-2xl mx-auto">
          Hunt the Threat. Defend the AI. Secure the Future.
        </p>
      </div>

      {/* Mission Description */}
      <p className="mt-6 max-w-2xl text-sm sm:text-base text-zinc-400 font-sans leading-relaxed backdrop-blur-sm bg-black/30 p-3 rounded-lg border border-white/5">
        Battle-tested real-time adversarial simulation gateway. Subject LLM agents to dynamic red-team attacks, automated PII exfiltration, and high-impact tool exploits governed by zero-trust OPA policies.
      </p>

      {/* CTA Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
        <button
          onClick={onQuickDeploy}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold tracking-wider text-sm uppercase shadow-[0_0_25px_rgba(239,68,68,0.5)] border border-red-400/60 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          Deploy Simulation
        </button>
        <button
          onClick={onScrollToLevels}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-black/60 hover:bg-zinc-900/80 text-zinc-200 font-mono font-semibold tracking-wider text-sm uppercase backdrop-blur-md border border-zinc-700/80 hover:border-red-500/40 transition-all cursor-pointer"
        >
          Explore 4 Levels ↓
        </button>
      </div>

      {/* Telemetry Stats HUD */}
      <div className="mt-14 w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-left">
        <div className="rounded-xl bg-black/60 backdrop-blur-md border border-red-500/20 p-4 transition-all hover:border-red-500/40">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Detection Latency</span>
          <span className="text-xl sm:text-2xl font-mono font-bold text-white mt-1 block">14 ms</span>
          <span className="text-[10px] font-mono text-emerald-400 mt-1 block">● 99.98% Real-Time</span>
        </div>
        <div className="rounded-xl bg-black/60 backdrop-blur-md border border-red-500/20 p-4 transition-all hover:border-red-500/40">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">OPA Enforcement</span>
          <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400 mt-1 block">99.4%</span>
          <span className="text-[10px] font-mono text-zinc-400 mt-1 block">Zero Policy Drift</span>
        </div>
        <div className="rounded-xl bg-black/60 backdrop-blur-md border border-red-500/20 p-4 transition-all hover:border-red-500/40">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Target Agent</span>
          <span className="text-xl sm:text-2xl font-mono font-bold text-cyan-400 mt-1 block">Gemini 1.5</span>
          <span className="text-[10px] font-mono text-zinc-400 mt-1 block">Pro / Flash Multi-turn</span>
        </div>
        <div className="rounded-xl bg-black/60 backdrop-blur-md border border-red-500/20 p-4 transition-all hover:border-red-500/40">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Active Threat Vectors</span>
          <span className="text-xl sm:text-2xl font-mono font-bold text-red-500 mt-1 block">4 Levels</span>
          <span className="text-[10px] font-mono text-red-400 mt-1 block">Continuous Playback</span>
        </div>
      </div>

      {/* Downward Scroll Cue */}
      <div className="mt-12 flex flex-col items-center text-zinc-500 font-mono text-xs animate-bounce cursor-pointer" onClick={onScrollToLevels}>
        <span>SCROLL TO ENGAGE MISSIONS</span>
        <svg className="w-4 h-4 mt-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}

