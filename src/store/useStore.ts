import { create } from "zustand";
import type {
  ActiveCall,
  CRMClient,
  CallRecord,
  CopilotSuggestion,
  CustomerMemory,
  Formula,
  OperatorState,
  QueueCustomer,
  TranscriptTurn,
} from "@/types";
import clientsJson from "@/data/clients.json";
import callsJson from "@/data/calls.json";
import { seedFormulas } from "@/data/seedFormulas";
import { listOperators } from "@/lib/auth";

// Build customer memory from historical calls
function buildMemory(calls: CallRecord[]): Map<string, CustomerMemory> {
  const map = new Map<string, CustomerMemory>();
  // index by Client_Code as the "phone" for demo
  for (const c of calls) {
    const key = String(c.Client_Code);
    const existing = map.get(key);
    const entry = {
      date: c.Date,
      intent: c.Primary_Intent,
      result: c.Sale_Result,
      summary: c.Transcript.slice(0, 140) + "...",
    };
    if (!existing) {
      map.set(key, {
        phone: key,
        name: c.Client_Name,
        callCount: 1,
        lastCallDate: c.Date,
        lastIntent: c.Primary_Intent,
        preferredLanguage: c.Language,
        summary: `Oxirgi qo'ng'iroq: ${c.Primary_Intent} (${c.Sale_Result})`,
        history: [entry],
      });
    } else {
      existing.callCount += 1;
      existing.history.unshift(entry);
      if (c.Date > existing.lastCallDate) {
        existing.lastCallDate = c.Date;
        existing.lastIntent = c.Primary_Intent;
        existing.summary = `Oxirgi qo'ng'iroq: ${c.Primary_Intent} (${c.Sale_Result})`;
      }
    }
  }
  return map;
}

interface StoreState {
  // Data
  clients: Map<number, CRMClient>;
  callHistory: CallRecord[];
  memory: Map<string, CustomerMemory>;
  formulas: Formula[];

  // Live state
  queue: QueueCustomer[];
  activeCalls: Map<string, ActiveCall>; // by operatorId
  operators: Map<string, OperatorState>;

  // Actions: queue
  joinQueue: (c: Omit<QueueCustomer, "id" | "joinedAt" | "status" | "preChat" | "aiProfile"> & { aiProfile?: QueueCustomer["aiProfile"]; preChat?: QueueCustomer["preChat"] }) => string;
  updateQueueCustomer: (id: string, patch: Partial<QueueCustomer>) => void;
  removeFromQueue: (id: string) => void;

  // Actions: calls
  takeNextCall: (operatorId: string) => ActiveCall | null;
  assignCall: (operatorId: string, customerId: string) => ActiveCall | null;
  appendTranscript: (operatorId: string, turn: TranscriptTurn) => void;
  setCopilot: (operatorId: string, c: CopilotSuggestion) => void;
  endCall: (operatorId: string, outcome: ActiveCall["outcome"]) => void;
  setOperatorStatus: (operatorId: string, status: OperatorState["status"]) => void;

  // Formulas
  recordFormulaUse: (id: string, success: boolean) => void;

  // Memory
  upsertMemory: (m: CustomerMemory) => void;
}

const initialOperators = (): Map<string, OperatorState> => {
  const m = new Map<string, OperatorState>();
  for (const op of listOperators()) {
    m.set(op.id, {
      id: op.id,
      username: op.username,
      displayName: op.displayName,
      status: "offline",
      callsToday: 0,
      conversions: 0,
      avgScore: 0,
    });
  }
  return m;
};

