import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import { useStore } from "@/store/useStore";
import { SegmentBadge, RiskBadge, StatusDot } from "@/components/Badges";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const nav = useNavigate();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { nav({ to: "/login" }); return; }
    if (u.role !== "ADMIN") { nav({ to: "/operator" }); return; }
    setOk(true);
  }, [nav]);
  if (!ok) return null;
  return <AdminDash />;
}

type Tab = "overview" | "queue" | "operators" | "formulas" | "memory" | "watch";

function AdminDash() {
  const [tab, setTab] = useState<Tab>("overview");
  const queue = useStore((s) => s.queue);
  const activeCalls = useStore((s) => s.activeCalls);
  const operators = useStore((s) => s.operators);
  const formulas = useStore((s) => s.formulas);
  const memory = useStore((s) => s.memory);
  const callHistory = useStore((s) => s.callHistory);
  const clients = useStore((s) => s.clients);

  const ops = Array.from(operators.values());
  const calls = Array.from(activeCalls.values());

  const stats = useMemo(() => {
    const intentCount: Record<string, number> = {};
    const langCount: Record<string, number> = {};
    const resultCount: Record<string, number> = {};
    let scoreSum = 0;
    for (const c of callHistory) {
      intentCount[c.Primary_Intent] = (intentCount[c.Primary_Intent] ?? 0) + 1;
      langCount[c.Language] = (langCount[c.Language] ?? 0) + 1;
      resultCount[c.Sale_Result] = (resultCount[c.Sale_Result] ?? 0) + 1;
      scoreSum += c.Checklist_Score_Pct;
    }
    return {
      intents: Object.entries(intentCount).sort((a, b) => b[1] - a[1]),
      languages: Object.entries(langCount),
      results: Object.entries(resultCount),
      avgScore: callHistory.length ? Math.round(scoreSum / callHistory.length) : 0,
    };
  }, [callHistory]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex items-center gap-1 -mb-px">
          {([
            ["overview", "Overview"],
            ["queue", `Queue (${queue.length})`],
            ["operators", `Operators (${ops.length})`],
            ["formulas", "Formulas"],
            ["memory", `Memory (${memory.size})`],
            ["watch", `Watch live (${calls.length})`],
          ] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 h-11 text-xs border-b-2 ${tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KPI label="Active calls" value={calls.length} sub={`${ops.filter(o => o.status === "on_call").length} operators on call`} />
            <KPI label="Queue depth" value={queue.length} sub={`${queue.filter(q => q.status === "waiting").length} waiting`} />
            <KPI label="Operators online" value={`${ops.filter(o => o.status !== "offline").length}/${ops.length}`} sub={`${ops.filter(o => o.status === "available").length} available`} />
            <KPI label="Avg checklist (history)" value={`${stats.avgScore}%`} sub={`${callHistory.length} historical calls`} />
            <KPI label="CRM clients" value={clients.size} sub="Seeded from Excel" />
            <KPI label="Active formulas" value={formulas.length} sub="Top picked by Gemini" />

            <div className="lg:col-span-2 border border-border rounded-lg p-5 bg-surface">
              <H>Calls by intent</H>
              <div className="space-y-1.5 mt-3">
                {stats.intents.slice(0, 8).map(([k, v]) => (
                  <Bar key={k} label={k} value={v} max={stats.intents[0][1]} />
                ))}
              </div>
            </div>
            <div className="border border-border rounded-lg p-5 bg-surface space-y-4">
              <div>
                <H>Sale results</H>
                <div className="space-y-1.5 mt-2">
                  {stats.results.map(([k, v]) => <Bar key={k} label={k} value={v} max={Math.max(...stats.results.map(r => r[1]))} />)}
                </div>
              </div>
              <div>
                <H>Language</H>
                <div className="space-y-1.5 mt-2">
                  {stats.languages.map(([k, v]) => <Bar key={k} label={k === "UZ" ? "O'zbek" : "Русский"} value={v} max={Math.max(...stats.languages.map(r => r[1]))} />)}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "queue" && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase tracking-widest text-muted-foreground">
                <tr><Th>Customer</Th><Th>Phone</Th><Th>Reason</Th><Th>Lang</Th><Th>Wait</Th><Th>Status</Th><Th>Profile</Th></tr>
              </thead>
              <tbody>
                {queue.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">Queue is empty.</td></tr>}
                {queue.map((q) => (
                  <tr key={q.id} className="border-t border-border">
                    <Td><span className="font-medium">{q.name}</span></Td>
                    <Td className="text-muted-foreground">{q.phone}</Td>
                    <Td className="text-muted-foreground max-w-xs truncate">{q.reason}</Td>
                    <Td>{q.language}</Td>
                    <Td className="text-muted-foreground">{Math.floor((Date.now() - q.joinedAt) / 1000)}s</Td>
                    <Td><span className="flex items-center gap-1.5"><StatusDot status={q.status === "in_call" ? "on_call" : "waiting"} /> {q.status}</span></Td>
                    <Td className="text-xs text-muted-foreground max-w-xs truncate">{q.aiProfile.needs || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "operators" && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase tracking-widest text-muted-foreground">
                <tr><Th>Operator</Th><Th>Status</Th><Th>Calls today</Th><Th>Conversions</Th><Th>Conv. rate</Th></tr>
              </thead>
              <tbody>
                {ops.sort((a, b) => b.callsToday - a.callsToday).map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <Td><div className="font-medium">{o.displayName}</div><div className="text-xs text-muted-foreground">{o.username}</div></Td>
                    <Td><span className="flex items-center gap-1.5 capitalize"><StatusDot status={o.status} /> {o.status.replace("_", " ")}</span></Td>
                    <Td>{o.callsToday}</Td>
                    <Td>{o.conversions}</Td>
                    <Td>{o.callsToday ? Math.round((o.conversions / o.callsToday) * 100) : 0}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "formulas" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {formulas
              .map((f) => ({ ...f, rate: f.useCount ? f.successCount / f.useCount : 0 }))
              .sort((a, b) => b.rate - a.rate)
              .map((f, i) => (
                <div key={f.id} className="border border-border rounded-lg p-4 bg-surface">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">#{i + 1}</span>
                      <span className="font-medium text-sm">{f.title}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{f.type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">{f.pattern}</div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{f.useCount} uses · {f.successCount} sold</span>
                    <span className="font-semibold">{Math.round(f.rate * 100)}%</span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === "memory" && <MemoryBrowser memory={memory} />}

        {tab === "watch" && (
          <div className="space-y-4">
            {calls.length === 0 && <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-8 text-center">No live calls right now.</div>}
            {calls.map((c) => (
              <div key={c.id} className="border border-border rounded-lg bg-surface">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div>
                    <div className="text-sm font-medium">{c.customer.name} ↔ {operators.get(c.operatorId)?.displayName}</div>
                    <div className="text-xs text-muted-foreground">{c.customer.reason}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{Math.floor((Date.now() - c.startedAt) / 1000)}s</div>
                </div>
                <div className="max-h-72 overflow-y-auto p-4 space-y-2">
                  {c.transcript.length === 0 && <div className="text-xs text-muted-foreground">No turns yet.</div>}
                  {c.transcript.map((t, i) => (
                    <div key={i} className={`text-xs ${t.speaker === "operator" ? "text-foreground" : "text-muted-foreground"}`}>
                      <span className="uppercase tracking-widest text-[9px] mr-2">{t.speaker}</span>{t.text}
                    </div>
                  ))}
                </div>
                {c.copilot && (
                  <div className="border-t border-border p-3 text-xs">
                    <span className="text-muted-foreground">AI says: </span>
                    <span className="italic">"{c.copilot.script}"</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryBrowser({ memory }: { memory: ReturnType<typeof useStore.getState>["memory"] }) {
  const [q, setQ] = useState("");
  const list = Array.from(memory.values()).filter((m) =>
    !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.phone.includes(q)
  ).sort((a, b) => b.callCount - a.callCount);
  const clients = useStore((s) => s.clients);

  return (
    <div className="space-y-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…"
        className="w-full max-w-md h-10 px-3 bg-surface border border-border rounded-md text-sm" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.slice(0, 40).map((m) => {
          const code = parseInt(m.phone, 10);
          const crm = clients.get(code);
          return (
            <div key={m.phone} className="border border-border rounded-lg p-4 bg-surface">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{m.name}</div>
                <div className="flex items-center gap-1.5">
                  {crm && <SegmentBadge segment={crm.SEGMENT} />}
                  {crm && <RiskBadge risk={crm.RISK_LEVEL} />}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">#{m.phone} · {m.callCount} calls · last {m.lastCallDate}</div>
              <div className="text-xs mt-2 italic text-muted-foreground line-clamp-2">{m.summary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="border border-border rounded-lg p-5 bg-surface">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold tracking-tight mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-normal px-4 py-2.5">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground truncate">{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1 bg-surface-2 rounded-full overflow-hidden mt-1">
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
