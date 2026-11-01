"use client";

import { useState, useRef, useEffect } from "react";
import type { EmailItem, GmailStatus } from "@/types/dashboard";
import { getGmailConnectUrl, disconnectGmail, BACKEND_URL } from "@/lib/api";

// Demo fixture emails (clearly labeled; only shown when Gmail is disconnected)
export const DEMO_EMAILS: EmailItem[] = [
  {
    id: "demo-1",
    from: "Vendor Support <vendor@acme-supplies.example>",
    to: "cyberhunt.demo@gmail.com",
    subject: "Updated Invoice – Payment Required",
    snippet: "Please process the payment of ₹50,000 to the below account...",
    body: `Hi Team,\n\nPlease find the updated invoice for the recent supplies.\nKindly process the payment of ₹50,000 to the below account at the earliest.\n\nAccount Name: Acme Supplies Pvt. Ltd.\nAccount No: 9876543210\nIFSC: HDFC0001234\n\nInvoice is attached for your reference.\n\nRegards,\nVendor Support`,
    attachments: [
      { filename: "Invoice_Updated.pdf", content_type: "application/pdf", size_bytes: 245760, is_safe: true },
    ],
    received_at: "10:24 AM",
    is_untrusted: true,
  },
  {
    id: "demo-2",
    from: "IT Department <it@company.example>",
    to: "cyberhunt.demo@gmail.com",
    subject: "System Maintenance Notice",
    snippet: "Scheduled maintenance window this Saturday 02:00–04:00 AM.",
    body: "Scheduled maintenance window this Saturday 02:00–04:00 AM.",
    attachments: [],
    received_at: "09:47 AM",
    is_untrusted: false,
  },
  {
    id: "demo-3",
    from: "HR Team <hr@company.example>",
    to: "cyberhunt.demo@gmail.com",
    subject: "Policy Update – Action Required",
    snippet: "Please review and acknowledge the updated HR policy by Friday.",
    body: "Please review and acknowledge the updated HR policy by Friday.",
    attachments: [],
    received_at: "08:30 AM",
    is_untrusted: false,
  },
  {
    id: "demo-4",
    from: "Accounts <accounts@company.example>",
    to: "cyberhunt.demo@gmail.com",
    subject: "Monthly Statement",
    snippet: "Your monthly account statement for October is ready.",
    body: "Your monthly account statement for October is ready.",
    attachments: [],
    received_at: "Yesterday",
    is_untrusted: false,
  },
  {
    id: "demo-5",
    from: "Security Alert <security@company.example>",
    to: "cyberhunt.demo@gmail.com",
    subject: "Unusual Login Activity",
    snippet: "A login attempt was detected from an unrecognized device.",
    body: "A login attempt was detected from an unrecognized device.",
    attachments: [],
    received_at: "Yesterday",
    is_untrusted: false,
  },
  {
    id: "demo-6",
    from: "Google <no-reply@accounts.google.example>",
    to: "cyberhunt.demo@gmail.com",
    subject: "Security alert for your account",
    snippet: "A new sign-in to your Google Account.",
    body: "A new sign-in to your Google Account.",
    attachments: [],
    received_at: "Yesterday",
    is_untrusted: false,
  },
];

interface EmailInboxPanelProps {
  emails: EmailItem[];
  selectedEmailId: string | null;
  onEmailSelect: (email: EmailItem) => void;
  gmailStatus: GmailStatus | null;
  onGmailStatusChange: (status: GmailStatus | null) => void;
  onGmailConnected?: () => void | Promise<void>;
}

function initials(from?: string): string {
  const clean = (from || "Unknown Sender").replace(/<[^>]+>/, "").trim() || "Unknown";
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return (clean[0] || "?").toUpperCase();
}

function formatTime(val: string): string {
  if (!val) return "";
  if (val.includes("AM") || val.includes("PM") || val.toLowerCase().includes("yesterday")) {
    return val;
  }
  const date = new Date(val);
  if (isNaN(date.getTime())) {
    return val;
  }
  // Use UTC to avoid SSR/CSR timezone mismatch (server runs UTC, browser runs local)
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = (hours % 12 || 12).toString().padStart(2, "0");
  return `${formattedHours}:${minutes} ${ampm}`;
}

