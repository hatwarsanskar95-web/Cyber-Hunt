"use client";

import React, { useState } from "react";
import { TacticalLevel } from "./LevelCard";
import { MissionConfig } from "./MissionDrawer";
import EmailSecurityView from "./battle-views/EmailSecurityView";
import FileSecurityView from "./battle-views/FileSecurityView";
import BrowserSecurityView from "./battle-views/BrowserSecurityView";
import FinancialSecurityView from "./battle-views/FinancialSecurityView";

interface BattleArenaProps {
  level: TacticalLevel;
  config: MissionConfig;
  onClose: () => void;
}

export default function BattleArena({ level, onClose }: BattleArenaProps) {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4>(level.id);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#04060c]/98 backdrop-blur-2xl text-white overflow-y-auto pointer-events-auto">
      {/* Top Navigation Bar with Level Switcher */}
      <header className="sticky top-0 z-50 flex-none px-4 sm:px-8 py-3 bg-[#080b14]/90 backdrop-blur-md border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        {/* Back Button & System Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-mono transition-colors cursor-pointer"
          >
            <span>←</span>
            <span>Exit to Mission Control</span>
          </button>

          <span className="text-zinc-600 hidden sm:inline">|</span>

          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs font-bold text-cyan-400 tracking-wider uppercase">
              BATTLE ARENA // RED VS BLUE
            </span>
          </div>
        </div>

        {/* 4 Level Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-zinc-800 text-xs font-sans overflow-x-auto">
          {[
            { id: 1 as const, name: "Email Security", icon: "✉" },
            { id: 2 as const, name: "File Security", icon: "📁" },
            { id: 3 as const, name: "Browser Security", icon: "🌐" },
            { id: 4 as const, name: "Financial Security", icon: "💳" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Live Defense Status Badge */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            GUARDIAN DEFENSE ACTIVE
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Dashboard Canvas matching the user's uploaded images */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8 flex flex-col justify-center items-center">
        {activeTab === 1 && <EmailSecurityView />}
        {activeTab === 2 && <FileSecurityView />}
        {activeTab === 3 && <BrowserSecurityView />}
        {activeTab === 4 && <FinancialSecurityView />}
      </div>
    </div>
  );
}
