import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { User as UserIcon, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, adminApi } from "@/lib/api";
import { useViewAs, SUPER } from "@/lib/view-as";

export default function Profile() {
  const { user, kind, loading, updateProfile } = useAuth();
  const viewAs = useViewAs(!!user?.is_super);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", avatar_url: "",
    current_password: "", new_password: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      full_name: user.full_name || user.name || "",
      phone: user.phone || "",
      email: user.email || "",
      avatar_url: user.avatar_url || "",
    }));
  }, [user]);

  if (loading) return <section className="pt-32 pb-20 text-center text-muted-foreground">Loading…</section>;
  if (!user) return <Navigate to="/" replace />;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setBusy(true);
      const r = await adminApi.upload(f, "page");
      setForm((s) => ({ ...s, avatar_url: r.url }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setBusy(false); }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url || null,
      };
      if (form.email.trim() && form.email.trim() !== user!.email) patch.email = form.email.trim();
      if (form.new_password) {
        if (form.new_password.length < 6) throw new Error("New password must be at least 6 characters");
        if (!form.current_password) throw new Error("Enter your current password to change it");
        patch.current_password = form.current_password;
        patch.new_password = form.new_password;
      }
      await updateProfile(patch);
      setForm((s) => ({ ...s, current_password: "", new_password: "" }));
      toast.success("Profile updated");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Update failed"); }
    finally { setBusy(false); }
  }

  const inp = "w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm";
  const roleLabel = ROLE_LABEL[user.is_super ? "super" : user.role] || user.role;

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Your profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your personal details and login credentials. Account type: <span className="text-[color:var(--gold)] uppercase tracking-wider">{roleLabel}</span>
        </p>

        <form onSubmit={onSave} className="mt-8 rounded-2xl bg-[color:var(--card)] border border-white/5 p-6 space-y-6">
          {user.is_super && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground" htmlFor="view-as">View as</label>
              <select
                id="view-as"
                value={viewAs.role}
                onChange={(e) => viewAs.setRole(e.target.value)}
                className="rounded-lg border border-white/10 bg-[color:var(--background)] px-3 py-2 text-sm"
              >
                {viewAs.roleOptions.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>
                ))}
              </select>
              {viewAs.role !== SUPER && (
                <button type="button" onClick={() => viewAs.setRole(SUPER)}
                  className="text-xs text-muted-foreground hover:text-[color:var(--gold)]">Reset</button>
              )}
            </div>
          )}
          {viewAs.simulating && (
            <p className="rounded-lg border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-3 py-2 text-xs text-[color:var(--gold)]">
              Previewing the site as <strong>{ROLE_LABEL[viewAs.role] || viewAs.role}</strong>. Menus reflect that role's permissions.
            </p>
          )}
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-[color:var(--flame)] grid place-items-center text-white">
              {form.avatar_url
                ? <img src={form.avatar_url} alt="" className="h-full w-full object-cover" />
                : <UserIcon className="h-9 w-9" />}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-60">
                <Upload className="h-4 w-4" /> Change profile picture
              </button>
              {form.avatar_url && (
                <button type="button" onClick={() => setForm((s) => ({ ...s, avatar_url: "" }))}
                  className="ml-2 text-xs text-muted-foreground hover:text-red-400">Remove</button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Full name</div>
              <input className={inp} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Mobile number</div>
              <input className={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            {kind === "admin" && (
              <label className="block">
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Username (login id)</div>
                <input className={`${inp} opacity-70 cursor-not-allowed`} value={user.username || ""} disabled readOnly />
                <div className="text-[11px] text-muted-foreground mt-1">Username cannot be changed.</div>
              </label>
            )}
            <label className={`block ${kind === "admin" ? "" : "sm:col-span-2"}`}>
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Email</div>
              <input type="email" className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
          </div>

          <div className="border-t border-white/5 pt-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Change password</h2>
            <p className="text-xs text-muted-foreground mt-1">Leave blank to keep your current password.</p>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              <input type="password" placeholder="Current password" className={inp} value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
              <input type="password" placeholder="New password (min 6)" className={inp} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="btn-flame disabled:opacity-60">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
