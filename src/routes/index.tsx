import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <section className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-3 py-1 mb-8">
            <span className="size-1.5 rounded-full bg-[oklch(0.72_0.18_150)] pulse-dot" />
            Real-time AI copilot · Live now
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-balance">
            The AI call center<br />
            <span className="text-muted-foreground">for SADOO bank.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl mx-auto text-balance">
            Operators get the right words, the right tone, and the right offer — in under two seconds. Every call.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/login" className="h-11 px-5 grid place-items-center bg-foreground text-background rounded-md text-sm font-medium hover:bg-foreground/90">
              Sign in
            </Link>
            <Link to="/join" className="h-11 px-5 grid place-items-center border border-border rounded-md text-sm hover:border-border-strong">
              Join as customer
            </Link>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {[
              { k: "<2s", v: "Copilot latency" },
              { k: "8+", v: "Live formulas" },
              { k: "50+", v: "CRM clients seeded" },
            ].map((s) => (
              <div key={s.v} className="bg-surface p-6 text-left">
                <div className="text-3xl font-semibold tracking-tight">{s.k}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
