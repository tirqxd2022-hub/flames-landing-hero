import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatCA } from "@/lib/datetime";
import { toast } from "sonner";

/**
 * Admin / Staff login modal.
 * Customer self-registration is intentionally disabled for now — the backend
 * /auth/register endpoint is still in place so we can re-enable it later
 * without further changes here.
 */
export default function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [checkIn, setCheckIn] = useState(true);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await login(form.email.trim(), form.password, { checkIn });
      if (checkIn && r.attendance) {
        const at = formatCA(r.attendance.check_in_at);
        toast.success(r.attendance.reused ? `Already checked in (${at})` : `Checked in at ${at}`);
      } else {
        toast.success("Welcome back!");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const inp = "w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[color:var(--card)] border-white/10">
        <DialogHeader><DialogTitle>Admin login</DialogTitle></DialogHeader>
        <form onSubmit={doLogin} className="space-y-3 mt-2">
          <input type="text" required placeholder="Email or username" autoComplete="username" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} />
          <input type="password" required placeholder="Password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} className={inp} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={checkIn} onChange={(e) => setCheckIn(e.target.checked)} />
            Check in for today
          </label>
          <button type="submit" disabled={busy} className="btn-flame w-full justify-center disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Staff only. Use the admin credentials provided to you.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
