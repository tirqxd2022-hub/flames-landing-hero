import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useAuth } from "@/lib/auth";
import OptimizedImage from "@/components/OptimizedImage";
import { formatCA } from "@/lib/datetime";

const LOGO_FALLBACK = "/uploads/flames-logo.png";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkIn, setCheckIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { login, user, kind } = useAuth();
  const settings = useSiteSettings() as Record<string, string>;
  const logoUrl = settings.logo_url || LOGO_FALLBACK;

  useEffect(() => {
    if (user && kind === "admin") nav("/admin", { replace: true });
  }, [user, kind, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await login(email.trim(), password, { checkIn });
      if (checkIn && r.attendance) {
        const at = formatCA(r.attendance.check_in_at);
        toast.success(r.attendance.reused ? `Already checked in (${at})` : `Checked in at ${at}`);
      }
      nav("/admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[color:var(--background)] p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-[color:var(--card)] border border-white/5 rounded-2xl p-6">
        <OptimizedImage src={logoUrl} alt="Flames Gourmet" width={160} height={40} fit="contain" priority className="h-10 w-auto mx-auto object-contain" />
        <h1 className="text-xl font-bold text-center mt-4">Admin Sign In</h1>
        <p className="text-xs text-muted-foreground text-center mt-1">Sign in with your administrator credentials.</p>
        <div className="mt-5 space-y-3">
          <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email or username" autoComplete="username" className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={checkIn} onChange={(e) => setCheckIn(e.target.checked)} />
            Check in for today
          </label>
        </div>
        <button disabled={loading} className="btn-flame w-full justify-center mt-5 disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
