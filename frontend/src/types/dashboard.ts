// ─── Dashboard TypeScript Interfaces ───────────────────────────────────────
// All types are derived from actual backend event.py payload contracts.

export interface AttachmentItem {
  filename: string;
  content_type: string;
  size_bytes: number;
  is_safe: boolean;
  extracted_text?: string;
}

export interface EmailItem {
  id: string;
  from: string;
  to?: string;
  subject: string;
  snippet: string;
  body: string;
  attachments: AttachmentItem[];
  received_at: string;
  is_untrusted?: boolean;
  /** Local UI flag: set when the email is selected in the inbox panel */
  is_selected?: boolean;
  status_tag?:
    | "Not Analyzed"
    | "Analyzing"
    | "Safe"
    | "Suspicious"
    | "Blocked"
    | "Requires Human Review"
    | "Analysis Failed"
    | "Allowed"
    | "Awaiting Approval";
}

export interface TargetAIState {
  status: "idle" | "processing" | "action_proposed";
  email: EmailItem | null;
  proposed_action?: {
    tool_name: string;
    operation: string;
    parameters: Record<string, unknown>;
    rationale: string;
    thought_process?: string;
  };
  progress: number; // 0-100
  rationale?: string;
  step?: number;
}

export interface BlueTeamState {
  /** 0=idle, 1=email captured, 2=threat analysis, 3=policy eval, 4=decided */
  stage: 0 | 1 | 2 | 3 | 4;
  risk_score: number; // 0-100
  severity: "low" | "medium" | "high" | "critical" | null;
  threat_indicators: string[];
  decision: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" | null;
  explanation?: string;
  analysisProgress: number; // 0-100, for animated progress bar during stage 2
}

export interface SimulationEvent {
  event_id: string;
  simulation_id: string;
  sequence_number: number;
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface GmailStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  expires_at?: string;
  is_expired?: boolean;
  message: string;
}

export interface SimulationRecord {
  id: string;
  owner_id: string;
  state: string;
  scenario_category: string;
  task_summary: string;
  step_limit: number;
  current_step: number;
  thread_id: string;
  created_at: string;
  updated_at: string;
}

export interface GmailSyncResponse {
  emails_fetched: number;
  simulation_id: string;
  status: string;
}

export interface EventReplayResponse {
  events: SimulationEvent[];
  simulation_id: string;
  from_sequence: number;
}

export type DashboardView = "home" | "simulation" | "inbox" | "files" | "browser" | "payment" | "results";

/** Bank / payment detail extracted from email body */
export interface PaymentDetail {
  account_name?: string;
  account_number?: string;
  ifsc?: string;
  amount?: string;
  bank?: string;
}

