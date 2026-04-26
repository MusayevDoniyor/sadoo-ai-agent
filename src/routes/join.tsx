import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { useServerFn } from "@tanstack/react-start";
import { customerPreChat, buildProfile } from "@/server/ai.functions";
import type { ChatMessage } from "@/types";

export const Route = createFileRoute("/join")({
  component: JoinPage,
});

function JoinPage() {
  const [step, setStep] = useState<"form" | "chat">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [language, setLanguage] = useState<"UZ" | "RU">("UZ");
  const [queueId, setQueueId] = useState<string | null>(null);
  const joinQueue = useStore((s) => s.joinQueue);
  const updateQueueCustomer = useStore((s) => s.updateQueueCustomer);
  const queue = useStore((s) => s.queue);
  const me = queue.find((q) => q.id === queueId) ?? null;
  const clients = useStore((s) => s.clients);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !reason.trim()) return;
    // Try to match a CRM client by phone-as-code
    const numeric = parseInt(phone.replace(/\D/g, "").slice(-5), 10);
    let clientCode: number | undefined;
    for (const code of clients.keys()) { if (code === numeric) { clientCode = code; break; } }
    const id = joinQueue({ name, phone, reason, language, clientCode });
    setQueueId(id);
    setStep("chat");
  };

  if (step === "form") {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center px-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Join the queue</h1>
            <p className="text-sm text-muted-foreground mt-1">Our AI will help while you wait for an operator.</p>
          </div>
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required /></Field>
          <Field label="Phone (last 5 digits become demo client code)"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} required placeholder="+998 90 123 10001" /></Field>
          <Field label="Reason for calling">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls + " min-h-20 py-2"} required />
          </Field>
          <Field label="Language">
            <div className="flex gap-2">
              {(["UZ", "RU"] as const).map((l) => (
                <button type="button" key={l} onClick={() => setLanguage(l)}
                  className={`h-9 px-4 rounded-md border text-xs ${language === l ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-border-strong"}`}>
                  {l === "UZ" ? "O'zbek" : "Русский"}
                </button>
              ))}
            </div>
          </Field>
          <button className="w-full h-10 bg-foreground text-background rounded-md text-sm font-medium">Join queue</button>
        </form>
      </div>
    );
  }

  return <CustomerChat customer={me} updateQueueCustomer={updateQueueCustomer} />;
}

function CustomerChat({
  customer,
  updateQueueCustomer,
}: {
  customer: ReturnType<typeof useStore.getState>["queue"][number] | null;
  updateQueueCustomer: ReturnType<typeof useStore.getState>["updateQueueCustomer"];
}) {
  const preChatFn = useServerFn(customerPreChat);
  const profileFn = useServerFn(buildProfile);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);

  useEffect(() => {
    if (!customer || greeted.current) return;
    greeted.current = true;
    (async () => {
      setBusy(true);
      try {
        const { reply } = await preChatFn({ data: { messages: [{ role: "user", content: "Salom" }], customer: { name: customer.name, reason: customer.reason, language: customer.language } } });
        const newMsgs: ChatMessage[] = [{ role: "ai", text: reply, ts: Date.now() }];
        updateQueueCustomer(customer.id, { preChat: newMsgs });
      } finally { setBusy(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [customer?.preChat?.length]);

  if (!customer) return <div className="p-10 text-sm text-muted-foreground">Loading...</div>;

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg: ChatMessage = { role: "customer", text: input, ts: Date.now() };
    const newMsgs = [...customer.preChat, userMsg];
    updateQueueCustomer(customer.id, { preChat: newMsgs });
    setInput("");
    setBusy(true);
    try {
      const apiMsgs = newMsgs.map((m) => ({ role: m.role === "customer" ? "user" as const : "assistant" as const, content: m.text }));
      const { reply } = await preChatFn({ data: { messages: apiMsgs, customer: { name: customer.name, reason: customer.reason, language: customer.language } } });
      const withAi = [...newMsgs, { role: "ai" as const, text: reply, ts: Date.now() }];
      updateQueueCustomer(customer.id, { preChat: withAi });

      // Rebuild profile every 2 messages
      if (withAi.filter((m) => m.role === "customer").length >= 2) {
        const transcript = withAi.map((m) => `[${m.role}]: ${m.text}`).join("\n");
        try {
          const profile = await profileFn({ data: { transcript, reason: customer.reason } });
          updateQueueCustomer(customer.id, { aiProfile: profile });
        } catch { /* ignore profile failure */ }
      }
    } catch (e) {
      const errMsg: ChatMessage = { role: "ai", text: `Xatolik: ${(e as Error).message}`, ts: Date.now() };
      updateQueueCustomer(customer.id, { preChat: [...newMsgs, errMsg] });
    } finally { setBusy(false); }
  };

  if (customer.status === "in_call") {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center px-6">
        <div className="text-center max-w-md">
          <div className="size-12 mx-auto rounded-full bg-[oklch(0.72_0.18_150)]/15 grid place-items-center mb-4">
            <span className="size-2.5 rounded-full bg-[oklch(0.72_0.18_150)] pulse-dot" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Operator connected</h2>
          <p className="text-sm text-muted-foreground mt-2">You are now speaking with a SADOO operator. The AI continues to assist them in real-time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-muted-foreground">Position in queue</div>
          <div className="text-lg font-semibold tracking-tight">#{(useStore.getState().queue.filter(q => q.status === "waiting").findIndex(q => q.id === customer.id) + 1) || 1}</div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[oklch(0.78_0.16_80)] pulse-dot" /> Waiting for operator
        </div>
      </div>
      <div ref={ref} className="flex-1 border border-border bg-surface rounded-lg p-4 space-y-3 overflow-y-auto min-h-[400px] max-h-[60vh]">
        {customer.preChat.map((m, i) => (
          <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.role === "customer" ? "bg-foreground text-background" : "bg-surface-2 border border-border"}`}>
              {m.role === "ai" && <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">SADOO AI</div>}
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-muted-foreground">AI typing...</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..." className="flex-1 h-10 px-3 bg-surface border border-border rounded-md text-sm focus:border-border-strong focus:outline-none" />
        <button onClick={send} disabled={busy} className="h-10 px-4 bg-foreground text-background rounded-md text-sm font-medium disabled:opacity-50">
          Send
        </button>
      </div>
      {customer.aiProfile.needs && (
        <div className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-3">
          AI is building your profile — operator will see: <span className="text-foreground">{customer.aiProfile.needs}</span>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full h-10 px-3 bg-surface border border-border rounded-md text-sm focus:border-border-strong focus:outline-none";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
