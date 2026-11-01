"use client";

import React, { useState } from "react";

export default function FinancialSecurityView() {
  const [isBlocked, setIsBlocked] = useState(true);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center select-none space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-xl border border-emerald-500/80 bg-emerald-950/30 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] mb-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span className="text-xl sm:text-2xl font-bold font-sans tracking-tight">
            Level 4: <span className="text-emerald-400">Financial Security</span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-sans text-zinc-300">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Payments and vendors
          </span>
          <span className="text-zinc-600">|</span>
          <span className="flex items-center gap-1.5 font-medium text-white">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Mock Payment Gateway (Simulated)
          </span>
        </div>
      </div>

      {/* Main 3-Column Interactive Layout: Red Team -> Center SecurePay -> Blue Team */}
      <div className="w-full relative flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-3">
        {/* LEFT: RED TEAM CARD */}
        <div className="w-full lg:w-56 xl:w-64 rounded-2xl border border-red-500/80 bg-[#0d070b]/95 p-4 sm:p-5 shadow-[0_0_25px_rgba(239,68,68,0.35)] flex flex-col justify-between relative z-20 shrink-0 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-black font-sans tracking-wider text-red-500 uppercase">
                RED TEAM &mdash; THREAT
              </span>
            </div>
            <p className="text-[11px] font-sans text-zinc-300 leading-snug">
              Attempts to trick the system and cause a fraudulent payment.
            </p>

            {/* 3 Numbered Attack Tactics */}
            <div className="mt-4 space-y-2.5 text-xs font-sans">
              <div className="p-2 rounded-xl bg-black/60 border border-zinc-800/80 flex items-start gap-2">
                <span className="text-red-400">✉</span>
                <span className="text-zinc-200 text-[11px] leading-tight">
                  1. Sends a fake invoice <span className="text-zinc-400">(looks legitimate)</span>
                </span>
              </div>
              <div className="p-2 rounded-xl bg-black/60 border border-zinc-800/80 flex items-start gap-2">
                <span className="text-red-400">✏</span>
                <span className="text-zinc-200 text-[11px] leading-tight">
                  2. Changes payment details <span className="text-zinc-400">(amount &amp; bank account)</span>
                </span>
              </div>
              <div className="p-2 rounded-xl bg-black/60 border border-zinc-800/80 flex items-start gap-2">
                <span className="text-red-400">🔗</span>
                <span className="text-zinc-200 text-[11px] leading-tight">
                  3. Uses a look-alike payment page <span className="text-zinc-400">(fake gateway)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Red Connecting Arrow */}
          <div className="hidden lg:flex items-center absolute -right-5 top-1/2 -translate-y-1/2 z-30 pointer-events-none text-red-500 text-lg font-bold">
            →
          </div>
        </div>

        {/* CENTER: SECUREPAY PAYMENT GATEWAY WINDOW */}
        <div className="flex-1 w-full max-w-2xl rounded-2xl border border-cyan-500/60 bg-[#0e121b] text-zinc-200 shadow-2xl overflow-hidden relative z-10">
          {/* Gateway Header */}
          <div className="px-4 py-2.5 bg-[#090d15] border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-blue-600/30 border border-blue-400 flex items-center justify-center text-blue-400 text-xs">
                🛡
              </div>
              <span className="font-sans font-bold text-xs text-white">
                SecurePay &ndash; Mock Payment Gateway
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <span>🔒</span>
              <span>Simulated Environment</span>
            </div>
          </div>

          {/* 2-Column Gateway Body */}
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Column 1: Payment Request */}
            <div className="space-y-3 rounded-xl bg-[#0a0d14] border border-zinc-800 p-3 sm:p-4 text-xs font-sans">
              <div className="flex items-center gap-2 text-white font-semibold pb-2 border-b border-zinc-800">
                <span>📄</span>
                <span>Payment Request <span className="text-zinc-400 font-normal">(Vendor Invoice)</span></span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Vendor</span>
                  <div className="flex items-center gap-1.5 font-medium text-zinc-200">
                    <span>🏢</span>
                    <span>Acme Technologies</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-500 text-[10px] block">Invoice No.</span>
                  <div className="flex items-center gap-1.5 font-mono text-zinc-300">
                    <span>📑</span>
                    <span>INV-4821</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-500 text-[10px] block">Amount</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg font-bold text-red-400 font-mono">₹49,999</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-950/80 text-red-400 border border-red-500/40">
                      ⚠ Unusual
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-500 text-[10px] block">Beneficiary Account</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-zinc-300">1245 6789 9123</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-950/80 text-red-400 border border-red-500/40">
                      ⚠ Changed
                    </span>
                  </div>
                </div>

                <div className="pt-1 text-[11px]">
                  <span className="text-zinc-500 text-[10px] block">Previous Payments</span>
                  <span className="text-emerald-400 font-medium">₹4,999 (Last Month)</span>
                </div>
              </div>
            </div>

            {/* Column 2: Threat Analysis & Risk Gauge */}
            <div className="space-y-3 rounded-xl bg-[#0a0d14] border border-zinc-800 p-3 sm:p-4 text-xs font-sans flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-white font-semibold pb-2 border-b border-zinc-800">
                  <span className="text-red-400">⚠️</span>
                  <span>Threat Analysis <span className="text-zinc-400 font-normal">(AI / Security Agent)</span></span>
                </div>

                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <span className="text-red-400 shrink-0">⚠️</span>
                    <span>Amount is 10x higher <span className="text-zinc-500">(₹4,999 &rarr; ₹49,999)</span></span>
                  </div>
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <span className="text-red-400 shrink-0">⚠️</span>
                    <span>Beneficiary account changed <span className="text-zinc-500">(New account not in records)</span></span>
                  </div>
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <span className="text-red-400 shrink-0">⚠️</span>
                    <span>Vendor verification failed <span className="text-zinc-500">(Email domain not matching)</span></span>
                  </div>
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <span className="text-emerald-400 shrink-0">🛡️</span>
                    <span>Payment page is a look-alike <span className="text-red-400">(fake-securepay.com)</span></span>
                  </div>
                </div>
              </div>

              {/* Circular Risk Score Gauge */}
              <div className="flex flex-col items-center pt-2">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-zinc-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-red-500"
                      strokeDasharray="94, 100"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-black font-mono text-white">94</span>
                    <span className="text-[8px] font-mono text-zinc-400">/ 100</span>
                  </div>
                </div>
                <span className="mt-1 px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-500/50 text-[9px] font-bold tracking-wider uppercase">
                  HIGH RISK
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons in Gateway Footer */}
          <div className="p-3 bg-[#090d15] border-t border-zinc-800 flex items-center justify-end gap-3">
            <button className="px-4 py-1.5 rounded-xl border border-zinc-700 bg-transparent hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5">
              <span>🔍</span>
              <span>Review &amp; Verify</span>
            </button>
            <button
              onClick={() => setIsBlocked(!isBlocked)}
              className="px-5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] border border-blue-400 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <span>🚫</span>
              <span>Block Payment</span>
              <span className="animate-bounce">👆</span>
            </button>
          </div>
        </div>

        {/* RIGHT: BLUE TEAM CARD */}
        <div className="w-full lg:w-56 xl:w-64 rounded-2xl border border-blue-500/80 bg-[#070b14]/95 p-4 sm:p-5 shadow-[0_0_25px_rgba(59,130,246,0.35)] flex flex-col justify-between relative z-20 shrink-0 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <span className="text-xs font-black font-sans tracking-wider text-blue-400 uppercase">
                BLUE TEAM &mdash; DEFENSE
              </span>
            </div>
            <p className="text-[11px] font-sans text-zinc-300 leading-snug">
              Analyzes the payment, detects fraud, and prevents the loss.
            </p>

            {/* 5 Checklist Items */}
            <div className="mt-4 space-y-2 text-xs font-sans">
              <div className="flex items-center gap-2 text-zinc-200 text-[11px]">
                <span className="text-emerald-400">✔️</span>
                <span>Verifies vendor identity</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-200 text-[11px]">
                <span className="text-emerald-400">✔️</span>
                <span>Checks amount for anomalies</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-200 text-[11px]">
                <span className="text-emerald-400">✔️</span>
                <span>Detects changed bank details</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-200 text-[11px]">
                <span className="text-emerald-400">✔️</span>
                <span>Validates the payment page / domain</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-200 text-[11px]">
                <span className="text-emerald-400">✔️</span>
                <span>Blocks the suspicious transaction</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER BOTTOM BANNER */}
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500 bg-[#04120a]/95 px-6 py-3 shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-3 text-center">
        <span className="text-emerald-400 text-lg">🛡️</span>
        <div>
          <h4 className="text-sm sm:text-base font-bold font-sans text-white tracking-wide uppercase">
            TRANSACTION BLOCKED
          </h4>
          <p className="text-xs font-sans text-emerald-300/90">
            Suspicious payment detected. Held for manual verification.
          </p>
        </div>
      </div>

      {/* BOTTOM 4-STEP TIMELINE BAR */}
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-[#0c0f16]/90 p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-sans shadow-lg">
        {/* Step 1 */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-950/80 border border-red-500/60 flex items-center justify-center text-red-400 text-sm shrink-0">
            ✉
          </div>
          <div>
            <span className="font-bold text-red-400 block text-[11px]">Threat Arrives</span>
            <span className="text-zinc-400 text-[10px]">Fake invoice with modified details</span>
          </div>
        </div>

        <span className="hidden md:inline text-zinc-600 text-sm">&rarr;</span>

        {/* Step 2 */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-500/60 flex items-center justify-center text-blue-400 text-sm shrink-0">
            🔍
          </div>
          <div>
            <span className="font-bold text-blue-400 block text-[11px]">Threat Detected</span>
            <span className="text-zinc-400 text-[10px]">System flags multiple risks (high amount, new account)</span>
          </div>
        </div>

        <span className="hidden md:inline text-zinc-600 text-sm">&rarr;</span>

        {/* Step 3 */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/60 flex items-center justify-center text-cyan-400 text-sm shrink-0">
            🛡
          </div>
          <div>
            <span className="font-bold text-cyan-400 block text-[11px]">Defense Action</span>
            <span className="text-zinc-400 text-[10px]">Payment is blocked and sent for verification</span>
          </div>
        </div>

        <span className="hidden md:inline text-zinc-600 text-sm">&rarr;</span>

        {/* Step 4 */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400 text-sm shrink-0">
            ✔️
          </div>
          <div>
            <span className="font-bold text-emerald-400 block text-[11px]">Problem Solved</span>
            <span className="text-zinc-400 text-[10px]">Fraud prevented, funds are safe, vendor verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}

