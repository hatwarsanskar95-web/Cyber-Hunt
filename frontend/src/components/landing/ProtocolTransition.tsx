"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProtocolTransition() {
  const [clicked, setClicked] = useState(false);
  const router = useRouter();

  const handleGetStartedClick = () => {
    setClicked(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 350);
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center py-24 px-4 sm:px-6 lg:px-8 text-center pointer-events-auto overflow-hidden">
      {/* 3D Cyber Convergence Lines */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <div className="w-[800px] h-[800px] rounded-full border border-cyan-500/20 animate-pulse" />
        <div className="absolute w-[600px] h-[600px] rounded-full border border-blue-500/20" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-cyan-400/30" />
      </div>

      {/* Blue Guardian Hologram Sigil */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-cyan-950/80 border-2 border-cyan-400/80 shadow-[0_0_50px_rgba(6,182,212,0.8)] flex items-center justify-center transform rotate-45">
          <svg className="w-10 h-10 text-cyan-300 transform -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <span className="absolute -inset-4 rounded-full border border-cyan-400/30 animate-ping pointer-events-none" />
      </div>

      {/* Titles */}
      <div className="relative z-10 max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-mono font-bold tracking-[0.3em] text-cyan-400 uppercase block">
          FACILITY INGRESS // DEFENSE GRID
        </span>

        <h2 className="text-4xl sm:text-6xl font-black font-sans tracking-tight text-white uppercase [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]">
          SECURITY PROTOCOL
        </h2>

        <h3 className="text-2xl sm:text-4xl font-extrabold font-mono tracking-wider text-cyan-400 uppercase [text-shadow:0_0_25px_rgba(6,182,212,0.7),0_2px_8px_rgba(0,0,0,0.9)]">
          4 BATTLE LEVELS
        </h3>

        <p className="text-sm sm:text-base text-zinc-200 font-sans max-w-xl mx-auto pt-1 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
          Test the agent. Break the attack. Prove the defense.
        </p>
      </div>

      {/* 4 Tactical Level Display Cards */}
      <div className="relative z-10 mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl w-full">
        {[
          { id: 1, name: "EMAIL SECURITY", sub: "Real Gmail", color: "border-cyan-500/70 text-cyan-400 bg-[#0a0f1d]/90 shadow-[0_0_20px_rgba(6,182,212,0.18)]" },
          { id: 2, name: "FILE SECURITY", sub: "Simulated Documents", color: "border-purple-500/70 text-purple-400 bg-[#0a0f1d]/90 shadow-[0_0_20px_rgba(168,85,247,0.18)]" },
          { id: 3, name: "BROWSER SECURITY", sub: "Simulated Web", color: "border-amber-500/70 text-amber-400 bg-[#0a0f1d]/90 shadow-[0_0_20px_rgba(245,158,11,0.18)]" },
          { id: 4, name: "FINANCIAL SECURITY", sub: "Mock Payments", color: "border-red-500/70 text-red-400 bg-[#0a0f1d]/90 shadow-[0_0_20px_rgba(239,68,68,0.18)]" },
        ].map((path) => (
          <div
            key={path.id}
            className={`p-5 rounded-2xl border backdrop-blur-sm ${path.color} flex flex-col items-center justify-between text-center transition-all duration-300 hover:scale-105`}
          >
            <span className="text-[10px] font-mono text-zinc-400 tracking-widest block uppercase font-semibold">
              PATHWAY 0{path.id}
            </span>
            <span className="text-sm sm:text-base font-bold font-sans tracking-tight mt-3 text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
              {path.name}
            </span>
            <span className="text-[11px] font-mono text-zinc-300 mt-1.5 font-medium">
              {path.sub}
            </span>
            <div className="mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-semibold">ACTIVE</span>
            </div>
          </div>
        ))}
      </div>

      {/* Prominent "Get Started" CTA Button (Pure action button, does not lead to any dashboard) */}
      <div className="relative z-10 mt-12 flex flex-col items-center justify-center space-y-3">
        <button
          type="button"
          onClick={handleGetStartedClick}
          className={`px-10 py-4 rounded-xl font-mono font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 cursor-pointer border shadow-2xl active:scale-95 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)] ${
            clicked
              ? "bg-emerald-500 text-black border-emerald-300 shadow-[0_0_50px_rgba(16,185,129,0.8)] scale-105"
              : "bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white border-red-400/80 shadow-[0_0_35px_rgba(239,68,68,0.6)] hover:scale-105 hover:shadow-[0_0_50px_rgba(239,68,68,0.8)]"
          }`}
        >
          {clicked ? "SYSTEM INITIALIZED ✓" : "GET STARTED →"}
        </button>
        <span className="text-[10px] font-mono text-zinc-400 tracking-wider font-semibold">
          ZERO-TRUST SENTINEL READY
        </span>
      </div>

      {/* Minimal Industrial Footer */}
      <footer className="relative z-10 mt-16 pt-8 border-t border-white/10 w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-zinc-300 font-bold tracking-wider">CYBER_HUNT</span>
          <span className="text-zinc-600">{"//"}</span>
          <span>AI AGENT ZERO-TRUST DEFENSE SYSTEM</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-zinc-400">
          <span>REAL GMAIL</span>
          <span>PRESIDIO PII</span>
          <span>BROWSER SANDBOX</span>
          <span>OPA v2.4</span>
        </div>
      </footer>
    </section>
  );
}
