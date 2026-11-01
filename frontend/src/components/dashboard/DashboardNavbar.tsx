"use client";

import type { DashboardView } from "@/types/dashboard";

interface NavItem {
  id: DashboardView;
  label: string;
  icon: React.ReactNode;
  hasDot?: boolean;
}

interface DashboardNavbarProps {
  view: DashboardView;
  onViewChange: (v: DashboardView) => void;
  wsConnected: boolean;
  inboxBadge?: number;
}

export default function DashboardNavbar({
  view,
  onViewChange,
  wsConnected,
  inboxBadge = 0,
}: DashboardNavbarProps) {
  const items: NavItem[] = [
    {
      id: "home",
      label: "Dashboard",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      id: "simulation",
      label: "Level 1: Email",
      hasDot: inboxBadge > 0,
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      id: "files",
      label: "Level 2: Files",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      id: "browser",
      label: "Level 3: Browser",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      id: "payment",
      label: "Level 4: Payment",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect height="14" rx="2" width="20" x="2" y="5" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    },
  ];

  return (
    <header
      className="w-full bg-[#0d121f] border border-[#1c243a] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg"
      data-purpose="top-navigation"
    >
      {/* Left: Logo & Branding */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-800 p-0.5 flex items-center justify-center shadow-lg shadow-purple-900/40">
          <div className="w-full h-full bg-[#0c101d] rounded-[7px] flex items-center justify-center">
            {/* Hexagonal shield cyber logo */}
            <svg
              className="w-5 h-5 text-purple-400"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-wider text-white leading-tight uppercase font-mono">
            Cyber Hunt
          </h1>
          <p className="text-[11px] font-medium text-slate-400 leading-none tracking-normal">
            AI Security Simulation
          </p>
        </div>
      </div>

      {/* Center: Navigation Pill Tabs */}
      <nav className="flex items-center space-x-1.5 overflow-x-auto py-1">
        {items.map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={
                isActive
                  ? "flex items-center space-x-2 bg-gradient-to-r from-purple-700 to-indigo-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-purple-800/40 transition hover:brightness-110"
                  : "flex items-center space-x-1.5 bg-[#141b2d] hover:bg-[#1a233b] text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#232e4d] transition"
              }
            >
              <span className={isActive ? "text-white" : "text-slate-400"}>{item.icon}</span>
              <span>{item.label}</span>
              {item.hasDot && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Live Simulation Pill */}
      <div className="flex items-center">
        {wsConnected ? (
          <div className="flex items-center space-x-2 bg-[#0d1f1f] text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-medium border border-emerald-900/60 shadow-inner">
            <svg
              className="w-3.5 h-3.5 animate-pulse text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M13 10V3L4 14h7v7l9-11h-7z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Live Simulation</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 bg-[#1b1722] text-slate-400 px-3.5 py-1.5 rounded-full text-xs font-medium border border-slate-700/40">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Simulation Standby</span>
          </div>
        )}
      </div>
    </header>
  );
}
