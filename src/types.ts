// Shared types across the SADOO platform.

export type Role = "ADMIN" | "OPERATOR";

export interface User {
  id: string;
  username: string;
  role: Role;
  displayName: string;
}

export interface CRMClient {
  CLIENT_ID: number;
  CLIENT_CODE: number;
  CLIENT_NAME: string;
  TYPE: "Physical" | "Legal";
  SEGMENT: "Mass" | "Premium" | "VIP";
  HAS_LOAN: boolean;
  HAS_DEPOSIT: boolean;
  HAS_CARD: boolean;
  MONTHLY_INCOME_UZS: number;
  RISK_LEVEL: "Low" | "Medium" | "High";
  LAST_TXN_DATE: string;
}

export interface CallRecord {
  Call_ID: string;
  Date: string;
  Duration_Sec: number;
  Language: "UZ" | "RU";
  Primary_Intent: string;
  Client_ID: number;
  Client_Code: number;
  Client_Name: string;
  Operator_ID: string;
  Branch: number;
  Transcript: string;
  KYC_Passport_Verified: boolean;
  KYC_PINFL_Verified: boolean;
  AML_Purpose_Asked: boolean;
  AML_Source_Asked: boolean;
  PEP_Check_Done: boolean;
  Cross_Sell_Attempted: boolean;
  Checklist_Score_Pct: number;
  Sale_Result: "Completed" | "Pending" | "Declined";
}

export interface QueueCustomer {
  id: string;
  name: string;
  phone: string;
  reason: string;
  joinedAt: number;
  language: "UZ" | "RU";
  // AI-built profile while waiting
  aiProfile: {
    needs: string;
    interest: string;
    mood: "calm" | "frustrated" | "excited" | "neutral";
    notes: string[];
  };
  // Pre-chat with Gemini
  preChat: ChatMessage[];
  // Linked CRM client (if recognized by phone)
  clientCode?: number;
  status: "waiting" | "in_call" | "done";
  assignedOperator?: string;
}

export interface ChatMessage {
  role: "customer" | "ai" | "operator";
  text: string;
  ts: number;
}

export interface TranscriptTurn {
  speaker: "operator" | "customer";
  text: string;
  ts: number;
}

export interface CopilotSuggestion {
  nextAction: string;
  script: string;
  tone: string;
  objectionResponse?: string;
  recommendedProduct?: string;
  sentiment: "positive" | "neutral" | "negative";
  salesStage:
    | "greeting"
    | "discovery"
    | "pitch"
    | "objection"
    | "closing"
    | "wrap_up";
  formulaId?: string;
}

export interface Formula {
  id: string;
  type:
    | "greeting"
    | "objection"
    | "closing"
    | "upsell"
    | "retention"
    | "discovery";
  title: string;
  language: "UZ" | "RU";
  pattern: string;
  successCount: number;
  useCount: number;
}

export interface CustomerMemory {
  phone: string;
  name: string;
  callCount: number;
  lastCallDate: string;
  lastIntent: string;
  summary: string;
  preferredLanguage: "UZ" | "RU";
  history: { date: string; intent: string; result: string; summary: string }[];
}

export interface ActiveCall {
  id: string;
  customer: QueueCustomer;
  operatorId: string;
  startedAt: number;
  transcript: TranscriptTurn[];
  copilot?: CopilotSuggestion;
  formulaUsed?: string;
  status: "active" | "ended";
  endedAt?: number;
  outcome?: "Completed" | "Pending" | "Declined";
}

export interface OperatorState {
  id: string;
  username: string;
  displayName: string;
  status: "available" | "on_call" | "busy" | "offline";
  callsToday: number;
  conversions: number;
  avgScore: number;
}
