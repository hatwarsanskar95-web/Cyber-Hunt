"use client";

import React from "react";

interface StorySectionProps {
  scrollProgress: number; // 0.0 to 0.22
  onScrollToProtocol: () => void;
}

export default function StorySection({ scrollProgress, onScrollToProtocol }: StorySectionProps) {
  // Normalize progress within 0..0.70 (The story scrub phase)
  const storyProgress = Math.min(1, Math.max(0, scrollProgress / 0.70));

  // Determine active story beat based on story progress
  // 0.0 - 0.25: Gate & Office
  // 0.25 - 0.50: Businessman & Computer
  // 0.50 - 0.75: The Compromise & AI Battle
  // 0.75 - 1.00: Business AI Agent Secured
  const isIntro = storyProgress < 0.28;
  const isCompromise = storyProgress >= 0.28 && storyProgress < 0.65;
  const isSecured = storyProgress >= 0.65;

  return (
    <section className="relative w-full h-[320vh] pointer-events-none">
      {/* Sticky Cinematic Viewport overlay for story subtitles & HUD */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-between p-6 sm:p-12 overflow-hidden pointer-events-none">
        {/* Top Minimal Telemetry Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-white font-bold tracking-widest uppercase">
              CYBER_HUNT // AI INCIDENT ZERO
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-zinc-500">
            <span>TIMELINE: 02:44:19 UTC</span>
            <span>CLEARANCE: LEVEL-4 RESTRICTED</span>
          </div>
        </div>

        {/* Center Dynamic Cinematic Typography */}
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Phase 1: The Office Cabin */}
          {isIntro && (
            <div className="space-y-4 animate-fade-in transition-all duration-700">
              <span className="inline-block text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 uppercase tracking-widest">
                ACT I // THE DIGITAL WORKER
              </span>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-sans uppercase">
                A BUSINESSMAN. <br />
                <span className="text-zinc-400">AN AUTONOMOUS AI.</span>
              </h1>
              <p className="max-w-xl mx-auto text-sm sm:text-lg text-zinc-300 font-sans leading-relaxed">
                Delegating real enterprise workflows. Processing invoices, triaging emails, navigating the web.
              </p>
              <div className="pt-2">
                <span className="text-xs font-mono text-zinc-500 tracking-wider">
                  ↓ SCROLL TO WITNESS THE ATTACK
                </span>
              </div>
            </div>
          )}

          {/* Phase 2: The Attack & The Clash */}
          {isCompromise && (
            <div className="space-y-4 animate-fade-in transition-all duration-700">
              <span className="inline-block text-xs font-mono px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-400 uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                ACT II // INTRUSION DETECTED
              </span>
              <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-red-500 font-sans uppercase drop-shadow-[0_0_35px_rgba(239,68,68,0.6)]">
                THE COMPROMISE.
              </h2>
              <p className="max-w-xl mx-auto text-sm sm:text-lg text-zinc-200 font-sans leading-relaxed">
                A poisoned instruction infiltrates the agent&apos;s context. The Red AI attempts to seize tool permissions.
              </p>
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-black/60 border border-red-500/30 text-xs font-mono text-red-300">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>RED AI ATTACKING &bull; BLUE GUARDIAN ENGAGED</span>
              </div>
            </div>
          )}

          {/* Phase 3: The Secured Outcome */}
          {isSecured && (
            <div className="space-y-6 animate-fade-in transition-all duration-700 pointer-events-auto">
              <span className="inline-block text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                ACT III // THREAT NEUTRALIZED
              </span>
              <div className="space-y-2">
                <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-sans uppercase">
                  BUSINESS AI AGENT
                </h2>
                <h3 className="text-3xl sm:text-5xl font-black font-sans text-cyan-400 tracking-wider uppercase drop-shadow-[0_0_30px_rgba(6,182,212,0.8)]">
                  SECURED.
                </h3>
              </div>
              <p className="max-w-2xl mx-auto text-base sm:text-xl text-zinc-200 font-sans leading-relaxed">
                AI agents are becoming capable of doing real work.
                <br />
                <strong className="text-white">Our security system makes sure they do that work safely.</strong>
              </p>

              {/* Seamless CTA to dive into the 4 security levels */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={onScrollToProtocol}
                  className="px-8 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(6,182,212,0.6)] border border-cyan-400/60 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  ENTER SECURITY PROTOCOL ↓
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Scroll Milestone Indicator */}
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-white/5 pt-3">
          <div className="flex items-center gap-2">
            <span>PHASE:</span>
            <span className="text-zinc-300 font-semibold uppercase">
              {isIntro ? "01 / Office Ingress" : isCompromise ? "02 / Kernel Combat" : "03 / Perimeter Locked"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>CONTINUOUS CINEMATIC SCROLL</span>
          </div>
        </div>
      </div>
    </section>
  );
}

