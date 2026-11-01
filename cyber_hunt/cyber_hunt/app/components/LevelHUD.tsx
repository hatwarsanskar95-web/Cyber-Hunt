"use client";

import React from "react";

interface LevelHUDProps {
  activeLevel: number; // 0 (Story), 1 (Email), 2 (Files), 3 (Browser), 4 (Finance), 5 (Master)
  onSelectLevel: (level: number) => void;
}

const LEVELS = [
  { id: 1, label: "EMAIL", sub: "L01" },
  { id: 2, label: "FILES", sub: "L02" },
  { id: 3, label: "BROWSER", sub: "L03" },
  { id: 4, label: "FINANCE", sub: "L04" },
];

export default function LevelHUD({ activeLevel, onSelectLevel }: LevelHUDProps) {
  // Hide during opening scene or show with low opacity
  const isVisible = activeLevel >= 1;

  return (
    <aside
      aria-label="Level progression"
      className={`fixed right-6 top-1/2 -translate-y-1/2 z-40 transition-all duration-700 pointer-events-auto select-none hidden md:block ${
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6 pointer-events-none"
      }`}
    >
      <div className="flex flex-col items-end space-y-5 bg-black/40 backdrop-blur-md px-3.5 py-4 rounded-2xl border border-white/5 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
        <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase pb-1 border-b border-zinc-800/80 w-full text-right">
          VECTOR // HUD
        </span>

        {LEVELS.map((lvl) => {
          const isActive = activeLevel === lvl.id;
          const isCompleted = activeLevel > lvl.id;

          return (
            <button
              key={lvl.id}
              onClick={() => onSelectLevel(lvl.id)}
              className="group flex items-center space-x-3 text-right cursor-pointer transition-all focus:outline-none"
              title={`Jump to Level 0${lvl.id} — ${lvl.label}`}
            >
              <div className="flex flex-col items-end">
                <span
                  className={`text-[11px] font-mono font-bold tracking-wider transition-colors ${
                    isActive
                      ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                      : isCompleted
                      ? "text-zinc-300 group-hover:text-white"
                      : "text-zinc-600 group-hover:text-zinc-400"
                  }`}
                >
                  {lvl.label}
                </span>
                <span className="text-[9px] font-mono text-zinc-500">
                  {lvl.sub}
                </span>
              </div>

              {/* Status node */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                    isActive
                      ? "bg-cyan-500 border-cyan-300 scale-125 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                      : isCompleted
                      ? "bg-blue-900 border-blue-500"
                      : "bg-zinc-900 border-zinc-700 group-hover:border-zinc-500"
                  }`}
                />
                {isActive && (
                  <span className="absolute -inset-1 rounded-full bg-cyan-400/40 animate-ping" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

