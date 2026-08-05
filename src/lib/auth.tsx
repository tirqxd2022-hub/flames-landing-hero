import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const ENV_BASE = (import.meta.env.VITE_API_URL as string | undefined);
const HOST = typeof window !== "undefined" ? window.location.hostname : "";
const IS_LOVABLE_HOST = HOST.endsWith(".lovable.app") || HOST === "lovable.app";
const BASE = ENV_BASE || (IS_LOVABLE_HOST ? undefined : "/api");

export type AuthUser = {
  id: number; email: string; name: string;
  username?: string; full_name?: string | null;
  phone?: string | null; avatar_url?: string | null;
  role: string; is_super?: boolean; permissions?: string[];
};
export type AuthKind = "admin" | "customer";

export type ProfileUpdate = {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  email?: string;
  current_password?: string;
  new_password?: string;
};

export type LoginResult = { attendance: { check_in_at: string; reused: boolean } | null };
export type LogoutResult = { attendance: { check_in_at: string; check_out_at: string } | null };

type AuthCtx = {
  user: AuthUser | null;
  kind: AuthKind | null;
  loading: boolean;
  login: (email: string, password: string, opts?: { checkIn?: boolean }) => Promise<LoginResult>;
  register: (input: { email: string; name: string; phone?: string; password: string }) => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
  refresh: () => Promise<void>;
  logout: (opts?: { checkOut?: boolean }) => Promise<LogoutResult>;
  isStaff: boolean;     // admin | kitchen_manager | counter_sales | super
  canAdminPanel: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);
const TOKEN_KEY = "fg_auth_token";

function cookieDomain(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  // Share across subdomains (e.g. new.flamesgourmet.ca -> .flamesgourmet.ca)
  return "." + parts.slice(-2).join(".");
}

function setTokenCookie(token: string) {
  if (typeof document === "undefined") return;
  const d = cookieDomain();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domain = d ? `; Domain=${d}` : "";
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}${domain}`;
}

function clearTokenCookie() {
  if (typeof document === "undefined") return;
  const d = cookieDomain();
  const domain = d ? `; Domain=${d}` : "";
  document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax${domain}`;
  document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function readTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + TOKEN_KEY + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getAuthToken(): string | null {
  const cookie = readTokenCookie();
  if (cookie) {
    try { if (localStorage.getItem(TOKEN_KEY) !== cookie) localStorage.setItem(TOKEN_KEY, cookie); } catch { /* ignore */ }
    return cookie;
  }
  const ls = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  if (ls) setTokenCookie(ls); // migrate
  return ls;
}

function persistToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
  setTokenCookie(token);
}

function purgeToken() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem("admin_token"); } catch { /* ignore */ }
  clearTokenCookie();
}


async function apiFetch(path: string, init?: RequestInit) {
  if (!BASE) throw new Error("Backend not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [kind, setKind] = useState<AuthKind | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!BASE) { setLoading(false); return; }
      const token = getAuthToken();
      if (!token) { setUser(null); setKind(null); setLoading(false); return; }
      setLoading(true);
      apiFetch("/auth/me")
        .then((r) => { if (!cancelled) { setUser(r.user); setKind(r.kind); } })
        .catch(() => {
          purgeToken();
          if (!cancelled) { setUser(null); setKind(null); }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === null) sync();
    };
    const onFocus = () => sync();
    const onInvalid = () => { purgeToken(); setUser(null); setKind(null); setLoading(false); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("auth:invalid", onInvalid);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("auth:invalid", onInvalid);
    };
  }, []);

  // End-of-day auto-logout for staff (non-super). Ensures next-day attendance
  // is captured by forcing a fresh login each Canadian calendar day. Handles
  // the case where the machine was off/asleep at midnight by re-checking on
  // mount, focus, and visibility changes.
  useEffect(() => {
    if (!user || kind !== "admin" || user.is_super) return;
    const CA_TZ = "America/Toronto";
    const caDate = (d: Date) => new Intl.DateTimeFormat("en-CA", {
      timeZone: CA_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
    const LOGIN_DAY_KEY = "fg_login_day";

    let timer: number | undefined;
    let disposed = false;

    const forceLogout = () => {
      if (disposed) return;
      disposed = true;
      try { localStorage.removeItem(LOGIN_DAY_KEY); } catch { /* ignore */ }
      logout({ checkOut: true }).catch(() => { /* ignore */ });
    };

    const checkDay = () => {
      const today = caDate(new Date());
      let stored: string | null = null;
      try { stored = localStorage.getItem(LOGIN_DAY_KEY); } catch { /* ignore */ }
      if (!stored) {
        try { localStorage.setItem(LOGIN_DAY_KEY, today); } catch { /* ignore */ }
        return false;
      }
      if (stored !== today) {
        forceLogout();
        return true;
      }
      return false;
    };

    const scheduleNext = () => {
      if (timer) window.clearTimeout(timer);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: CA_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).formatToParts(new Date());
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
      const secondsToday = get("hour") * 3600 + get("minute") * 60 + get("second");
      // Cap at ~1h so wall-clock skew / sleep can't skip the fire window.
      const msUntilMidnight = Math.min((86400 - secondsToday) * 1000 + 2000, 60 * 60 * 1000);
      timer = window.setTimeout(() => {
        if (!checkDay()) scheduleNext();
      }, msUntilMidnight);
    };

    if (checkDay()) return;
    scheduleNext();

    const onWake = () => {
      if (document.visibilityState !== "hidden") {
        if (!checkDay()) scheduleNext();
      }
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, kind, user?.is_super]);



  async function login(email: string, password: string, opts?: { checkIn?: boolean }) {
    const body: Record<string, unknown> = { email, password };
    if (opts?.checkIn) body.check_in = true;
    const r = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) });
    persistToken(r.token);
    if (r.kind === "admin") { try { localStorage.setItem("admin_token", r.token); } catch { /* ignore */ } }
    else { try { localStorage.removeItem("admin_token"); } catch { /* ignore */ } }
    // Stamp the Canadian calendar day of this login so the mount-check on a
    // future day (e.g. computer was off at midnight) can force re-login.
    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      localStorage.setItem("fg_login_day", today);
    } catch { /* ignore */ }
    setUser(r.user); setKind(r.kind);
    return { attendance: r.attendance ?? null };
  }

  async function register(input: { email: string; name: string; phone?: string; password: string }) {
    const r = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(input) });
    persistToken(r.token);
    setUser(r.user); setKind(r.kind);
  }
  async function refresh() {
    if (!BASE || !getAuthToken()) return;
    const r = await apiFetch("/auth/me");
    setUser(r.user); setKind(r.kind);
  }
  async function updateProfile(patch: ProfileUpdate) {
    await apiFetch("/auth/profile", { method: "PATCH", body: JSON.stringify(patch) });
    await refresh();
  }
  async function logout(opts?: { checkOut?: boolean }): Promise<LogoutResult> {
    let attendance: LogoutResult["attendance"] = null;
    try {
      if (BASE && getAuthToken()) {
        const r = await apiFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ check_out: !!opts?.checkOut }),
        });
        attendance = r?.attendance ?? null;
      }
    } catch { /* ignore — always clear client state */ }
    try { localStorage.removeItem("fg_login_day"); } catch { /* ignore */ }
    purgeToken();
    setUser(null); setKind(null);
    return { attendance };
  }



  const isStaff = kind === "admin";
  const canAdminPanel = isStaff && (user?.is_super || (user?.permissions?.length ?? 0) > 0);

  return (
    <Ctx.Provider value={{ user, kind, loading, login, register, updateProfile, refresh, logout, isStaff, canAdminPanel }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
