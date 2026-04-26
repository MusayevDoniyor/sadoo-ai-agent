export function StatusDot({ status }: { status: "available" | "on_call" | "busy" | "offline" | "waiting" | "active" }) {
  const map: Record<string, string> = {
    available: "bg-[oklch(0.72_0.18_150)]",
    active: "bg-[oklch(0.72_0.18_150)]",
    on_call: "bg-[oklch(0.78_0.16_80)]",
    waiting: "bg-[oklch(0.78_0.16_80)]",
    busy: "bg-[oklch(0.62_0.21_25)]",
    offline: "bg-muted-foreground/40",
  };
  return <span className={`inline-block size-1.5 rounded-full ${map[status]} ${status === "available" || status === "active" || status === "on_call" || status === "waiting" ? "pulse-dot" : ""}`} />;
}

export function SegmentBadge({ segment }: { segment?: string }) {
  if (!segment) return null;
  const map: Record<string, string> = {
    VIP: "border-[oklch(0.78_0.16_80)] text-[oklch(0.85_0.16_80)] bg-[oklch(0.78_0.16_80)]/10",
    Premium: "border-foreground/30 text-foreground bg-foreground/5",
    Mass: "border-border text-muted-foreground",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${map[segment] ?? "border-border text-muted-foreground"}`}>
      {segment}
    </span>
  );
}

export function RiskBadge({ risk }: { risk?: string }) {
  if (!risk) return null;
  const map: Record<string, string> = {
    Low: "text-[oklch(0.72_0.18_150)] border-[oklch(0.72_0.18_150)]/40",
    Medium: "text-[oklch(0.78_0.16_80)] border-[oklch(0.78_0.16_80)]/40",
    High: "text-[oklch(0.65_0.21_25)] border-[oklch(0.65_0.21_25)]/40",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${map[risk]}`}>Risk: {risk}</span>;
}