export default function EmailInboxPanel({
  emails,
  selectedEmailId,
  onEmailSelect,
  gmailStatus,
  onGmailStatusChange,
  onGmailConnected,
}: EmailInboxPanelProps) {
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<"inbox" | "starred" | "sent" | "spam" | "trash">("inbox");

  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = gmailStatus?.connected ?? false;
  const spamCount = emails.filter((e) => e.is_untrusted).length;
  const filteredEmails = activeFolder === "spam" ? emails.filter((e) => e.is_untrusted) : emails;

  // Clean up poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Listen for GMAIL_CONNECTED postMessage from backend callback
  useEffect(() => {
    const handleOAuthMessage = async (e: MessageEvent) => {
      // Validate origin against backend endpoints
      const allowedOrigins = [
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        BACKEND_URL,
      ];
      if (!allowedOrigins.includes(e.origin)) {
        return;
      }

      if (e.data?.type === "GMAIL_CONNECTED") {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
          popupRef.current = null;
        }
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setConnectLoading(false);
        setErrorMessage(null);

        if (onGmailConnected) {
          await onGmailConnected();
        }
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [onGmailConnected]);

  const handleConnect = async () => {
    // Prevent multiple popup windows on repeated clicks
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    setErrorMessage(null);
    setConnectLoading(true);

    // Centered window calculation
    const width = 500;
    const height = 650;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const windowFeatures = `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=yes,resizable=yes`;

    // Open popup immediately in response to user click to avoid popup blocker
    const popup = window.open("about:blank", "cyberhunt_gmail_oauth", windowFeatures);

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      setErrorMessage("Popup blocked by browser. Please enable popups for CYBER HUNT to sign in with Google.");
      setConnectLoading(false);
      return;
    }

    popupRef.current = popup;

    // Render loading indicator inside popup
    try {
      popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CYBER HUNT — Google Sign-In</title>
  <style>
    body {
      background: #0a0d14;
      color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(139, 92, 246, 0.2);
      border-top-color: #8b5cf6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h3 { margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #f1f5f9; }
    p { margin: 0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h3>Connecting to Google</h3>
  <p>Redirecting to Google Accounts...</p>
</body>
</html>`);
    } catch (_) {}

    // Monitor for user cancelling OAuth (closing the popup manually)
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        popupRef.current = null;
        setConnectLoading(false);
      }
    }, 500);

    // Call GET http://127.0.0.1:8000/api/v1/auth/gmail/connect
    try {
      const data = await getGmailConnectUrl();
      if (!data || !data.authorization_url) {
        throw new Error("Backend did not return an authorization URL. Check GOOGLE_CLIENT_ID in backend/.env");
      }

      // Automatically navigate to Google Accounts sign-in screen
      popup.location.href = data.authorization_url;
      popup.focus();
    } catch (err: unknown) {
      if (popup && !popup.closed) {
        popup.close();
      }
      popupRef.current = null;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      const msg = err instanceof Error ? err.message : "Failed to connect to Google OAuth.";
      setErrorMessage(msg);
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectLoading(true);
    try {
      await disconnectGmail();
      onGmailStatusChange({
        connected: false,
        message: "Disconnected",
      });
    } catch (err) {
      console.error("Disconnect error:", err);
    } finally {
      setDisconnectLoading(false);
    }
  };

  return (
    <section
      className="lg:col-span-4 flex flex-col gap-3 cyber-card rounded-xl p-3.5 border border-[#1c243a]"
      data-purpose="inbox-column"
    >
      {/* Inbox Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          {/* Gmail multi-colored M icon */}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2l10 7 10-7z" fill="#4285F4" />
            <path d="M22 6l-10 7L2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#34A853" />
            <path d="M20 4H4C2.9 4 2 4.9 2 6v.5l10 7 10-7V6c0-1.1-.9-2-2-2z" fill="#EA4335" />
            <path d="M2 6v12c0 1.1.9 2 2 2h2V9.5L2 6z" fill="#FBBC05" />
          </svg>
          <h3 className="text-sm font-semibold text-white tracking-wide">
            Email Inbox {isConnected ? "(Real)" : "(Demo Mode)"}
          </h3>
        </div>

        {/* Connected Status badge */}
        {isConnected ? (
          <span className="inline-flex items-center space-x-1 bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[11px] font-medium px-2 py-0.5 rounded-full">
            <span>Connected</span>
            <span>✓</span>
          </span>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="inline-flex items-center space-x-1 bg-purple-950/70 hover:bg-purple-900/80 border border-purple-500/40 text-purple-300 text-[11px] font-medium px-2.5 py-0.5 rounded-full transition shadow-sm"
          >
            <span>{connectLoading ? "Connecting..." : "Connect Gmail"}</span>
          </button>
        )}
      </div>

      {/* Account Selector Bar */}
      <div className="flex items-center justify-between bg-[#0a0e19] border border-[#1f293d] rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300 shrink-0">
            @
          </div>
          <span className="font-mono text-slate-300 text-[11px] truncate">
            {isConnected
              ? gmailStatus?.email || "gmail-authenticated@cyberhunt.io"
              : "cyberhunt.demo@gmail.com"}
          </span>
        </div>

        {isConnected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnectLoading}
            className="text-[10px] font-mono text-slate-400 hover:text-red-400 ml-2 transition shrink-0"
          >
            {disconnectLoading ? "..." : "Disconnect"}
          </button>
        ) : (
          <span className="text-[10px] text-amber-400/90 font-mono ml-2 shrink-0">Demo</span>
        )}
      </div>

      {errorMessage && (
        <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-800/40 rounded px-2.5 py-1">
          {errorMessage}
        </div>
      )}

      {/* Inbox Layout: Mini Navigation & Email Cards List */}
      <div className="grid grid-cols-12 gap-2.5 pt-1 flex-1">
        {/* Left Mini-Folders Sidebar (4 Cols) */}
        <aside className="col-span-4 flex flex-col space-y-1 text-xs">
          {/* Inbox folder */}
          <button
            onClick={() => setActiveFolder("inbox")}
            className={`flex items-center justify-between px-2 py-1.5 rounded-md font-medium transition ${
              activeFolder === "inbox"
                ? "bg-violet-950/60 text-purple-300 border border-purple-800/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span>Inbox</span>
            </div>
            <span className="bg-purple-600 text-white text-[10px] px-1.5 rounded-full font-bold">
              {emails.length}
            </span>
          </button>

          {/* Starred */}
          <button
            onClick={() => setActiveFolder("starred")}
            className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-md transition ${
              activeFolder === "starred"
                ? "bg-violet-950/60 text-purple-300 border border-purple-800/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Starred</span>
          </button>

          {/* Sent */}
          <button
            onClick={() => setActiveFolder("sent")}
            className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-md transition ${
              activeFolder === "sent"
                ? "bg-violet-950/60 text-purple-300 border border-purple-800/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Sent</span>
          </button>

          {/* Spam */}
          <button
            onClick={() => setActiveFolder("spam")}
            className={`flex items-center justify-between px-2 py-1.5 rounded-md transition ${
              activeFolder === "spam"
                ? "bg-red-950/60 text-red-300 border border-red-800/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span>Spam</span>
            </div>
            <span className="bg-red-500/80 text-white text-[10px] px-1.5 rounded-full font-bold">
              {spamCount}
            </span>
          </button>

          {/* Trash */}
          <button
            onClick={() => setActiveFolder("trash")}
            className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-md transition ${
              activeFolder === "trash"
                ? "bg-violet-950/60 text-purple-300 border border-purple-800/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Trash</span>
          </button>

          {/* Real-time sync footer indicator */}
          <div className="pt-6 mt-auto">
            <div className="flex items-center space-x-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-500 glow-green animate-pulse" : "bg-slate-600"
                }`}
              />
              <span className="text-[10px] font-semibold text-emerald-400">
                {isConnected ? "Real-time Sync" : "Sync Standby"}
              </span>
            </div>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {isConnected ? "Listening for new emails..." : "Demo mode active"}
            </p>
          </div>
        </aside>

        {/* Email Items List (8 Cols) */}
        <div className="col-span-8 flex flex-col space-y-2 max-h-[560px] overflow-y-auto pr-0.5">
          {filteredEmails.map((email) => {
            const isSelected = email.id === selectedEmailId;
            const init = initials(email.from);
            const senderClean = (email.from || "Unknown Sender").replace(/<[^>]+>/, "").trim() || "Unknown Sender";
            const subjectClean = email.subject || "(no subject)";

            if (isSelected) {
              return (
                <div
                  key={email.id}
                  onClick={() => onEmailSelect(email)}
                  className="bg-[#19101d] border-2 border-red-500/70 rounded-lg p-2.5 glow-red cursor-pointer transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-red-600/30 text-red-300 flex items-center justify-center font-bold text-xs border border-red-500/40 shrink-0">
                        {init}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white block leading-tight truncate">
                          {senderClean}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                          {subjectClean}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1" suppressHydrationWarning>
                      {formatTime(email.received_at)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {email.is_untrusted ? (
                      <>
                        <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                          SPAM
                        </span>
                        <span className="text-[10px] text-red-400/90 font-medium">
                          High Urgency
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Standard</span>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={email.id}
                onClick={() => onEmailSelect(email)}
                className="bg-[#0f1422] border border-[#1b233a] rounded-lg p-2 hover:border-slate-600 cursor-pointer transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-6 h-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-semibold text-[10px] shrink-0">
                      {init}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-200 block leading-tight truncate">
                        {senderClean}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                        {subjectClean}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1" suppressHydrationWarning>
                    {formatTime(email.received_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
