import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { couponsApi, menuApi, type AdminCoupon, type AdminProduct, type CouponInput } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FormState = {
  code: string;
  description: string;
  type: "percent" | "fixed" | "free_item";
  value: string;
  max_discount: string;
  min_subtotal: string;
  free_product_id: string;
  starts_at: string;
  expires_at: string;
  usage_limit: string;
  per_customer_limit: string;
  is_active: boolean;
};

const EMPTY: FormState = {
  code: "", description: "", type: "percent", value: "10",
  max_discount: "", min_subtotal: "0", free_product_id: "",
  starts_at: "", expires_at: "", usage_limit: "", per_customer_limit: "",
  is_active: true,
};

const TYPE_LABEL: Record<AdminCoupon["type"], string> = {
  percent: "% off", fixed: "$ off", free_item: "Free item",
};

function toLocalInput(v: string | null): string {
  if (!v) return "";
  // Convert ISO/datetime to value="YYYY-MM-DDTHH:mm"
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminCoupons() {
  const [items, setItems] = useState<AdminCoupon[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminCoupon | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    refresh();
    menuApi.listProducts().then(setProducts).catch(() => {});
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const r = await couponsApi.list();
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load coupons");
    } finally { setLoading(false); }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  }
  function openEdit(c: AdminCoupon) {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description || "",
      type: c.type,
      value: String(c.value ?? ""),
      max_discount: c.max_discount != null ? String(c.max_discount) : "",
      min_subtotal: String(c.min_subtotal ?? 0),
      free_product_id: c.free_product_id != null ? String(c.free_product_id) : "",
      starts_at: toLocalInput(c.starts_at),
      expires_at: toLocalInput(c.expires_at),
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
      per_customer_limit: c.per_customer_limit != null ? String(c.per_customer_limit) : "",
      is_active: c.is_active,
    });
    setCreating(true);
  }

  function buildPayload(): CouponInput {
    const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
    const p: CouponInput = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: form.type,
      value: form.type === "free_item" ? 0 : Number(form.value || 0),
      max_discount: form.type === "percent" ? numOrNull(form.max_discount) : null,
      min_subtotal: Number(form.min_subtotal || 0),
      free_product_id: form.type === "free_item" ? (numOrNull(form.free_product_id) as number | null) : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      usage_limit: numOrNull(form.usage_limit) as number | null,
      per_customer_limit: numOrNull(form.per_customer_limit) as number | null,
      is_active: form.is_active,
    };
    return p;
  }

  async function save() {
    if (!form.code.trim()) return toast.error("Code is required");
    if (form.type === "free_item" && !form.free_product_id) return toast.error("Pick a free product");
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) await couponsApi.update(editing.id, payload);
      else await couponsApi.create(payload);
      toast.success(editing ? "Coupon updated" : "Coupon created");
      setCreating(false); setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function doDelete() {
    if (!deleting) return;
    try {
      await couponsApi.remove(deleting.id);
      toast.success("Coupon deleted");
      setDeleting(null);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }

  async function toggleActive(c: AdminCoupon) {
    setTogglingId(c.id);
    setItems((arr) => arr.map((x) => x.id === c.id ? { ...x, is_active: !c.is_active } : x));
    try {
      await couponsApi.update(c.id, { is_active: !c.is_active });
    } catch (e) {
      setItems((arr) => arr.map((x) => x.id === c.id ? { ...x, is_active: c.is_active } : x));
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  }

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.is_active === b.is_active ? a.code.localeCompare(b.code) : a.is_active ? -1 : 1)),
    [items],
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-muted-foreground mt-1">Create discount codes. Discount applies to the subtotal — tax is then calculated on the discounted amount.</p>
        </div>
        <button onClick={openCreate} className="btn-flame inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New coupon
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
            <tr>
              <th className="px-3 py-3">Code</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Value</th>
              <th className="px-3 py-3">Min order</th>
              <th className="px-3 py-3">Used / Limit</th>
              <th className="px-3 py-3">Expires</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (<tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>)}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No coupons yet.</td></tr>
            )}
            {sorted.map((c) => (
              <tr key={c.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <div className="font-mono font-semibold text-white">{c.code}</div>
                  {c.description && <div className="text-[11px] text-muted-foreground">{c.description}</div>}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{TYPE_LABEL[c.type]}</td>
                <td className="px-3 py-3">
                  {c.type === "percent" && <>{Number(c.value)}%{c.max_discount ? ` (max $${Number(c.max_discount).toFixed(2)})` : ""}</>}
                  {c.type === "fixed" && <>${Number(c.value).toFixed(2)}</>}
                  {c.type === "free_item" && <span className="text-muted-foreground">{c.free_product_name || `Product #${c.free_product_id}`}</span>}
                </td>
                <td className="px-3 py-3 text-muted-foreground">${Number(c.min_subtotal).toFixed(2)}</td>
                <td className="px-3 py-3 text-muted-foreground">{c.used_count} / {c.usage_limit ?? "∞"}</td>
                <td className="px-3 py-3 text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => toggleActive(c)}
                    disabled={togglingId === c.id}
                    title={c.is_active ? "Click to deactivate" : "Click to activate"}
                    className={`inline-flex items-center justify-center min-w-[70px] px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider disabled:opacity-70 ${c.is_active ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
                  >
                    {togglingId === c.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : (c.is_active ? "Active" : "Inactive")}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button title="Edit" onClick={() => openEdit(c)} className="h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 text-muted-foreground hover:text-white"><Pencil className="h-4 w-4" /></button>
                    <button title="Delete" onClick={() => setDeleting(c)} className="h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={creating} onOpenChange={(v) => !v && setCreating(false)}>
        <DialogContent className="max-w-2xl bg-[color:var(--card)] border-white/10">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field label="Code *">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inp} placeholder="WELCOME10" />
            </Field>
            <Field label="Type *">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormState["type"] })} className={inp}>
                <option value="percent">% off</option>
                <option value="fixed">$ off</option>
                <option value="free_item">Free item</option>
              </select>
            </Field>
            <Field label="Description">
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} placeholder="10% off your first order" />
            </Field>
            {form.type !== "free_item" && (
              <Field label={form.type === "percent" ? "Percent off *" : "Amount off *"}>
                <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inp} />
              </Field>
            )}
            {form.type === "percent" && (
              <Field label="Max discount ($, optional)">
                <input type="number" min="0" step="0.01" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} className={inp} />
              </Field>
            )}
            {form.type === "free_item" && (
              <Field label="Free product *">
                <select value={form.free_product_id} onChange={(e) => setForm({ ...form, free_product_id: e.target.value })} className={inp}>
                  <option value="">— pick a product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (${Number(p.price).toFixed(2)})</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Min order subtotal ($)">
              <input type="number" min="0" step="0.01" value={form.min_subtotal} onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })} className={inp} />
            </Field>
            <Field label="Total usage limit">
              <input type="number" min="0" step="1" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className={inp} placeholder="Unlimited" />
            </Field>
            <Field label="Per-customer limit">
              <input type="number" min="0" step="1" value={form.per_customer_limit} onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })} className={inp} placeholder="Unlimited" />
            </Field>
            <Field label="Starts at">
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inp} />
            </Field>
            <Field label="Expires at">
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className={inp} />
            </Field>
            <Field label="Active">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[color:var(--flame)]" />
                <span className="text-sm">Enabled</span>
              </label>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-md border border-white/10 text-sm hover:bg-white/5"><X className="h-4 w-4 inline mr-1" />Cancel</button>
            <button onClick={save} disabled={saving} className="btn-flame disabled:opacity-60">{saving ? "Saving…" : "Save coupon"}</button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-[color:var(--card)] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Past orders that used this coupon will keep their record.</AlertDialogDescription>
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
