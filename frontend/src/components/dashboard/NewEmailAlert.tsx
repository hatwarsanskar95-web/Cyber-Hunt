"use client";

import { useEffect } from "react";
import type { EmailItem } from "@/types/dashboard";

interface NewEmailAlertProps {
  email: EmailItem;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function NewEmailAlert({
  email,
  onDismiss,
  autoDismissMs = 12000,
}: NewEmailAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  const senderClean = (email?.from || "Unknown Sender").replace(/<[^>]+>/, "").trim() || "Unknown Sender";

  return (
    <section
      className="w-full bg-[#1b0d13]/90 border border-red-500/40 rounded-xl p-3 glow-red transition-all animate-slide-down"
      data-purpose="notification-banner"
      role="alert"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Banner Message */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M12 9v2m0 4h.01"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Spam Mail Has Arrived!
            </h2>
            <p className="text-xs text-red-300/80">
              A new email has been received in the inbox.
            </p>
          </div>
        </div>

        {/* Banner Email Details & Dismiss */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="hidden sm:block border-l border-red-900/50 pl-4 py-1">
            <p className="text-slate-300 truncate max-w-[280px]">
              <span className="text-slate-400 font-medium">From:</span> {senderClean}
            </p>
            <p className="text-slate-300 truncate max-w-[280px]">
              <span className="text-slate-400 font-medium">Subject:</span> {email.subject}
            </p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
