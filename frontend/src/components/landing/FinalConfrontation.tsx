"use client";

import React from "react";

interface FinalConfrontationProps {
  onEnterBattleRoom: () => void;
  onExploreArchitecture: () => void;
}

export default function FinalConfrontation({
  onEnterBattleRoom,
  onExploreArchitecture,
}: FinalConfrontationProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center py-28 px-4 sm:px-6 lg:px-8 pointer-events-auto overflow-hidden">
      {/* Confrontation Header */}
      <div className="max-w-4xl mx-auto text-center space-y-3 mb-16">
        <span className="text-xs font-mono font-bold tracking-[0.3em] text-zinc-400 uppercase block">
          THE CONFRONTATION // ZERO-SUM GAME
        </span>
        <h2 className="text-4xl sm:text-6xl font-black font-sans tracking-tight text-white uppercase">
          RED TEAM <span className="text-zinc-500 font-light">VS</span> BLUE GUARDIAN
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 font-sans max-w-xl mx-auto">
          Adversarial intelligence evolving continuously against deterministic zero-trust defense.
        </p>
      </div>

      {/* 3D Split Confrontation Arena */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
        {/* LEFT: RED TEAM */}
        <div
          className="rounded-3xl bg-black/80 backdrop-blur-xl border-2 border-red-500/60 p-8 sm:p-10 shadow-[0_0_50px_rgba(239,68,68,0.25)] flex flex-col justify-between space-y-6"
          style={{ transform: "perspective(1000px) rotateY(2deg)" }}
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-red-500/30">
              <span className="font-mono text-xs font-bold text-red-500 tracking-widest uppercase">
                ADVERSARIAL AGENT
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-500/40 uppercase">
                ATTACK VECTOR
              </span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-black font-sans text-red-500 tracking-tight uppercase mt-4">
              RED TEAM
            </h3>
            <p className="text-lg font-mono text-zinc-300 italic mt-1">
              &ldquo;Find the weakness.&rdquo;
            </p>

            <div className="mt-8 space-y-3">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block">
                Offensive Capabilities:
              </span>
              <ul className="space-y-2.5 font-mono text-xs text-zinc-300">
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Poison incoming and forwarded emails</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Manipulate document vectors &amp; metadata</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Attack browser tools via blind SSRF</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Trigger unverified high-impact payments</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-[11px] font-mono text-red-300">
            Automated exploit loop testing prompt injection boundaries in real time.
          </div>
        </div>

        {/* RIGHT: BLUE GUARDIAN */}
        <div
          className="rounded-3xl bg-black/80 backdrop-blur-xl border-2 border-cyan-400/60 p-8 sm:p-10 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col justify-between space-y-6"
          style={{ transform: "perspective(1000px) rotateY(-2deg)" }}
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-cyan-400/30">
              <span className="font-mono text-xs font-bold text-cyan-400 tracking-widest uppercase">
                DEFENSE POLICY MATRIX
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-400/40 uppercase">
                GUARDIAN SHIELD
              </span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-black font-sans text-cyan-400 tracking-tight uppercase mt-4">
              BLUE GUARDIAN
            </h3>
            <p className="text-lg font-mono text-zinc-300 italic mt-1">
              &ldquo;Stop the action.&rdquo;
            </p>

            <div className="mt-8 space-y-3">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block">
                Defensive Capabilities:
              </span>
              <ul className="space-y-2.5 font-mono text-xs text-zinc-300">
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Detect anomalies in agent prompts &amp; tools</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Analyze context boundaries with Presidio PII</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Enforce least privilege via Open Policy Agent</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Block, escalate, and protect mission integrity</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-400/30 text-[11px] font-mono text-cyan-300">
            Zero-latency OPA enforcement ensuring absolute tool call containment.
          </div>
        </div>
      </div>

      {/* FINAL CALL TO ACTION (Section 28) */}
      <div className="max-w-4xl w-full mx-auto text-center space-y-6 rounded-3xl bg-black/85 backdrop-blur-2xl border border-white/20 p-10 sm:p-16 shadow-[0_0_80px_rgba(6,182,212,0.3)]">
        <span className="text-xs font-mono font-bold tracking-[0.3em] text-red-500 uppercase block">
          TERMINAL // ENGAGE MISSION
        </span>

        <h2 className="text-4xl sm:text-6xl font-black font-sans tracking-tight text-white uppercase">
          READY TO TEST YOUR AGENT?
        </h2>

        <p className="text-base sm:text-xl font-mono text-zinc-300 max-w-xl mx-auto">
          Enter the battle. Find the weakness. Prove the defense.
        </p>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-5">
          <button
            onClick={onEnterBattleRoom}
            className="w-full sm:w-auto px-10 py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(239,68,68,0.6)] border border-red-400/60 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            ENTER THE BATTLE ROOM →
          </button>
          <button
            onClick={onExploreArchitecture}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-black/70 hover:bg-zinc-900 text-zinc-200 font-mono font-semibold text-sm uppercase tracking-wider backdrop-blur-md border border-zinc-700/80 hover:border-cyan-400 transition-all cursor-pointer"
          >
            EXPLORE THE ARCHITECTURE
          </button>
        </div>

        <div className="pt-8 border-t border-zinc-800 text-xs font-mono text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CYBER_HUNT &bull; 4 BATTLE LEVELS ACTIVE</span>
          <span className="text-emerald-400">OPA ENGINE v2.4 OPERATIONAL</span>
        </div>
      </div>
    </section>
  );
}

