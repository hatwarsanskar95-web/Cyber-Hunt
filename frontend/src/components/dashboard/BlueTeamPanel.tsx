"use client";

import type { BlueTeamState } from "@/types/dashboard";

interface BlueTeamPanelProps {
  blueTeam: BlueTeamState;
}

const STAGES = [
  {
    stageNum: 1,
    label: "Email Captured",
    description: "New email intercepted from real inbox",
  },
  {
    stageNum: 2,
    label: "Threat Analysis",
    description: "Scanning for phishing, prompt injection, and payment fraud...",
  },
  {
    stageNum: 3,
    label: "Policy Evaluation (OPA)",
    description: "Checking against security policies...",
  },
  {
    stageNum: 4,
    label: "Final Decision",
    description: "Block, Allow or Require Approval",
  },
];

export default function BlueTeamPanel({ blueTeam }: BlueTeamPanelProps) {
  const currentStage = blueTeam.stage;
  const analysisPct = Math.min(100, Math.max(0, blueTeam.analysisProgress || 75));

  // Determine risk level text and badge style
  const riskLevel =
    blueTeam.severity?.toUpperCase() ||
    (blueTeam.risk_score >= 70 ? "HIGH" : blueTeam.risk_score >= 40 ? "MEDIUM" : "LOW");

  const riskBadgeClass =
    riskLevel === "HIGH" || riskLevel === "CRITICAL"
      ? "bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider glow-red"
      : riskLevel === "MEDIUM"
      ? "bg-amber-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider"
      : "bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider";

  // Threats found label
  const threatsLabel =
    blueTeam.threat_indicators && blueTeam.threat_indicators.length > 0
      ? blueTeam.threat_indicators.join(", ")
      : currentStage >= 2
      ? "Possible Phishing"
      : "None detected yet";

  // Action decision display
  const actionLabel = blueTeam.decision
    ? blueTeam.decision
    : currentStage >= 3
    ? "Evaluating..."
    : "Pending";

  const actionColorClass =
    blueTeam.decision === "BLOCK"
      ? "text-red-400 font-medium font-mono"
      : blueTeam.decision === "ALLOW"
      ? "text-emerald-400 font-medium font-mono"
      : "text-amber-400 font-medium font-mono";

  return (
    <section className="lg:col-span-3 flex flex-col gap-3" data-purpose="right-sidebar">
      {/* Blue Team Stepper Card */}
      <div className="cyber-card rounded-xl p-4 border border-[#1c243a] flex flex-col space-y-4">
        {/* Blue Team Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-sky-900/40 border border-sky-400/50 flex items-center justify-center text-sky-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">Blue Team</h3>
          </div>
          <span className="bg-emerald-950 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
            Active
          </span>
        </div>

        {/* Vertical Stepper Workflow */}
        <div className="relative flex flex-col space-y-4 pl-1">
          {/* Continuous vertical connecting line */}
          <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-slate-800" />

          {STAGES.map((step) => {
            const isCompleted = currentStage > step.stageNum || (currentStage === 4 && step.stageNum === 4 && blueTeam.decision !== null);
            const isActive = currentStage === step.stageNum && !isCompleted;
            const isPending = currentStage < step.stageNum;

            if (isCompleted) {
              return (
                <div key={step.stageNum} className="relative flex items-start space-x-3 group">
                  <div className="relative z-10 w-6 h-6 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center text-xs shadow glow-green shrink-0">
                    ✓
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white leading-tight">{step.label}</h5>
                    <p className="text-[10px] text-slate-400">{step.description}</p>
                  </div>
                </div>
              );
            }

            if (isActive) {
              return (
                <div
                  key={step.stageNum}
                  className="relative flex items-start space-x-3 bg-violet-950/20 border border-purple-800/40 p-2 rounded-lg -ml-1"
                >
                  <div className="relative z-10 w-6 h-6 rounded-full bg-purple-900 border-2 border-purple-400 text-white flex items-center justify-center text-[10px] shadow glow-purple animate-pulse shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div className="w-full">
                    <h5 className="text-xs font-semibold text-purple-200 leading-tight">
                      {step.label}
                    </h5>
                    <p className="text-[10px] text-slate-300 leading-tight mt-0.5">
                      {step.description}
                    </p>
                    {/* Mini inline progress bar for active threat analysis */}
                    {step.stageNum === 2 && (
                      <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 border border-purple-900 overflow-hidden">
                        <div
                          className="bg-purple-500 h-1.5 rounded-full animate-pulse transition-all duration-300"
                          style={{ width: `${analysisPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Pending step
            return (
              <div key={step.stageNum} className="relative flex items-start space-x-3 opacity-60">
                <div className="relative z-10 w-6 h-6 rounded-full bg-[#121829] border border-slate-700 text-slate-500 flex items-center justify-center text-xs shrink-0">
                  {step.stageNum}
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-slate-300 leading-tight">{step.label}</h5>
                  <p className="text-[10px] text-slate-500">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detection Status Card */}
      <div
        className="cyber-card rounded-xl p-4 border border-[#1c243a] flex flex-col space-y-3.5"
        data-purpose="detection-status-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
              {/* Pulse ECG wave icon */}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">Detection Status</h3>
          </div>
          <span className="bg-purple-950/70 text-purple-300 border border-purple-600/30 text-[10px] font-medium px-2 py-0.5 rounded-full">
            {currentStage >= 4 ? "Completed" : "Analyzing..."}
          </span>
        </div>

        {/* Key Detection Metrics Table */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Risk Level</span>
            <span className={riskBadgeClass}>{riskLevel}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Threats Found</span>
            <span className="text-red-400 font-medium truncate max-w-[150px]">{threatsLabel}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-400">Action (OPA)</span>
            <span className={actionColorClass}>{actionLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
