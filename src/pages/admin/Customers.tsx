import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Search, ChevronLeft, ChevronRight, RefreshCw, Eye, Pencil } from "lucide-react";
import { customersApi, type AdminCustomer } from "@/lib/api";
import { SearchClearButton } from "@/components/ui/search-clear";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const id = setTimeout(() => setD(v), ms); return () => clearTimeout(id); }, [v, ms]);
  return d;
}

export default function AdminCustomers() {
  const [items, setItems] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<AdminCustomer | null>(null);
  const [viewing, setViewing] = useState<AdminCustomer | null>(null);
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", subscribed: true });
  const [saving, setSaving] = useState(false);
  const q = useDebounced(search, 300);

  const load = async () => {
    setLoading(true);
    try {
      const r = await customersApi.list({ page, limit, q });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, limit, q]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function toggleSubscribed(c: AdminCustomer) {
    const next = !c.subscribed;
    setItems((arr) => arr.map((x) => x.id === c.id ? { ...x, subscribed: next } : x));
    try { await customersApi.update(c.id, { subscribed: next }); }
    catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      setItems((arr) => arr.map((x) => x.id === c.id ? { ...x, subscribed: c.subscribed } : x));
    }
  }

  function openEdit(c: AdminCustomer) {
    setEditForm({ name: c.name, phone: c.phone || "", subscribed: !!c.subscribed });
    setEditing(c);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await customersApi.update(editing.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        subscribed: editForm.subscribed,
      });
      setItems((arr) => arr.map((x) => x.id === editing.id ? { ...x, name: editForm.name.trim(), phone: editForm.phone.trim() || null, subscribed: editForm.subscribed } : x));
      toast.success("Customer updated");
      setEditing(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await customersApi.remove(deleting.id);
      toast.success("Customer deleted");
      setItems((arr) => arr.filter((x) => x.id !== deleting.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(null); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">{total} total signed-up customer{total === 1 ? "" : "s"}.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-input hover:bg-secondary">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, phone…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm" />
          <SearchClearButton show={!!search} onClear={() => setSearch("")} />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          View
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {[25, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </label>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Phone</th>
                <th className="text-right px-3 py-2">Orders</th>
                <th className="text-left px-3 py-2">Subscribed</th>
                <th className="text-left px-3 py-2">Joined</th>
                <th className="text-left px-3 py-2">Last login</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  {loading ? "Loading…" : "No customers yet."}
                </td></tr>
              )}
              {items.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2"><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></td>
                  <td className="px-3 py-2">{c.phone || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.orders_count}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleSubscribed(c)}
                      className={`px-2 py-0.5 rounded-full text-xs ${c.subscribed ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}
                      title="Click to toggle"
                    >
                      {c.subscribed ? "Yes" : "No"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.last_login_at ? new Date(c.last_login_at).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewing(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleting(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-red-500" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Page {page} of {pages}</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-md border border-input disabled:opacity-40 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
          <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="p-1.5 rounded-md border border-input disabled:opacity-40 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} ({deleting?.email}) will be permanently removed. Their past orders will remain but become guest orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewing?.name}</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="text-sm grid grid-cols-[120px_1fr] gap-y-2">
              <dt className="text-muted-foreground">Email</dt><dd>{viewing.email}</dd>
              <dt className="text-muted-foreground">Phone</dt><dd>{viewing.phone || "—"}</dd>
              <dt className="text-muted-foreground">Orders</dt><dd>{viewing.orders_count}</dd>
              <dt className="text-muted-foreground">Subscribed</dt><dd>{viewing.subscribed ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Joined</dt><dd>{viewing.created_at ? new Date(viewing.created_at).toLocaleString() : "—"}</dd>
              <dt className="text-muted-foreground">Last login</dt><dd>{viewing.last_login_at ? new Date(viewing.last_login_at).toLocaleString() : "—"}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-xs text-muted-foreground">Name</span>
              <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Email</span>
              <input value={editing?.email || ""} disabled
                className="mt-1 h-9 w-full rounded-md border border-input bg-muted/40 px-2 text-sm text-muted-foreground" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Phone</span>
              <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editForm.subscribed}
                onChange={(e) => setEditForm((f) => ({ ...f, subscribed: e.target.checked }))} />
              <span>Subscribed to mailing list</span>
            </label>
          </div>
          <DialogFooter>
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md border border-input text-sm hover:bg-secondary">Cancel</button>
            <button onClick={saveEdit} disabled={saving || !editForm.name.trim()}
              className="px-3 py-1.5 rounded-md bg-[color:var(--flame)] text-white text-sm disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
