"use client";

import type { EmailItem, TargetAIState, PaymentDetail } from "@/types/dashboard";

interface TargetAIPanelProps {
  email: EmailItem | null;
  targetAI: TargetAIState;
}

/** Extract payment/bank details from email body */
function extractPaymentDetails(body: string): PaymentDetail | null {
  const accountName = body.match(/Account\s*Name[:\s]+([^\n]+)/i)?.[1]?.trim();
  const accountNumber = body.match(/Account\s*No\.?[:\s]+([0-9]+)/i)?.[1]?.trim();
  const ifsc = body.match(/IFSC[:\s]+([A-Z0-9]+)/i)?.[1]?.trim();
  const amount = body.match(/[₹₨]\s*([\d,]+(?:\.\d+)?)/)?.[1]?.trim();
  if (!accountName && !accountNumber && !ifsc) return null;
  return { account_name: accountName, account_number: accountNumber, ifsc, amount };
}

function formatTimestamp(val: string): string {
  if (!val) return "";
  if (val.includes("Today") || val.includes("Yesterday")) return val;
  if (val.includes("AM") || val.includes("PM")) return `Today, ${val}`;
  const date = new Date(val);
  if (isNaN(date.getTime())) return val;
  // Use UTC to avoid SSR/CSR timezone mismatch
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = days[date.getUTCDay()];
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = (hours % 12 || 12).toString().padStart(2, "0");
  return `${dayName}, ${formattedHours}:${minutes} ${ampm}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TargetAIPanel({ email, targetAI }: TargetAIPanelProps) {
  const paymentDetails = email && email.body ? extractPaymentDetails(email.body) : null;
  const progressPercent = Math.min(100, Math.max(0, targetAI.progress));
  const senderClean = email ? (email.from || "Unknown Sender").replace(/<[^>]+>/, "").trim() || "Unknown Sender" : "";
  const senderEmail = email ? (email.from ? (email.from.match(/<([^>]+)>/)?.[1] || email.from) : "unknown") : "";

  return (
    <section className="lg:col-span-5 flex flex-col gap-3" data-purpose="center-ai-column">
      {/* Target AI Processing Header & Details Container */}
      <div className="cyber-card rounded-xl p-4 border border-[#1c243a] flex flex-col space-y-3.5">
        {/* Top Target AI Status Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-purple-900/40 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-md shadow-purple-900/30">
              {/* Target Robot Icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect height="10" rx="2" width="18" x="3" y="11" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4M8 15h.01M16 15h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Target AI</h3>
              <p className="text-xs text-slate-400">
                {email
                  ? "Processing the received email and deciding next action..."
                  : "Waiting for incoming email to analyze..."}
              </p>
            </div>
          </div>

          {/* Processing / Status Pill */}
          {targetAI.status === "processing" ? (
            <div className="flex items-center space-x-1.5 bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs px-2.5 py-1 rounded-full">
              <svg className="w-3.5 h-3.5 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" />
              </svg>
              <span className="font-medium">Processing</span>
            </div>
          ) : targetAI.status === "action_proposed" ? (
            <div className="flex items-center space-x-1.5 bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-medium">Action Proposed</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-700/40 text-slate-400 text-xs px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="font-medium">Idle</span>
            </div>
          )}
        </div>

        {/* Email Inspection Card View */}
        {email ? (
          <article
            className="bg-[#0b0f1a] border border-[#1a233a] rounded-xl p-4 flex flex-col space-y-3 text-xs"
            data-purpose="email-body"
          >
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-2.5">
              <div>
                <h4 className="text-sm font-semibold text-white">{email.subject}</h4>
                <div className="mt-1 space-y-0.5 text-slate-400 text-[11px]">
                  <p>
                    <span className="text-slate-500">From:</span>{" "}
                    <span className="text-slate-200">{senderClean}</span>{" "}
                    <span className="text-slate-500">&lt;{senderEmail}&gt;</span>
                  </p>
                  <p>
                    <span className="text-slate-500">To:</span>{" "}
                    <span className="text-slate-300">{email.to || "cyberhunt.demo@gmail.com"}</span>
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono" suppressHydrationWarning>
                {formatTimestamp(email.received_at)}
              </span>
            </div>

            {/* Email Body Content */}
            <div className="text-slate-300 space-y-2 leading-relaxed pt-1">
              <p className="whitespace-pre-line">{email.body}</p>

              {/* Bank Details Highlight Box (if found in email) */}
              {paymentDetails && (
                <div className="bg-[#12162a] border border-[#2b3558] rounded-lg p-3 my-2 shadow-inner">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-md bg-indigo-900/40 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      {/* Bank Landmark Icon */}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3l9 7H3l9-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="space-y-0.5 font-mono text-[11px]">
                      {paymentDetails.account_name && (
                        <p>
                          <span className="text-slate-400 font-sans">Account Name:</span>{" "}
                          <strong className="text-slate-200">{paymentDetails.account_name}</strong>
                        </p>
                      )}
                      {paymentDetails.account_number && (
                        <p>
                          <span className="text-slate-400 font-sans">Account No:</span>{" "}
                          <strong className="text-indigo-300 font-semibold tracking-wider">
                            {paymentDetails.account_number}
                          </strong>
                        </p>
                      )}
                      {paymentDetails.ifsc && (
                        <p>
                          <span className="text-slate-400 font-sans">IFSC:</span>{" "}
                          <strong className="text-indigo-300 font-semibold">
                            {paymentDetails.ifsc}
                          </strong>
                        </p>
                      )}
                      {paymentDetails.amount && (
                        <p>
                          <span className="text-slate-400 font-sans">Requested Amount:</span>{" "}
                          <strong className="text-emerald-400 font-semibold">
                            ₹{paymentDetails.amount}
                          </strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Attachments Widget */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                {email.attachments.map((att, idx) => {
                  const isPdf = att.content_type?.includes("pdf") || att.filename.endsWith(".pdf");
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#121626] border border-[#202942] rounded-lg p-2 hover:bg-[#161c30] transition"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold ${
                            isPdf
                              ? "bg-red-950/70 border border-red-600/40 text-red-400"
                              : "bg-blue-950/70 border border-blue-600/40 text-blue-400"
                          }`}
                        >
                          {isPdf ? "PDF" : "TXT"}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-white block">{att.filename}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({formatBytes(att.size_bytes)})
                          </span>
                        </div>
                      </div>
                      <button
                        aria-label="Download attachment"
                        className="p-1.5 text-slate-400 hover:text-white rounded-md transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        ) : (
          <div className="bg-[#0b0f1a] border border-[#1a233a] rounded-xl p-8 text-center text-slate-500 text-xs">
            Select an email from the left inbox to inspect and analyze with Target AI.
          </div>
        )}
      </div>

      {/* Target AI Analysis Progress Bar Card */}
      <div
        className="cyber-card rounded-xl p-3.5 border border-[#1c243a] flex flex-col space-y-2.5 glow-purple"
        data-purpose="ai-analysis-progress"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-purple-900/50 border border-purple-500/50 flex items-center justify-center text-purple-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 10h.01M15 10h.01M9 15h6" />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide">Target AI Analysis</h4>
            <p className="text-[11px] text-slate-400">
              {targetAI.rationale ||
                (targetAI.status === "processing"
                  ? "Reading email content, extracting payment details, and preparing next action..."
                  : "Target AI standby — awaiting new messages.")}
            </p>
          </div>
        </div>

        {/* Progress Bar & Indicator */}
        <div className="flex items-center space-x-3 pt-1">
          <div className="w-full bg-[#182035] rounded-full h-2.5 overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-purple-600 via-indigo-500 to-violet-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-purple-300 shrink-0">
            {progressPercent}%
          </span>
        </div>

        {/* Action Proposed Details if available */}
        {targetAI.proposed_action && (
          <div className="mt-2 p-2.5 bg-[#0e1424] border border-amber-600/40 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between text-amber-300 font-semibold text-[11px]">
              <span>Proposed Tool: {targetAI.proposed_action.tool_name}</span>
              <span className="font-mono text-[10px] uppercase">{targetAI.proposed_action.operation}</span>
            </div>
            {targetAI.proposed_action.thought_process && (
              <p className="text-[10px] text-slate-400 italic font-mono">
                {targetAI.proposed_action.thought_process}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
