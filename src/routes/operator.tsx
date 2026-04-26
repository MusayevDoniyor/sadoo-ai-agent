import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import { useStore } from "@/store/useStore";
import { useServerFn } from "@tanstack/react-start";
import { copilot, summarizeCall, customerPreChat, buildProfile } from "@/server/ai.functions";
import { SegmentBadge, RiskBadge, StatusDot } from "@/components/Badges";
import type { ChatMessage, CopilotSuggestion, TranscriptTurn } from "@/types";

export const Route = createFileRoute("/operator")({
  component: OperatorPage,
});

function OperatorPage() {
  const nav = useNavigate();
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { nav({ to: "/login" }); return; }
    if (u.role !== "OPERATOR") { nav({ to: "/admin" }); return; }
    setUser(u);
    useStore.getState().setOperatorStatus(u.id, "available");
    return () => useStore.getState().setOperatorStatus(u.id, "offline");
  }, [nav]);

  if (!user) return null;
  return <OperatorWorkspace operatorId={user.id} operatorName={user.displayName} />;
}

function OperatorWorkspace({ operatorId, operatorName }: { operatorId: string; operatorName: string }) {
  const queue = useStore((s) => s.queue);
  const activeCalls = useStore((s) => s.activeCalls);
  const operators = useStore((s) => s.operators);
  const formulas = useStore((s) => s.formulas);
  const clients = useStore((s) => s.clients);
  const memory = useStore((s) => s.memory);
  const takeNext = useStore((s) => s.takeNextCall);
  const appendT = useStore((s) => s.appendTranscript);
  const setCop = useStore((s) => s.setCopilot);
  const endCall = useStore((s) => s.endCall);
  const recordFormula = useStore((s) => s.recordFormulaUse);

  const me = operators.get(operatorId);
  const call = activeCalls.get(operatorId);
  const waiting = queue.filter((q) => q.status === "waiting");
  const [showSim, setShowSim] = useState(false);

  // Copilot trigger (debounced)
  const copilotFn = useServerFn(copilot);
  const summaryFn = useServerFn(summarizeCall);
  const debounceRef = useRef<number | null>(null);
  const [copBusy, setCopBusy] = useState(false);

  useEffect(() => {
    if (!call) return;
    if (call.transcript.length === 0) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setCopBusy(true);
      try {
        const crm = call.customer.clientCode ? clients.get(call.customer.clientCode) : null;
        const mem = memory.get(call.customer.phone) ?? (call.customer.clientCode ? memory.get(String(call.customer.clientCode)) : null);
        const sug = await copilotFn({
          data: {
            transcript: call.transcript.map((t) => ({ speaker: t.speaker, text: t.text })),
            customer: { name: call.customer.name, reason: call.customer.reason, language: call.customer.language, aiProfile: call.customer.aiProfile },
            crm: crm ? { segment: crm.SEGMENT, risk: crm.RISK_LEVEL, income: crm.MONTHLY_INCOME_UZS, hasLoan: crm.HAS_LOAN, hasDeposit: crm.HAS_DEPOSIT, hasCard: crm.HAS_CARD } : null,
            memory: mem ? { callCount: mem.callCount, lastIntent: mem.lastIntent, summary: mem.summary } : null,
            formulas: formulas.map((f) => ({ id: f.id, type: f.type, title: f.title, pattern: f.pattern, successRate: f.useCount ? f.successCount / f.useCount : 0 })),
          },
        });
        setCop(operatorId, sug as CopilotSuggestion);
      } catch (e) {
        console.error("copilot failed", e);
      } finally { setCopBusy(false); }
    }, 1500);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [call?.transcript.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTake = () => takeNext(operatorId);

  const onEnd = async (outcome: "Completed" | "Pending" | "Declined") => {
    if (!call) return;
    if (call.copilot?.formulaId) recordFormula(call.copilot.formulaId, outcome === "Completed");
    try {
      await summaryFn({ data: { transcript: call.transcript.map((t) => ({ speaker: t.speaker, text: t.text })), customerName: call.customer.name, reason: call.customer.reason } });
    } catch { /* ignore */ }
    endCall(operatorId, outcome);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] grid grid-cols-12 gap-px bg-border overflow-hidden">
      {/* LEFT */}
      <aside className="col-span-3 bg-background overflow-y-auto">
        <Section title="My status">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{operatorName}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><StatusDot status={me?.status ?? "offline"} /> {me?.status}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat n={me?.callsToday ?? 0} l="Calls" />
            <Stat n={me?.conversions ?? 0} l="Sold" />
            <Stat n={me ? `${me.callsToday ? Math.round((me.conversions / me.callsToday) * 100) : 0}%` : "0%"} l="Rate" />
          </div>
        </Section>

        <Section title={`Queue (${waiting.length})`}>
          {waiting.length === 0 && (
            <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
              No customers waiting.
              <button onClick={() => setShowSim(true)} className="block mt-2 mx-auto text-foreground underline">
                Simulate customer →
              </button>
            </div>
          )}
          <div className="space-y-1.5">
            {waiting.map((q, i) => {
              const crm = q.clientCode ? clients.get(q.clientCode) : null;
              return (
                <div key={q.id} className="border border-border rounded-md p-2.5 bg-surface">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate">{q.name}</div>
                    <div className="text-[10px] text-muted-foreground">#{i + 1}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{q.reason}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {crm && <SegmentBadge segment={crm.SEGMENT} />}
                    <span className="text-[10px] text-muted-foreground">{Math.floor((Date.now() - q.joinedAt) / 1000)}s</span>
                  </div>
                </div>
              );
            })}
          </div>
          {!call && waiting.length > 0 && (
            <button onClick={onTake} className="mt-3 w-full h-10 bg-foreground text-background rounded-md text-sm font-medium hover:bg-foreground/90">
              Take next call →
            </button>
          )}
        </Section>

        {call && (
          <Section title="Active call">
            <CallCustomerCard call={call} />
          </Section>
        )}
      </aside>

      {/* CENTER */}
      <main className="col-span-6 bg-background overflow-y-auto">
        {call ? (
          <CallTranscript
            call={call}
            onAppend={(t) => appendT(operatorId, t)}
            onEnd={onEnd}
            onSim={() => setShowSim(true)}
          />
        ) : (
          <EmptyCall onSim={() => setShowSim(true)} />
        )}
      </main>

      {/* RIGHT */}
      <aside className="col-span-3 bg-background overflow-y-auto">
        <CopilotPanel
          call={call ?? null}
          busy={copBusy}
          formulas={formulas}
          memory={call ? (memory.get(call.customer.phone) ?? (call.customer.clientCode ? memory.get(String(call.customer.clientCode)) ?? null : null)) : null}
        />
      </aside>

      {showSim && <SimulateCustomer onClose={() => setShowSim(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border">
      <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

function Stat({ n, l }: { n: React.ReactNode; l: string }) {
  return (
    <div className="border border-border rounded-md p-2 bg-surface">
      <div className="text-base font-semibold tracking-tight">{n}</div>
      <div className="text-[10px] text-muted-foreground">{l}</div>
    </div>
  );
}

function CallCustomerCard({ call }: { call: ReturnType<typeof useStore.getState>["activeCalls"] extends Map<string, infer V> ? V : never }) {
  const clients = useStore((s) => s.clients);
  const memory = useStore((s) => s.memory);
  const crm = call.customer.clientCode ? clients.get(call.customer.clientCode) : null;
  const mem = memory.get(call.customer.phone) ?? (call.customer.clientCode ? memory.get(String(call.customer.clientCode)) : null);
  return (
    <div className="space-y-2 text-sm">
      <div>
        <div className="font-medium">{call.customer.name}</div>
        <div className="text-xs text-muted-foreground">{call.customer.phone}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {crm && <SegmentBadge segment={crm.SEGMENT} />}
        {crm && <RiskBadge risk={crm.RISK_LEVEL} />}
        {crm?.HAS_LOAN && <Tag>Loan</Tag>}
        {crm?.HAS_DEPOSIT && <Tag>Deposit</Tag>}
        {crm?.HAS_CARD && <Tag>Card</Tag>}
      </div>
      {crm && (
        <div className="text-[11px] text-muted-foreground">
          Income: {(crm.MONTHLY_INCOME_UZS / 1_000_000).toFixed(1)}M UZS · Last txn {crm.LAST_TXN_DATE}
        </div>
      )}
      {mem && (
        <div className="text-[11px] border-l-2 border-border pl-2 text-muted-foreground">
          {mem.callCount}× calls. Last: {mem.lastIntent}.
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">Reason: <span className="text-foreground">{call.customer.reason}</span></div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-border text-muted-foreground">{children}</span>;
}

// =================== Center: Transcript + mic ===================
type SpeechRec = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null;
  start: () => void; stop: () => void;
};

function CallTranscript({
  call,
  onAppend,
  onEnd,
  onSim,
}: {
  call: ReturnType<typeof useStore.getState>["activeCalls"] extends Map<string, infer V> ? V : never;
  onAppend: (t: TranscriptTurn) => void;
  onEnd: (outcome: "Completed" | "Pending" | "Declined") => void;
  onSim: () => void;
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [call.transcript.length]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec: SpeechRec = new SR();
    rec.continuous = true; rec.interimResults = false;
    rec.lang = call.customer.language === "UZ" ? "uz-UZ" : "ru-RU";
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          onAppend({ speaker: "operator", text: r[0].transcript.trim(), ts: Date.now() });
        }
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id]);

  const toggle = () => {
    if (!recRef.current) return;
    if (listening) { try { recRef.current.stop(); } catch {} setListening(false); }
    else { try { recRef.current.start(); setListening(true); } catch {} }
  };

  const [typed, setTyped] = useState("");
  const sendTyped = (speaker: "operator" | "customer") => {
    if (!typed.trim()) return;
    onAppend({ speaker, text: typed.trim(), ts: Date.now() });
    setTyped("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Live call · {Math.floor((Date.now() - call.startedAt) / 1000)}s</div>
          <div className="text-sm font-medium">{call.customer.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSim} className="text-xs h-8 px-3 border border-border rounded-md hover:border-border-strong">Simulate customer</button>
          <button onClick={() => onEnd("Declined")} className="text-xs h-8 px-3 border border-border rounded-md hover:border-border-strong text-muted-foreground">End — Declined</button>
          <button onClick={() => onEnd("Pending")} className="text-xs h-8 px-3 border border-border rounded-md hover:border-border-strong">End — Pending</button>
          <button onClick={() => onEnd("Completed")} className="text-xs h-8 px-3 bg-foreground text-background rounded-md font-medium">End — Completed</button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {call.transcript.length === 0 && (
          <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
            Press the mic and start talking. The AI copilot will respond after each pause.
          </div>
        )}
        {call.transcript.map((t, i) => (
          <div key={i} className={`flex ${t.speaker === "operator" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${t.speaker === "operator" ? "bg-foreground text-background" : "bg-surface border border-border"}`}>
              <div className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">{t.speaker === "operator" ? "You" : "Customer"}</div>
              {t.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            disabled={!supported}
            className={`h-12 w-12 rounded-full grid place-items-center border ${listening ? "bg-[oklch(0.62_0.21_25)] border-[oklch(0.62_0.21_25)] text-white" : "border-border bg-surface hover:border-border-strong"} disabled:opacity-30`}
            title={supported ? "Toggle microphone" : "Web Speech API not supported in this browser"}
          >
            {listening ? "■" : "🎙"}
          </button>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">{supported ? (listening ? "Listening — speak now…" : "Click mic to capture your speech (operator turn)") : "Browser doesn't support Web Speech API. Use the manual input below."}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTyped("operator")}
            placeholder="Type to add a turn manually…" className="flex-1 h-10 px-3 bg-surface border border-border rounded-md text-sm focus:border-border-strong focus:outline-none" />
          <button onClick={() => sendTyped("operator")} className="h-10 px-4 border border-border rounded-md text-sm hover:border-border-strong">+ Operator</button>
          <button onClick={() => sendTyped("customer")} className="h-10 px-4 border border-border rounded-md text-sm hover:border-border-strong">+ Customer</button>
        </div>
      </div>
    </div>
  );
}

function EmptyCall({ onSim }: { onSim: () => void }) {
  return (
    <div className="h-full grid place-items-center px-8">
      <div className="text-center max-w-sm">
        <div className="text-sm text-muted-foreground">No active call.</div>
        <div className="mt-2 text-base">Take the next customer from the queue, or simulate one.</div>
        <button onClick={onSim} className="mt-6 h-10 px-5 border border-border rounded-md text-sm hover:border-border-strong">Simulate customer →</button>
      </div>
    </div>
  );
}

// =================== Right: Copilot ===================
function CopilotPanel({
  call, busy, formulas, memory,
}: {
  call: ReturnType<typeof useStore.getState>["activeCalls"] extends Map<string, infer V> ? V : never | undefined;
  busy: boolean;
  formulas: ReturnType<typeof useStore.getState>["formulas"];
  memory: ReturnType<typeof useStore.getState>["memory"] extends Map<string, infer V> ? V | null : null;
}) {
  if (!call) {
    return (
      <div className="p-6">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Copilot</div>
        <div className="mt-4 text-sm text-muted-foreground">Suggestions appear during a live call.</div>
        <div className="mt-8">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Top formulas</div>
          {formulas.slice().sort((a, b) => (b.useCount ? b.successCount / b.useCount : 0) - (a.useCount ? a.successCount / a.useCount : 0)).slice(0, 5).map((f) => (
            <div key={f.id} className="text-xs border border-border rounded-md p-2 mb-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.title}</span>
                <span className="text-muted-foreground">{f.useCount ? Math.round((f.successCount / f.useCount) * 100) : 0}%</span>
              </div>
              <div className="text-muted-foreground mt-1 truncate">{f.pattern}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const c = call.copilot;
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Copilot</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${busy ? "bg-[oklch(0.78_0.16_80)] pulse-dot" : "bg-[oklch(0.72_0.18_150)]"}`} />
          {busy ? "Thinking…" : "Live"}
        </div>
      </div>

      {!c && !busy && <div className="text-xs text-muted-foreground">Speak to trigger first suggestion.</div>}

      {c && (
        <>
          <Block label="Next action" big>{c.nextAction}</Block>
          <Block label="Say this">
            <div className="text-foreground italic">"{c.script}"</div>
          </Block>
          <Block label="Tone">{c.tone}</Block>
          {c.objectionResponse && <Block label="Objection response">{c.objectionResponse}</Block>}
          {c.recommendedProduct && <Block label="Recommend product">{c.recommendedProduct}</Block>}
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Sentiment" value={c.sentiment} tone={c.sentiment === "positive" ? "good" : c.sentiment === "negative" ? "bad" : "neutral"} />
            <Mini label="Stage" value={c.salesStage} />
          </div>
          {c.formulaId && (() => {
            const f = formulas.find((x) => x.id === c.formulaId);
            if (!f) return null;
            return (
              <div className="border border-border rounded-md p-3 bg-surface">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Using formula</div>
                <div className="text-sm font-medium mt-1">{f.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{f.useCount ? Math.round((f.successCount / f.useCount) * 100) : 0}% success rate</div>
              </div>
            );
          })()}
        </>
      )}

      {memory && (
        <div className="border-t border-border pt-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Customer memory</div>
          <div className="text-xs space-y-1">
            <div><span className="text-muted-foreground">Total calls:</span> {memory.callCount}</div>
            <div><span className="text-muted-foreground">Last:</span> {memory.lastIntent} ({memory.lastCallDate})</div>
            <div className="text-muted-foreground italic mt-1">{memory.summary}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ label, children, big }: { label: string; children: React.ReactNode; big?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 ${big ? "text-sm font-medium" : "text-xs"} text-foreground/90`}>{children}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "neutral" }) {
  const cls = tone === "good" ? "text-[oklch(0.72_0.18_150)]" : tone === "bad" ? "text-[oklch(0.65_0.21_25)]" : "text-foreground";
  return (
    <div className="border border-border rounded-md p-2.5 bg-surface">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-xs mt-1 capitalize ${cls}`}>{value}</div>
    </div>
  );
}

// =================== Simulate customer slide-over ===================
function SimulateCustomer({ onClose }: { onClose: () => void }) {
  const joinQueue = useStore((s) => s.joinQueue);
  const updateQueueCustomer = useStore((s) => s.updateQueueCustomer);
  const queue = useStore((s) => s.queue);
  const clients = useStore((s) => s.clients);
  const preChatFn = useServerFn(customerPreChat);
  const profileFn = useServerFn(buildProfile);

  const [name, setName] = useState("Karimov Firdavs");
  const [phone, setPhone] = useState("10001");
  const [reason, setReason] = useState("Depozit ochmoqchiman, 12 oylik.");
  const [language, setLanguage] = useState<"UZ" | "RU">("UZ");
  const [qid, setQid] = useState<string | null>(null);
  const me = qid ? queue.find((q) => q.id === qid) : null;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const start = () => {
    const numeric = parseInt(phone.replace(/\D/g, ""), 10);
    const clientCode = clients.has(numeric) ? numeric : undefined;
    const id = joinQueue({ name, phone, reason, language, clientCode });
    setQid(id);
  };

  const sampleClients = useMemo(() => Array.from(clients.values()).slice(0, 6), [clients]);

  const send = async () => {
    if (!me || !input.trim() || busy) return;
    const userMsg: ChatMessage = { role: "customer", text: input, ts: Date.now() };
    const newMsgs = [...me.preChat, userMsg];
    updateQueueCustomer(me.id, { preChat: newMsgs });
    setInput("");
    setBusy(true);
    try {
      const apiMsgs = newMsgs.map((m) => ({ role: m.role === "customer" ? "user" as const : "assistant" as const, content: m.text }));
      const { reply } = await preChatFn({ data: { messages: apiMsgs, customer: { name: me.name, reason: me.reason, language: me.language } } });
      const withAi = [...newMsgs, { role: "ai" as const, text: reply, ts: Date.now() }];
      updateQueueCustomer(me.id, { preChat: withAi });
      if (withAi.filter((m) => m.role === "customer").length >= 2) {
        try {
          const profile = await profileFn({ data: { transcript: withAi.map(m => `[${m.role}]: ${m.text}`).join("\n"), reason: me.reason } });
          updateQueueCustomer(me.id, { aiProfile: profile });
        } catch { /* ignore */ }
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground">Demo · Customer side</div>
            <div className="text-sm font-medium">Simulate customer</div>
          </div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
        </div>

        {!me ? (
          <div className="p-5 space-y-3 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pick a CRM client</div>
            <div className="grid grid-cols-2 gap-1.5">
              {sampleClients.map((c) => (
                <button key={c.CLIENT_CODE} onClick={() => { setName(c.CLIENT_NAME); setPhone(String(c.CLIENT_CODE)); }}
                  className="text-left text-xs border border-border rounded-md p-2 hover:border-border-strong">
                  <div className="font-medium truncate">{c.CLIENT_NAME}</div>
                  <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <SegmentBadge segment={c.SEGMENT} /> #{c.CLIENT_CODE}
                  </div>
                </button>
              ))}
            </div>
            <div className="space-y-2 pt-3">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone / client code" />
              <textarea className={inputCls + " min-h-20 py-2"} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
              <div className="flex gap-2">
                {(["UZ", "RU"] as const).map((l) => (
                  <button key={l} onClick={() => setLanguage(l)} className={`h-9 px-4 rounded-md border text-xs ${language === l ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={start} className="w-full h-10 bg-foreground text-background rounded-md text-sm font-medium">Join queue as this customer</button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-border text-xs text-muted-foreground">
              {me.status === "waiting" ? "In queue — chatting with AI…" : me.status === "in_call" ? "Connected to operator!" : ""}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {me.preChat.map((m, i) => (
                <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${m.role === "customer" ? "bg-foreground text-background" : "bg-surface border border-border"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && <div className="text-xs text-muted-foreground">AI typing…</div>}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type as customer…" className="flex-1 h-10 px-3 bg-surface border border-border rounded-md text-sm" />
              <button onClick={send} disabled={busy} className="h-10 px-4 bg-foreground text-background rounded-md text-sm font-medium disabled:opacity-50">Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full h-10 px-3 bg-surface border border-border rounded-md text-sm focus:border-border-strong focus:outline-none";
