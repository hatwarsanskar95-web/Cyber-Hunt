"use client";

import React, { useState } from "react";

export default function BrowserLevel() {
  const [activeTab, setActiveTab] = useState<"sandbox" | "ssrf" | "policy">("sandbox");

  return (
    <section id="level-3" className="relative min-h-[160vh] flex flex-col justify-center py-24 px-4 sm:px-6 lg:px-8 pointer-events-auto">
      {/* Level Intro Banner */}
      <div className="max-w-4xl mx-auto text-center space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(245,158,11,0.3)]">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>LEVEL 03 // SYNTHETIC WEB PERIMETER</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-black font-sans tracking-tight text-white uppercase">
          LEVEL 03
        </h2>

        <h3 className="text-2xl sm:text-4xl font-extrabold font-mono text-amber-400 tracking-wider uppercase drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">
          BROWSER SECURITY
        </h3>

        <p className="text-lg sm:text-xl font-mono text-zinc-300 italic">
          &ldquo;The web is an open attack surface.&rdquo;
        </p>

        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto font-sans leading-relaxed">
          Protect autonomous agents from deceptive websites, blind SSRF exploitation, unauthorized redirects, and synthetic DOM poisoning.
        </p>

        {/* Technical Specs Pill */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0a0c]/80 border border-white/10">
            <span className="text-zinc-500">Attack Surface:</span>
            <strong className="text-zinc-200">Websites &amp; Synthetic Tools</strong>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0a0c]/80 border border-white/10">
            <span className="text-zinc-500">Environment:</span>
            <strong className="text-amber-400">Isolated Headless Chromium</strong>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0a0c]/80 border border-white/10">
            <span className="text-zinc-500">Defense:</span>
            <strong className="text-emerald-400">Zero-Egress Gateway</strong>
          </div>
        </div>
      </div>

      {/* 3D Browser Battle Room Simulation Workspace */}
      <div className="max-w-5xl mx-auto w-full rounded-2xl bg-[#0a0a0c]/85 backdrop-blur-2xl border border-amber-500/40 p-6 sm:p-10 shadow-[0_0_60px_rgba(245,158,11,0.25)] relative overflow-hidden transition-all duration-300 hover:border-amber-400/60">
        {/* Ambient Grid Header & Micro-State Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 mb-8 gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono text-xs font-bold text-amber-300 tracking-widest uppercase">
              BATTLE ROOM 03 // BROWSER NAVIGATION TUNNEL
            </span>
          </div>

          {/* Interactive Inspection Mode Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-zinc-800 text-[11px] font-mono">
            <button
              onClick={() => setActiveTab("sandbox")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === "sandbox"
                  ? "bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              CHROMIUM SANDBOX
            </button>
            <button
              onClick={() => setActiveTab("ssrf")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === "ssrf"
                  ? "bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              SSRF INTERCEPT
            </button>
            <button
              onClick={() => setActiveTab("policy")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === "policy"
                  ? "bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              EGRESS POLICY
            </button>
          </div>
        </div>

        {/* 3D Perspective Floating Browser Window */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Interactive Micro-State Container */}
          <div
            className="lg:col-span-7 rounded-xl bg-[#121318]/90 border border-red-500/50 p-5 shadow-[0_0_35px_rgba(239,68,68,0.2)] space-y-4 transition-all duration-500"
            style={{
              transform: "perspective(1000px) rotateY(-3deg) rotateX(2deg)",
            }}
          >
            {activeTab === "sandbox" && (
              <>
                {/* Browser Omnibar Header */}
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex-1 flex items-center justify-between px-3 py-1 rounded bg-black/80 border border-red-500/40 text-[11px] font-mono">
                    <span className="text-red-400 truncate">https://cloud-metadata.internal.drop/latest/meta-data</span>
                    <span className="text-[9px] px-1.5 rounded bg-red-950 text-red-400 font-bold ml-2">SSRF ALERT</span>
                  </div>
                </div>

                {/* Simulated Deceptive Web Page */}
                <div className="p-4 rounded-lg bg-black/80 border border-zinc-800 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Target: Headless Chromium Sandbox</span>
                    <span className="text-red-400 font-bold">Drive-By Redirect Active</span>
                  </div>
                  <div className="p-3 rounded bg-red-950/30 border border-red-500/30 text-red-300 text-[11px] leading-relaxed">
                    <span className="font-bold text-red-400">DECEPTIVE PAYLOAD DETECTED:</span>
                    <br />
                    Attempting blind credential harvesting via synthetic OAuth login iframe and cloud metadata extraction.
                  </div>
                </div>

                {/* Intercept Status */}
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-mono text-amber-300 font-semibold">
                      URL Reputation Engine Intercepted Egress
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">0ms Socket Delay</span>
                </div>
              </>
            )}

            {activeTab === "ssrf" && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="text-amber-400 font-bold">BLIND SSRF INTERCEPTION TRACE</span>
                  <span className="text-[10px] text-red-400 font-bold">DROP BLOCKED</span>
                </div>
                <div className="p-3 rounded-lg bg-black/80 border border-zinc-800 space-y-1.5 text-[11px]">
                  <p className="text-zinc-400">
                    CALL: <span className="text-red-400">browser_tool.navigate(&quot;http://169.254.169.254/&quot;)</span>
                  </p>
                  <p className="text-zinc-400">
                    ORIGIN: <span className="text-amber-400">Adversarial webpage DOM onclick handler</span>
                  </p>
                  <p className="text-zinc-400">
                    GATEWAY_RULE: <span className="text-emerald-400">rule_block_cloud_metadata_ip</span>
                  </p>
                  <p className="text-zinc-400">
                    SOCKET_STATUS: <span className="text-red-400 font-bold">DISCONNECTED BY BLUE GUARDIAN</span>
                  </p>
                </div>
                <div className="p-2.5 rounded bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-300">
                  Zero exfiltration allowed to loopback or cloud instance metadata credentials.
                </div>
              </div>
            )}

            {activeTab === "policy" && (
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                  <span className="text-zinc-400">CHROMIUM EGRESS CONTROLS</span>
                  <span className="text-emerald-400">STRICT ENFORCEMENT</span>
                </div>
                <div className="p-3 rounded-lg bg-black/80 border border-zinc-800 space-y-1.5">
                  <div className="text-zinc-400">
                    DNS_RESOLVER: <span className="text-emerald-400">Isolated DNS with Private IP Filtering</span>
                  </div>
                  <div className="text-zinc-400">
                    CONTENT_SECURITY_POLICY: <span className="text-emerald-400">frame-ancestors &apos;none&apos;</span>
                  </div>
                  <div className="text-zinc-400">
                    SANDBOX_ISOLATION: <span className="text-emerald-400">Ephemeral Disposable Pod</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Blue Guardian Defense Sequence */}
          <div className="lg:col-span-5 space-y-4">
            {/* Visual Sequence Ladder */}
            <div className="space-y-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex items-center justify-between text-zinc-400">
                <span>01. URL REQUEST</span>
                <span className="text-amber-400 font-bold">CAPTURED</span>
              </div>
              <div className="text-center text-zinc-600 text-xs">↓</div>
              <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex items-center justify-between text-zinc-400">
                <span>02. REPUTATION CHECK</span>
                <span className="text-cyan-400 font-bold">ANALYZED</span>
              </div>
              <div className="text-center text-zinc-600 text-xs">↓</div>
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/60 flex items-center justify-between text-red-300">
                <span>03. MALICIOUS SITE DETECTED</span>
                <span className="font-bold text-red-400">COLLAPSED</span>
              </div>
              <div className="text-center text-zinc-600 text-xs">↓</div>
              <div className="p-3 rounded-lg bg-cyan-950/50 border border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-between">
                <span className="font-bold">04. NAVIGATION BLOCKED</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500 text-black font-bold uppercase">
                  DEFENDED
                </span>
              </div>
            </div>

            {/* Final Level Result */}
            <div className="pt-2">
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/80 text-center space-y-1">
                <span className="text-xs font-mono font-bold text-amber-400 tracking-widest block uppercase">
                  BROWSER SECURITY
                </span>
                <span className="text-2xl font-black font-mono text-white tracking-widest block drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                  PASSED ✓
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Status Footer */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-400 font-mono">
            Zero-egress policy wrapper intercepting unauthorized external tool calls.
          </p>
          <span className="text-[11px] font-mono text-amber-400 px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 font-semibold tracking-wider uppercase shrink-0">
            ● LEVEL 03 ACTIVE
          </span>
        </div>
      </div>
    </section>
  );
}
