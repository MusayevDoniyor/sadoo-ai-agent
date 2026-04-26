import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = login(u.trim(), p);
    if (!user) { setErr("Invalid credentials"); return; }
    nav({ to: user.role === "ADMIN" ? "/admin" : "/operator" });
  };

  const fill = (un: string, pw: string) => { setU(un); setP(pw); };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-center">Sign in</h1>
        <p className="text-sm text-muted-foreground text-center mt-2">Operator or admin access.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Username</label>
            <input value={u} onChange={(e) => setU(e.target.value)} autoFocus
              className="mt-1 w-full h-10 px-3 bg-surface border border-border rounded-md text-sm focus:border-border-strong focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <input type="password" value={p} onChange={(e) => setP(e.target.value)}
              className="mt-1 w-full h-10 px-3 bg-surface border border-border rounded-md text-sm focus:border-border-strong focus:outline-none" />
          </div>
          {err && <div className="text-xs text-destructive">{err}</div>}
          <button type="submit" className="w-full h-10 bg-foreground text-background rounded-md text-sm font-medium hover:bg-foreground/90">
            Sign in
          </button>
        </form>

        <div className="mt-8 border-t border-border pt-6">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Demo accounts</div>
          <div className="space-y-1.5">
            {[
              ["admin", "admin123", "Admin"],
              ["otabeklv", "qwerty_654321", "Operator"],
              ["operator2", "op123", "Operator"],
              ["operator3", "op123", "Operator"],
            ].map(([un, pw, label]) => (
              <button key={un} type="button" onClick={() => fill(un, pw)}
                className="w-full flex items-center justify-between text-left px-3 h-9 border border-border rounded-md hover:border-border-strong text-xs">
                <span>{un} <span className="text-muted-foreground">/ {pw}</span></span>
                <span className="text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