export const useStore = create<StoreState>((set, get) => ({
  clients: new Map((clientsJson as CRMClient[]).map((c) => [c.CLIENT_CODE, c])),
  callHistory: callsJson as CallRecord[],
  memory: buildMemory(callsJson as CallRecord[]),
  formulas: seedFormulas,

  queue: [],
  activeCalls: new Map(),
  operators: initialOperators(),

  joinQueue: (c) => {
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const customer: QueueCustomer = {
      id,
      joinedAt: Date.now(),
      status: "waiting",
      preChat: c.preChat ?? [],
      aiProfile: c.aiProfile ?? { needs: "", interest: "", mood: "neutral", notes: [] },
      name: c.name,
      phone: c.phone,
      reason: c.reason,
      language: c.language,
      clientCode: c.clientCode,
    };
    set((s) => ({ queue: [...s.queue, customer] }));
    return id;
  },

  updateQueueCustomer: (id, patch) => {
    set((s) => ({
      queue: s.queue.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  },

  removeFromQueue: (id) => {
    set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }));
  },

  takeNextCall: (operatorId) => {
    const next = get().queue.find((q) => q.status === "waiting");
    if (!next) return null;
    return get().assignCall(operatorId, next.id);
  },

  assignCall: (operatorId, customerId) => {
    const c = get().queue.find((q) => q.id === customerId);
    if (!c) return null;
    const call: ActiveCall = {
      id: `call_${Date.now()}`,
      customer: { ...c, status: "in_call", assignedOperator: operatorId },
      operatorId,
      startedAt: Date.now(),
      transcript: [],
      status: "active",
    };
    set((s) => {
      const calls = new Map(s.activeCalls);
      calls.set(operatorId, call);
      const ops = new Map(s.operators);
      const op = ops.get(operatorId);
      if (op) ops.set(operatorId, { ...op, status: "on_call" });
      return {
        activeCalls: calls,
        operators: ops,
        queue: s.queue.map((q) => (q.id === customerId ? { ...q, status: "in_call", assignedOperator: operatorId } : q)),
      };
    });
    return call;
  },

  appendTranscript: (operatorId, turn) => {
    set((s) => {
      const calls = new Map(s.activeCalls);
      const call = calls.get(operatorId);
      if (!call) return s;
      calls.set(operatorId, { ...call, transcript: [...call.transcript, turn] });
      return { activeCalls: calls };
    });
  },

  setCopilot: (operatorId, c) => {
    set((s) => {
      const calls = new Map(s.activeCalls);
      const call = calls.get(operatorId);
      if (!call) return s;
      calls.set(operatorId, { ...call, copilot: c });
      return { activeCalls: calls };
    });
  },

  endCall: (operatorId, outcome) => {
    const call = get().activeCalls.get(operatorId);
    if (!call) return;
    set((s) => {
      const calls = new Map(s.activeCalls);
      calls.delete(operatorId);
      const ops = new Map(s.operators);
      const op = ops.get(operatorId);
      if (op) {
        ops.set(operatorId, {
          ...op,
          status: "available",
          callsToday: op.callsToday + 1,
          conversions: op.conversions + (outcome === "Completed" ? 1 : 0),
        });
      }
      // Build memory entry
      const mem = new Map(s.memory);
      const phone = call.customer.phone;
      const summary = call.transcript.map((t) => `[${t.speaker === "operator" ? "Operator" : "Mijoz"}]: ${t.text}`).join(" \n").slice(0, 220);
      const existing = mem.get(phone);
      const entry = { date: new Date().toISOString().slice(0,10), intent: call.customer.reason, result: outcome ?? "Pending", summary };
      if (existing) {
        existing.callCount += 1;
        existing.lastCallDate = entry.date;
        existing.lastIntent = entry.intent;
        existing.summary = summary;
        existing.history.unshift(entry);
      } else {
        mem.set(phone, {
          phone, name: call.customer.name, callCount: 1,
          lastCallDate: entry.date, lastIntent: entry.intent,
          preferredLanguage: call.customer.language,
          summary, history: [entry],
        });
      }
      return {
        activeCalls: calls,
        operators: ops,
        memory: mem,
        queue: s.queue.filter((q) => q.id !== call.customer.id),
      };
    });
  },

  setOperatorStatus: (operatorId, status) => {
    set((s) => {
      const ops = new Map(s.operators);
      const op = ops.get(operatorId);
      if (!op) return s;
      ops.set(operatorId, { ...op, status });
      return { operators: ops };
    });
  },

  recordFormulaUse: (id, success) => {
    set((s) => ({
      formulas: s.formulas.map((f) =>
        f.id === id ? { ...f, useCount: f.useCount + 1, successCount: f.successCount + (success ? 1 : 0) } : f
      ),
    }));
  },

  upsertMemory: (m) => {
    set((s) => {
      const mem = new Map(s.memory);
      mem.set(m.phone, m);
      return { memory: mem };
    });
  },
}));
