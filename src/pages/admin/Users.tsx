import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminApi, ADMIN_PAGE_OPTIONS, ROLE_LABEL,
  type AdminMe, type AdminRole, type AdminUserRow,
} from "@/lib/api";

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "kitchen_manager", label: "Kitchen Manager" },
  { value: "counter_sales", label: "Counter Sales" },
  { value: "store_manager", label: "Store Manager" },
  { value: "seo_manager", label: "SEO Manager" },
];

function formatLastLogin(v: string | null) {
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminUsers() {
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [me, setMe] = useState<AdminMe | null>(null);

  const [form, setForm] = useState<{ username: string; email: string; password: string; role: AdminRole }>({
    username: "", email: "", password: "", role: "admin",
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: number; username: string; email: string; password: string; role: AdminRole } | null>(null);

  async function load() {
    try { const r = await adminApi.listUsers(); setItems(r.items); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load users"); }
  }
  useEffect(() => {
    adminApi.me().then((r) => setMe(r.user)).catch(() => setMe(null));
    load();
  }, []);


  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createUser(form);
      toast.success("Admin user created");
      setForm({ username: "", email: "", password: "", role: "admin" });
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create user"); }
    finally { setSaving(false); }
  }

  async function onDelete(u: AdminUserRow) {
    if (!confirm(`Delete admin user "${u.username}"?`)) return;
    try { await adminApi.deleteUser(u.id); toast.success("User deleted"); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to delete"); }
  }


  async function saveEdit() {
    if (!editing) return;
    const payload: { email?: string; password?: string; role?: AdminRole } = {};
    if (editing.email) payload.email = editing.email;
    if (editing.password) {
      if (editing.password.length < 8) return toast.error("Password must be at least 8 characters");
      payload.password = editing.password;
    }
    if (editing.role) payload.role = editing.role;
    try { await adminApi.updateUser(editing.id, payload); toast.success("User updated"); setEditing(null); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to update"); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage admin panel accounts.</p>
      </div>

      <form onSubmit={onCreate} className="grid gap-3 rounded-xl border border-white/5 bg-[color:var(--card)] p-4 sm:grid-cols-5">
        <input required minLength={2} maxLength={64} pattern="[a-zA-Z0-9_.\-]+" placeholder="Username"
          className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm" value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input required type="email" maxLength={255} placeholder="Email"
          className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required type="password" minLength={8} placeholder="Password (min 8)"
          className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm" value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" disabled={saving}
          className="rounded-md bg-[color:var(--flame)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Adding…" : "Add user"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-[color:var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Username</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Last login</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              return (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium">{u.username}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-xs">{ROLE_LABEL[u.role] || u.role}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatLastLogin(u.last_login_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <a href={`/admin/reports?tab=attendance&user=${u.id}`}
                      className="mr-2 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Show attendance</a>
                    <button onClick={() => setEditing({ id: u.id, username: u.username, email: u.email, password: "", role: u.role })}
                      className="mr-2 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Edit</button>
                    <button onClick={() => onDelete(u)}
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                      Delete
                    </button>
                  </td>

                </tr>
              );
            })}

            {items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No admin users yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {me?.is_super && <RoleManagementCard />}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-xl bg-[color:var(--card)] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Edit user</h3>
            <p className="mt-1 text-xs text-muted-foreground">Username cannot be changed.</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Username</div>
                <input value={editing.username} disabled className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-sm" />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</div>
                <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm" />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</div>
                <select value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as AdminRole })}
                  className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm">
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">New password (leave blank to keep current)</div>
                <input type="password" minLength={8} placeholder="Min 8 characters" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-md border border-white/10 px-4 py-2 text-sm">Cancel</button>
              <button onClick={saveEdit} className="rounded-md bg-[color:var(--flame)] px-4 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type RolePerms = { permissions: string[]; custom: boolean; defaults: string[] };
type PageOpt = { key: string; label: string };
const MANAGED_ROLES: { value: Exclude<AdminRole, "super">; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "kitchen_manager", label: "Kitchen Manager" },
  { value: "counter_sales", label: "Counter Sales" },
  { value: "store_manager", label: "Store Manager" },
  { value: "seo_manager", label: "SEO Manager" },
];

function RoleManagementCard() {
  const [data, setData] = useState<Record<string, RolePerms> | null>(null);
  const [pages, setPages] = useState<PageOpt[]>(ADMIN_PAGE_OPTIONS);
  const [pending, setPending] = useState<Record<string, string[]>>({});
  const [activeRole, setActiveRole] = useState<string>(MANAGED_ROLES[0].value);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  async function load() {
    try {
      const r = await adminApi.getRolePermissions();
      setData(r.items);
      if (Array.isArray(r.pages) && r.pages.length) setPages(r.pages);
      setPending({});
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load role permissions"); }
  }
  useEffect(() => { load(); }, []);

  function getPerms(role: string): string[] {
    return pending[role] ?? data?.[role]?.permissions ?? [];
  }
  function toggle(role: string, key: string) {
    const current = getPerms(role);
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setPending({ ...pending, [role]: next });
  }
  async function save(role: string) {
    setSavingRole(role);
    try {
      await adminApi.updateRolePermissions(role as AdminRole, pending[role] ?? data?.[role]?.permissions ?? []);
      toast.success(`Permissions saved for ${ROLE_LABEL[role]}`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save permissions"); }
    finally { setSavingRole(null); }
  }
  async function resetDefaults(role: string) {
    setSavingRole(role);
    try {
      await adminApi.updateRolePermissions(role as AdminRole, null);
      toast.success(`Reset to defaults for ${ROLE_LABEL[role]}`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to reset"); }
    finally { setSavingRole(null); }
  }

  const dirty = pending[activeRole] !== undefined;
  const current = data?.[activeRole];

  return (
    <section className="rounded-xl border border-white/5 bg-[color:var(--card)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">User Role Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure which admin pages each role can access. Settings apply to every user assigned that role.
          </p>
        </div>
      </div>


      <div className="mt-5 flex flex-wrap gap-1 border-b border-white/10">
        {MANAGED_ROLES.map((r) => (
          <button key={r.value} onClick={() => setActiveRole(r.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeRole === r.value
                ? "border-[color:var(--flame)] text-[color:var(--flame-light)]"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">{current?.custom ? "Using custom permissions" : "Using role defaults"}</div>
            <div className="flex gap-2">
              <button onClick={() => resetDefaults(activeRole)} disabled={savingRole === activeRole}
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-60">Reset to defaults</button>
              <button onClick={() => save(activeRole)} disabled={!dirty || savingRole === activeRole}
                className="rounded-md bg-[color:var(--flame)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {savingRole === activeRole ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => {
              const perms = getPerms(activeRole);
              return (
                <label key={p.key} className="flex items-center gap-2 rounded-md border border-white/10 bg-background px-3 py-2 text-sm">
                  <input type="checkbox" checked={perms.includes(p.key)} onChange={() => toggle(activeRole, p.key)} />
                  <span>{p.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
