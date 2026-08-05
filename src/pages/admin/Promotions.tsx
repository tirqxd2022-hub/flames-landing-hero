import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X, GripVertical, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { promotionsApi, resolveAssetUrl, type Promotion, type PromotionInput, type PromotionSlide } from "@/lib/api";
import { MediaPickerButton, VideoPickerButton } from "@/components/admin/MediaPickerButton";

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(String(url || ""));
}
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FormState = {
  name: string;
  isActive: boolean;
  daysOfWeek: number[];
  dateStart: string;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
  slideDurationMs: number;
  slides: PromotionSlide[];
};

const EMPTY: FormState = {
  name: "", isActive: true, daysOfWeek: [],
  dateStart: "", dateEnd: "", timeStart: "", timeEnd: "",
  slideDurationMs: 5000, slides: [],
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminPromotions() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setLoading(true);
    try {
      const r = await promotionsApi.list();
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load promotions");
    } finally { setLoading(false); }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({
      name: p.name,
      isActive: p.isActive,
      daysOfWeek: p.daysOfWeek || [],
      dateStart: p.dateStart ? String(p.dateStart).slice(0, 10) : "",
      dateEnd: p.dateEnd ? String(p.dateEnd).slice(0, 10) : "",
      timeStart: p.timeStart ? String(p.timeStart).slice(0, 5) : "",
      timeEnd: p.timeEnd ? String(p.timeEnd).slice(0, 5) : "",
      slideDurationMs: p.slideDurationMs,
      slides: p.slides.map((s) => ({ imageUrl: s.imageUrl, sortOrder: s.sortOrder })),
    });
    setCreating(true);
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter((x) => x !== d)
        : [...f.daysOfWeek, d].sort(),
    }));
  }

  function addSlide(url: string) {
    setForm((f) => ({ ...f, slides: [...f.slides, { imageUrl: url, sortOrder: f.slides.length }] }));
  }
  function removeSlide(i: number) {
    setForm((f) => ({ ...f, slides: f.slides.filter((_, idx) => idx !== i) }));
  }
  function moveSlide(i: number, dir: -1 | 1) {
    setForm((f) => {
      const next = f.slides.slice();
      const j = i + dir;
      if (j < 0 || j >= next.length) return f;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...f, slides: next.map((s, idx) => ({ ...s, sortOrder: idx })) };
    });
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Name is required");
    if (form.slides.length === 0) return toast.error("Add at least one slide");
    setSaving(true);
    try {
      const payload: PromotionInput = {
        name: form.name.trim(),
        isActive: form.isActive,
        daysOfWeek: form.daysOfWeek,
        dateStart: form.dateStart || null,
        dateEnd: form.dateEnd || null,
        timeStart: form.timeStart || null,
        timeEnd: form.timeEnd || null,
        slideDurationMs: Number(form.slideDurationMs) || 5000,
        slides: form.slides.map((s, i) => ({ imageUrl: s.imageUrl, sortOrder: i })),
      };
      if (editing) await promotionsApi.update(editing.id, payload);
      else await promotionsApi.create(payload);
      toast.success(editing ? "Promotion updated" : "Promotion created");
      setCreating(false); setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function doDelete() {
    if (!deleting) return;
    try {
      await promotionsApi.remove(deleting.id);
      toast.success("Promotion deleted");
      setDeleting(null);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }

  async function toggleActive(p: Promotion) {
    setTogglingId(p.id);
    try {
      await promotionsApi.update(p.id, { isActive: !p.isActive });
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: !p.isActive } : x)));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setTogglingId(null); }
  }

  function scheduleSummary(p: Promotion) {
    const parts: string[] = [];
    if (p.daysOfWeek?.length) parts.push(p.daysOfWeek.map((d) => DAYS[d]).join(","));
    if (p.dateStart || p.dateEnd) {
      parts.push(`${p.dateStart ? String(p.dateStart).slice(0, 10) : "…"} → ${p.dateEnd ? String(p.dateEnd).slice(0, 10) : "…"}`);
    }
    if (p.timeStart || p.timeEnd) {
      parts.push(`${(p.timeStart || "").slice(0, 5) || "00:00"}–${(p.timeEnd || "").slice(0, 5) || "23:59"}`);
    }
    return parts.length ? parts.join(" · ") : "Always";
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full-screen promotional slideshows shown on <code className="text-xs">/promotions</code>. Multiple active promotions cycle one after the other.
          </p>
        </div>
        <button onClick={openCreate} className="btn-flame inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add new promotion
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Slides</th>
              <th className="px-3 py-3">Schedule</th>
              <th className="px-3 py-3">Duration</th>
              <th className="px-3 py-3">Active</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (<tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>)}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No promotions yet.</td></tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3 font-medium text-white">{p.name}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {p.slides.slice(0, 4).map((s, i) => (
                      isVideoUrl(s.imageUrl) ? (
                        <div key={i} className="h-9 w-9 rounded border border-white/10 bg-black/60 grid place-items-center text-white/80">
                          <VideoIcon className="h-4 w-4" />
                        </div>
                      ) : (
                        <img key={i} src={resolveAssetUrl(s.imageUrl)} alt="" className="h-9 w-9 rounded object-cover border border-white/10" />
                      )
                    ))}
                    {p.slides.length > 4 && <span className="text-xs text-muted-foreground ml-1">+{p.slides.length - 4}</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-muted-foreground text-xs">{scheduleSummary(p)}</td>
                <td className="px-3 py-3 text-muted-foreground">{(p.slideDurationMs / 1000).toFixed(1)}s</td>
                <td className="px-3 py-3">
                  <button onClick={() => toggleActive(p)}
                    disabled={togglingId === p.id}
                    className={`inline-flex items-center justify-center min-w-[64px] px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider disabled:opacity-70 ${p.isActive ? "bg-green-500/15 text-green-400" : "bg-white/5 text-muted-foreground"}`}>
                    {togglingId === p.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : (p.isActive ? "Active" : "Inactive")}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button title="Edit" onClick={() => openEdit(p)} className="h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 text-muted-foreground hover:text-white"><Pencil className="h-4 w-4" /></button>
                    <button title="Delete" onClick={() => setDeleting(p)} className="h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={creating} onOpenChange={(v) => !v && setCreating(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[color:var(--card)] border-white/10">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit promotion" : "New promotion"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field label="Name *">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="Happy Hour" />
            </Field>
            <Field label="Slide duration (ms)">
              <input type="number" min="500" step="500" value={form.slideDurationMs} onChange={(e) => setForm({ ...form, slideDurationMs: Number(e.target.value) })} className={inp} />
            </Field>
            <Field label="Date start">
              <input type="date" value={form.dateStart} onChange={(e) => setForm({ ...form, dateStart: e.target.value })} className={inp} />
            </Field>
            <Field label="Date end">
              <input type="date" value={form.dateEnd} onChange={(e) => setForm({ ...form, dateEnd: e.target.value })} className={inp} />
            </Field>
            <Field label="Time start (happy hour)">
              <input type="time" value={form.timeStart} onChange={(e) => setForm({ ...form, timeStart: e.target.value })} className={inp} />
            </Field>
            <Field label="Time end">
              <input type="time" value={form.timeEnd} onChange={(e) => setForm({ ...form, timeEnd: e.target.value })} className={inp} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Days of week (none = every day)">
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      className={`px-3 py-1.5 rounded-md border text-xs ${form.daysOfWeek.includes(i) ? "border-[color:var(--flame)] bg-[color:var(--flame)]/10 text-white" : "border-white/10 text-muted-foreground hover:border-white/30"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Active">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-[color:var(--flame)]" />
                  <span className="text-sm">Enabled</span>
                </label>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Slides ({form.slides.length})</span>
                <div className="flex items-center gap-2">
                  <MediaPickerButton addLabel="Add image" onPick={(u) => addSlide(u)} />
                  <VideoPickerButton addLabel="Add video" onPick={(u) => addSlide(u)} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {form.slides.map((s, i) => {
                  const isVid = isVideoUrl(s.imageUrl);
                  return (
                    <div key={i} className="relative group rounded-md overflow-hidden border border-white/10 bg-black/40">
                      {isVid ? (
                        <video src={resolveAssetUrl(s.imageUrl)} className="w-full h-28 object-cover" muted preload="metadata" />
                      ) : (
                        <img src={resolveAssetUrl(s.imageUrl)} alt="" className="w-full h-28 object-cover" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 flex items-center justify-between px-2 py-1">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => moveSlide(i, -1)} className="text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20" disabled={i === 0}>↑</button>
                          <button type="button" onClick={() => moveSlide(i, 1)} className="text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20" disabled={i === form.slides.length - 1}>↓</button>
                        </div>
                        <button type="button" onClick={() => removeSlide(i)} className="text-xs text-red-400 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="absolute top-1 left-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                        {isVid ? <VideoIcon className="h-3 w-3" /> : <GripVertical className="h-3 w-3" />}
                        {i + 1}
                      </span>
                    </div>
                  );
                })}
                {form.slides.length === 0 && (
                  <div className="col-span-full text-xs text-muted-foreground border border-dashed border-white/10 rounded-md p-6 text-center">
                    No slides yet. Click "Add image" or "Upload video" to add one.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-md border border-white/10 text-sm hover:bg-white/5"><X className="h-4 w-4 inline mr-1" />Cancel</button>
            <button onClick={save} disabled={saving} className="btn-flame disabled:opacity-60">{saving ? "Saving…" : "Save promotion"}</button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-[color:var(--card)] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete promotion {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This will remove all slides associated with it. Cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const inp = "w-full bg-[color:var(--background)] border border-white/10 rounded-md px-2 py-1.5 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
