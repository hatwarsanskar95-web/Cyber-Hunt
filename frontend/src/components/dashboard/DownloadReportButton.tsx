"use client";

import React, { useState } from "react";
import { generateSecurityReport, getReportDownloadUrl } from "@/lib/api";

interface DownloadReportButtonProps {
  analysisData: Record<string, any> | null;
  className?: string;
  variant?: "primary" | "compact" | "banner";
}

export default function DownloadReportButton({
  analysisData,
  className = "",
  variant = "primary",
}: DownloadReportButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!analysisData) return null;

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!analysisData || downloading) return;

    try {
      setDownloading(true);
      setError(null);

      // Generate the official report via backend
      const rep = await generateSecurityReport(analysisData);
      setReportId(rep.report_id);

      // Fetch and trigger instant browser download
      const downloadUrl = getReportDownloadUrl(rep.report_id);
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error(`Report download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const levelName = (analysisData.security_level || "SECURITY").toUpperCase();
      a.download = `CyberHunt_${levelName}_Report_${rep.report_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Failed to download report PDF:", err);
      setError(err?.message || "Failed to download PDF report");
    } finally {
      setDownloading(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/30 transition disabled:opacity-50"
          title="Download official audit PDF report"
        >
          {downloading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Download Report (PDF)</span>
            </>
          )}
        </button>
        {reportId && (
          <span className="text-[10px] text-purple-300 font-mono text-center">
            Report ID: {reportId}
          </span>
        )}
        {error && <span className="text-[10px] text-red-400 text-center">{error}</span>}
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-xl bg-gradient-to-r from-purple-950/40 via-[#16132b] to-indigo-950/40 border border-purple-500/40 space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-900/50 border border-purple-400/50 flex items-center justify-center text-purple-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Audit Report Ready</span>
            <span className="text-[10px] text-gray-400 block">
              {reportId ? `Certificate: ${reportId}` : "Complete multi-agent security audit record"}
            </span>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/40 transition disabled:opacity-50"
        >
          {downloading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
              </svg>
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Download Report (PDF)</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-[10px] text-red-400 bg-red-950/30 p-1.5 rounded border border-red-500/30">
          {error}
        </p>
      )}
    </div>
  );
}

