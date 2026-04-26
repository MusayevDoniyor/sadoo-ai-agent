import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "@/lib/auth";

export function TopBar() {
  const nav = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener("sadoo-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sadoo-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur supports-[backdrop-filter]:bg-surface/40 sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-6 rounded-md bg-foreground text-background grid place-items-center text-[11px] font-bold tracking-tight">S</div>
            <span className="text-sm font-semibold tracking-tight">SADOO</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-sm px-1.5 py-0.5">Live</span>
          </Link>
          {user && (
            <nav className="flex items-center gap-1 text-sm">
              {user.role === "ADMIN" && (
                <NavLink to="/admin" current={path}>Admin</NavLink>
              )}
              {user.role === "OPERATOR" && (
                <NavLink to="/operator" current={path}>Operator</NavLink>
              )}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {user.displayName} · <span className="uppercase tracking-wider">{user.role}</span>
              </span>
              <button
                onClick={() => { logout(); nav({ to: "/login" }); }}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 h-8"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="text-xs border border-border rounded-md px-3 h-8 grid place-items-center hover:border-border-strong">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, current, children }: { to: string; current: string; children: React.ReactNode }) {
  const active = current.startsWith(to);
  return (
    <Link
      to={to}
      className={`px-3 h-8 grid place-items-center rounded-md text-xs ${active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60"}`}
    >
      {children}
    </Link>
  );
}
