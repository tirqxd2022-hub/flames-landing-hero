import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

/**
 * Super-Admin "Change password" / account credentials page inside admin panel.
 * Lets the logged-in super admin change their email and password.
 */
export default function AdminAccount() {
  const { user, loading, updateProfile, refresh } = useAuth();
  const [form, setForm] = useState({ email: "", current_password: "", new_password: "", confirm_password: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  useEffect(() => { if (user) setForm((f) => ({ ...f, email: user.email })); }, [user]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!user.is_super) return <Navigate to="/admin/dashboard" replace />;


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.new_password && form.new_password !== form.confirm_password) {
      return toast.error("New passwords do not match");
    }
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {};
      if (form.email && form.email !== user?.email) patch.email = form.email;
      if (form.new_password) {
        if (!form.current_password) throw new Error("Enter your current password");
        patch.current_password = form.current_password;
        patch.new_password = form.new_password;
      }
      if (Object.keys(patch).length === 0) return toast.info("Nothing to update");
      await updateProfile(patch);
      setForm((s) => ({ ...s, current_password: "", new_password: "", confirm_password: "" }));
      toast.success("Credentials updated");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Update failed"); }
    finally { setBusy(false); }
  }

  const inp = "h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm";

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Change password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update the email and password for your account ({user?.username || user?.email}).</p>
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border border-white/5 bg-[color:var(--card)] p-5 space-y-4">
        <label className="block">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Email</div>
          <input type="email" className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label className="block">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Current password</div>
          <input type="password" className={inp} value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">New password</div>
            <input type="password" minLength={6} className={inp} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
          </label>
          <label className="block">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Confirm new password</div>
            <input type="password" minLength={6} className={inp} value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="rounded-md bg-[color:var(--flame)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
