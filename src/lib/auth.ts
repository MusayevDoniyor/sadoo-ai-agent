import type { User } from "@/types";

// Hardcoded users. In production this would be Lovable Cloud auth.
const USERS: Array<User & { password: string }> = [
  { id: "admin", username: "admin", password: "admin123", role: "ADMIN", displayName: "Admin" },
  { id: "OP028", username: "otabeklv", password: "qwerty_654321", role: "OPERATOR", displayName: "Otabek L." },
  { id: "OP002", username: "operator2", password: "op123", role: "OPERATOR", displayName: "Sardor M." },
  { id: "OP003", username: "operator3", password: "op123", role: "OPERATOR", displayName: "Dilnoza R." },
];

const KEY = "sadoo.user";

export function login(username: string, password: string): User | null {
  const u = USERS.find((x) => x.username === username && x.password === password);
  if (!u) return null;
  const user: User = { id: u.id, username: u.username, role: u.role, displayName: u.displayName };
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("sadoo-auth-change"));
  }
  return user;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("sadoo-auth-change"));
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export function listOperators(): User[] {
  return USERS.filter((u) => u.role === "OPERATOR").map(({ password: _p, ...u }) => u);
}
