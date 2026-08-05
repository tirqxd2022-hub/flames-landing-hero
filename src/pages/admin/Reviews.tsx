import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { reviewsApi, resolveAssetUrl, type AdminReview } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";

const inp = "h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm";

export default function AdminReviews() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminReview | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminReview | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    reviewsApi.list().then(setItems).catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function toggleActive(r: AdminReview) {
    setTogglingId(r.id);
    // Optimistic update so the row doesn't reflow while we wait.
    setItems((arr) => arr.map((x) => x.id === r.id ? { ...x, is_active: !r.is_active } : x));
    try {
      await reviewsApi.update(r.id, { is_active: !r.is_active });
    } catch (e) {
      // Roll back on failure.
      setItems((arr) => arr.map((x) => x.id === r.id ? { ...x, is_active: r.is_active } : x));
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  }
  async function handleDelete() {
    if (!deleting) return;
    try { await reviewsApi.remove(deleting.id); toast.success("Review deleted"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer testimonials shown on the Home page. The site rotates through them 3 at a time.
          </p>
        </div>
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--flame)] px-3 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Add review
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
            <tr>
              <th className="text-left px-4 py-3">Reviewer</th>
              <th className="text-left px-4 py-3">Quote</th>
              <th className="text-center px-4 py-3">Rating</th>
              <th className="text-center px-4 py-3">Sort</th>
              <th className="text-center px-4 py-3">Active</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-white/5 align-top">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {r.avatar_url
                      ? <OptimizedImage src={r.avatar_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover bg-white/5" />
                      : <div className="h-10 w-10 rounded-full bg-white/5 grid place-items-center text-xs text-muted-foreground">{r.name.slice(0,1)}</div>}
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.role}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-xl">
                  <p className="line-clamp-2">"{r.quote}"</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-0.5 text-[color:var(--gold)]">
                    {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{r.sort_order}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(r)} disabled={togglingId === r.id}
                    className={`inline-flex items-center justify-center gap-1 min-w-[70px] px-2 py-1 rounded-md text-xs font-medium disabled:opacity-70 ${r.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>
                    {togglingId === r.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : (r.is_active ? "Active" : "Hidden")}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => setEditing(r)} title="Edit"
                      className="h-8 w-8 grid place-items-center rounded-md border border-white/10 text-muted-foreground hover:text-white hover:border-white/30">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleting(r)} title="Delete"
                      className="h-8 w-8 grid place-items-center rounded-md border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-400/50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No reviews yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <ReviewDialog initial={editing} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-[color:var(--card)] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete review by {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReviewDialog({ initial, onClose, onSaved }: { initial: AdminReview | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [role, setRole] = useState(initial?.role || "");
  const [quote, setQuote] = useState(initial?.quote || "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url || "");
  const [rating, setRating] = useState<number>(initial?.rating ?? 5);
  const [sortOrder, setSortOrder] = useState<number>(initial?.sort_order ?? 0);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !quote.trim()) { toast.error("Name and quote are required."); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(), role: role.trim(), quote: quote.trim(),
        avatar_url: avatarUrl, rating, sort_order: sortOrder, is_active: isActive,
      };
      if (initial) await reviewsApi.update(initial.id, body);
      else await reviewsApi.create(body);
      toast.success("Saved"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[color:var(--card)] border-white/10 max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit review" : "Add review"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
            </label>
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Role / Title</div>
              <input value={role} onChange={(e) => setRole(e.target.value)} className={inp} placeholder="e.g. Regular Customer" />
            </label>
          </div>
          <label className="block">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Quote</div>
            <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={4} className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm" />
          </label>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Avatar</div>
            <div className="flex items-center gap-3">
              {avatarUrl && <OptimizedImage src={avatarUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover border border-white/10" />}
              <MediaPickerButton hasValue={!!avatarUrl} onPick={(u: string) => setAvatarUrl(u)} uploadFolder="page" />
              {avatarUrl && <button type="button" onClick={() => setAvatarUrl("")} className="text-xs text-muted-foreground hover:text-red-400">Remove</button>}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Rating</div>
              <select value={rating} onChange={(e) => setRating(parseInt(e.target.value))} className={inp}>
                {[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n>1?"s":""}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Sort order</div>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className={inp} />
            </label>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
            </label>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-white/10">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] text-white font-semibold disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
