import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminApi, menuApi, type Offer, type OfferType,
  type AdminCategory, type AdminProduct, type AdminSubcategory,
} from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TYPE_LABEL: Record<OfferType, string> = {
  cart_percent: "% off cart",
  cart_amount: "$ off cart",
  bogo: "Buy 1 Get 1",
  buy_x_get_y: "Buy X get Y",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type FormState = {
  slug: string;
  type: OfferType;
  name: string;
  description: string;
  is_active: boolean;
  priority: string;
  stackable: boolean;
  starts_at: string;
  expires_at: string;
  days_of_week: number;
  time_from: string;
  time_to: string;
  dining_option: "any" | "dine_in" | "takeout" | "delivery";
  // Per-type config (string-friendly)
  percent: string;
  amount: string;
  minSubtotal: string;
  maxDiscount: string;
  // bogo / buy_x_get_y
  triggerType: "products" | "categories";
  triggerIds: string[]; // slugs (categories and/or subcategories, or product slugs)
  discountPercent: string;
  rewardType: "product" | "category";
  rewardSlugs: string[]; // product slugs (simple) or `slug::v{id}` (variant) when rewardType === "product"
  rewardIds: string[]; // category/subcategory slugs when rewardType === "category"
  rewardPrice: string;
  minTriggerQty: string;

};

const EMPTY: FormState = {
  slug: "", type: "cart_percent", name: "", description: "",
  is_active: true, priority: "0", stackable: false,
  starts_at: "", expires_at: "",
  days_of_week: 127, time_from: "", time_to: "",
  dining_option: "any",
  percent: "10", amount: "5", minSubtotal: "0", maxDiscount: "",
  triggerType: "categories", triggerIds: [],
  discountPercent: "100",
  rewardType: "product",
  rewardSlugs: [], rewardIds: [],
  rewardPrice: "3.99", minTriggerQty: "1",
};


function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
function toLocalInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function offerToForm(o: Offer): FormState {
  const c = (o.config || {}) as Record<string, unknown>;
  return {
    ...EMPTY,
    slug: o.slug,
    type: o.type,
    name: o.name,
    description: o.description || "",
    is_active: !!o.is_active,
    priority: String(o.priority ?? 0),
    stackable: !!o.stackable,
    starts_at: toLocalInput(o.starts_at || ""),
    expires_at: toLocalInput(o.expires_at || ""),
    days_of_week: typeof o.days_of_week === "number" ? o.days_of_week : 127,
    time_from: o.time_from || "",
    time_to: o.time_to || "",
    dining_option: (o.dining_option as FormState["dining_option"]) || "any",
    percent: String(c.percent ?? "10"),
    amount: String(c.amount ?? "5"),
    minSubtotal: String(c.minSubtotal ?? "0"),
    maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
    triggerType: (c.triggerType as FormState["triggerType"]) || "categories",
    triggerIds: Array.isArray(c.triggerIds) ? (c.triggerIds as string[]).map(String) : [],
    discountPercent: String(c.discountPercent ?? "100"),
    rewardType: (c.rewardType as FormState["rewardType"]) || (c.rewardProductSlug || (c.rewardSlugs as string[])?.length ? "product" : "product"),
    rewardSlugs: Array.isArray(c.rewardSlugs)
      ? (c.rewardSlugs as string[]).map(String)
      : (c.rewardProductSlug ? [String(c.rewardProductSlug)] : []),
    rewardIds: Array.isArray(c.rewardIds) ? (c.rewardIds as string[]).map(String) : [],
    rewardPrice: String(c.rewardPrice ?? "3.99"),
    minTriggerQty: String(c.minTriggerQty ?? "1"),

  };
}

function formToPayload(f: FormState): Partial<Offer> & { slug: string; type: OfferType; name: string; config: Record<string, unknown> } {
  let config: Record<string, unknown> = {};
  switch (f.type) {
    case "cart_percent":
      config = {
        percent: Number(f.percent || 0),
        minSubtotal: Number(f.minSubtotal || 0),
        ...(f.maxDiscount ? { maxDiscount: Number(f.maxDiscount) } : {}),
      };
      break;
    case "cart_amount":
      config = { amount: Number(f.amount || 0), minSubtotal: Number(f.minSubtotal || 0) };
      break;
    case "bogo":
      config = {
        triggerType: f.triggerType,
        triggerIds: f.triggerIds,
        discountPercent: Number(f.discountPercent || 100),
      };
      break;
    case "buy_x_get_y":
      config = {
        triggerType: f.triggerType,
        triggerIds: f.triggerIds,
        minTriggerQty: Math.max(1, Number(f.minTriggerQty || 1)),
        rewardType: f.rewardType,
        rewardSlugs: f.rewardType === "product" ? f.rewardSlugs : [],
        rewardIds: f.rewardType === "category" ? f.rewardIds : [],

        rewardPrice: Number(f.rewardPrice || 0),
      };
      break;
  }
  return {
    slug: f.slug || slugify(f.name),
    type: f.type,
    name: f.name,
    description: f.description,
    is_active: f.is_active,
    priority: Number(f.priority || 0),
    stackable: f.stackable,
    starts_at: f.starts_at ? f.starts_at.replace("T", " ") + ":00" : null,
    expires_at: f.expires_at ? f.expires_at.replace("T", " ") + ":00" : null,
    days_of_week: f.days_of_week,
    time_from: f.time_from || null,
    time_to: f.time_to || null,
    dining_option: f.dining_option,
    config,
  };
}

export default function AdminOffers() {
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [subs, setSubs] = useState<AdminSubcategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);

  useEffect(() => {
    refresh();
    menuApi.listCategories().then(setCats).catch(() => {});
    menuApi.listSubcategories().then(setSubs).catch(() => {});
    menuApi.listProducts().then(setProducts).catch(() => {});
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const r = await adminApi.listOffers();
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load offers");
    } finally { setLoading(false); }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  }
  function openEdit(o: Offer) {
    setEditing(o);
    setForm(offerToForm(o));
    setCreating(true);
  }
  function close() { setCreating(false); setEditing(null); }

  async function save() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = formToPayload({ ...form, slug: form.slug || slugify(form.name) });
    if (!payload.slug) { toast.error("Slug required"); return; }
    setSaving(true);
    try {
      if (editing) await adminApi.updateOffer(editing.id, payload);
      else await adminApi.createOffer(payload);
      toast.success(editing ? "Offer updated" : "Offer created");
      close();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function toggleActive(o: Offer) {
    try {
      await adminApi.updateOffer(o.id, { is_active: !o.is_active });
      setItems((p) => p.map((x) => x.id === o.id ? { ...x, is_active: !x.is_active } : x));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function doDelete() {
    if (!deleting) return;
    try {
      await adminApi.deleteOffer(deleting.id);
      setItems((p) => p.filter((x) => x.id !== deleting.id));
      toast.success("Deleted");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setDeleting(null); }
  }

  const categoryChoices = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (const c of cats) {
      out.push({ value: c.slug, label: c.name });
      for (const s of subs.filter((s) => s.category_id === c.id)) {
        out.push({ value: s.slug, label: `${c.name} / ${s.name}` });
      }
    }
    return out;
  }, [cats, subs]);
  const productWithVariantChoices = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (const p of products) {
      const isVariable = p.product_type === "variable" && (p.variants?.length ?? 0) > 0;
      if (!isVariable) {
        out.push({ value: p.slug, label: p.name });
        continue;
      }
      out.push({ value: p.slug, label: `${p.name} (all varieties)` });
      for (const v of p.variants || []) {
        if (v.id == null) continue;
        out.push({ value: `${p.slug}::v${v.id}`, label: `${p.name} — ${v.name}` });
      }
    }
    return out;
  }, [products]);
  const triggerChoices = useMemo(() => {
    if (form.triggerType === "categories") return categoryChoices;
    return productWithVariantChoices;
  }, [form.triggerType, categoryChoices, productWithVariantChoices]);
  const rewardProductChoices = productWithVariantChoices;


  return (
    <section>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Offers</h1>
          <p className="text-sm text-muted-foreground">Configure promotional deals applied automatically at checkout.</p>
        </div>
        <button onClick={openCreate} className="btn-flame inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New offer
        </button>
      </header>

      <div className="bg-[color:var(--card)] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No offers yet. Click <strong>New offer</strong> to create one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-white/5">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Schedule</th>
                <th className="text-left px-4 py-3">Active</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{o.name}</div>
                    <div className="text-xs text-muted-foreground">{o.description}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{TYPE_LABEL[o.type]}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {o.starts_at || o.expires_at
                      ? `${o.starts_at ? new Date(o.starts_at).toLocaleDateString() : "—"} → ${o.expires_at ? new Date(o.expires_at).toLocaleDateString() : "—"}`
                      : "Always"}
                    {o.time_from && o.time_to && <div>{o.time_from}–{o.time_to}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(o)}
                      className={`text-xs px-2 py-1 rounded-full ${o.is_active ? "bg-green-500/15 text-green-400" : "bg-white/5 text-muted-foreground"}`}
                    >{o.is_active ? "Active" : "Paused"}</button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(o)} className="h-8 w-8 inline-grid place-items-center text-muted-foreground hover:text-white"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeleting(o)} className="h-8 w-8 inline-grid place-items-center text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Editor */}
      <Dialog open={creating} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-2xl bg-[color:var(--card)] border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit offer" : "New offer"}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="e.g. Lunch Combo + Smoothie $3.99" />
              </Field>
              <Field label="Slug (optional)">
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} onBlur={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className={inp} placeholder={form.name ? slugify(form.name) : "auto-generated from name on save"} />
              </Field>
            </div>
            <Field label="Short description (shown on offer cards)">
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as OfferType })} className={inp}>
                <option value="cart_percent">% off the cart</option>
                <option value="cart_amount">$ off the cart</option>
                <option value="bogo">Buy 1 Get 1 (same category/product)</option>
                <option value="buy_x_get_y">Buy X — Get Y at a special price</option>
              </select>
            </Field>

            {form.type === "cart_percent" && (
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="% off"><input type="number" min={0} max={100} value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} className={inp} /></Field>
                <Field label="Min subtotal $"><input type="number" min={0} step="0.01" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} className={inp} /></Field>
                <Field label="Max discount $ (optional)"><input type="number" min={0} step="0.01" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} className={inp} /></Field>
              </div>
            )}
            {form.type === "cart_amount" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="$ off"><input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inp} /></Field>
                <Field label="Min subtotal $"><input type="number" min={0} step="0.01" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} className={inp} /></Field>
              </div>
            )}
            {(form.type === "bogo" || form.type === "buy_x_get_y") && (
              <>
                <Field label="Trigger by">
                  <select value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value as FormState["triggerType"], triggerIds: [] })} className={inp}>
                    <option value="categories">Categories (any item in)</option>
                    <option value="products">Specific products</option>
                  </select>
                </Field>
                <Field label={`Qualifying ${form.triggerType}`}>
                  <SearchableMultiPick
                    options={triggerChoices}
                    value={form.triggerIds}
                    onChange={(v) => setForm({ ...form, triggerIds: v })}
                    placeholder={form.triggerType === "products" ? "Search products…" : "Search categories…"}
                  />
                </Field>
                {form.type === "bogo" ? (
                  <Field label="Discount on cheaper item (%)">
                    <input type="number" min={0} max={100} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className={inp} placeholder="100 = free" />
                  </Field>
                ) : (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Buy at least (qty)"><input type="number" min={1} step={1} value={form.minTriggerQty} onChange={(e) => setForm({ ...form, minTriggerQty: e.target.value })} className={inp} /></Field>
                      <Field label="Reward special price $"><input type="number" min={0} step="0.01" value={form.rewardPrice} onChange={(e) => setForm({ ...form, rewardPrice: e.target.value })} className={inp} /></Field>
                    </div>
                    <Field label="Reward type">
                      <select
                        value={form.rewardType}
                        onChange={(e) => setForm({ ...form, rewardType: e.target.value as FormState["rewardType"], rewardSlugs: [], rewardIds: [] })}
                        className={inp}
                      >
                        <option value="product">Specific product(s) / variant(s)</option>
                        <option value="category">Any item in category / subcategory</option>
                      </select>
                    </Field>
                    {form.rewardType === "product" ? (
                      <Field label="Reward products (pick one or more — variants listed separately)">
                        <SearchableMultiPick
                          options={rewardProductChoices}
                          value={form.rewardSlugs}
                          onChange={(v) => setForm({ ...form, rewardSlugs: v })}
                          placeholder="Search products or variants…"
                        />
                      </Field>
                    ) : (
                      <Field label="Qualifying reward categories / subcategories">
                        <MultiPick options={categoryChoices} value={form.rewardIds} onChange={(v) => setForm({ ...form, rewardIds: v })} />
                      </Field>
                    )}

                  </div>
                )}
              </>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Starts at"><input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inp} /></Field>
              <Field label="Ends at"><input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className={inp} /></Field>
              <Field label="Time from (HH:MM)"><input value={form.time_from} onChange={(e) => setForm({ ...form, time_from: e.target.value })} className={inp} placeholder="11:00" /></Field>
              <Field label="Time to (HH:MM)"><input value={form.time_to} onChange={(e) => setForm({ ...form, time_to: e.target.value })} className={inp} placeholder="15:00" /></Field>
            </div>
            <Field label="Days of week">
              <div className="flex flex-wrap gap-2">
                {DOW.map((d, i) => {
                  const on = !!((form.days_of_week >> i) & 1);
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setForm({ ...form, days_of_week: form.days_of_week ^ (1 << i) })}
                      className={`px-3 py-1.5 rounded-full text-xs border ${on ? "bg-[color:var(--flame)]/20 border-[color:var(--flame)] text-white" : "border-white/10 text-muted-foreground"}`}
                    >{d}</button>
                  );
                })}
              </div>
            </Field>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Priority"><input type="number" step={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inp} /></Field>
              <Field label="Dining option">
                <select value={form.dining_option} onChange={(e) => setForm({ ...form, dining_option: e.target.value as FormState["dining_option"] })} className={inp}>
                  <option value="any">Any</option>
                  <option value="dine_in">Dine-in</option>
                  <option value="takeout">Takeout</option>
                  <option value="delivery">Delivery</option>
                </select>
              </Field>
              <Field label="Stack with other offers?">
                <label className="flex items-center gap-2 h-9"><input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} /> Allow stacking</label>
              </Field>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={close} className="px-4 py-2 text-sm rounded-lg border border-white/10">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-flame">{saving ? "Saving…" : "Save"}</button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete offer?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.name}" will be removed permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

const inp = "w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function MultiPick({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="max-h-44 overflow-auto rounded-lg border border-white/10 p-2 space-y-1">
      {options.length === 0 && <div className="text-xs text-muted-foreground p-2">No options</div>}
      {options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <label key={o.value} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-white/5">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

function SearchableMultiPick({ options, value, onChange, placeholder }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t) || o.value.toLowerCase().includes(t));
  }, [q, options]);
  return (
    <div className="rounded-lg border border-white/10">
      <div className="p-2 border-b border-white/10">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder || "Search…"}
          className="w-full bg-[color:var(--background)] border border-white/10 rounded px-2 py-1.5 text-xs"
        />
        {value.length > 0 && (
          <div className="mt-1 text-[10px] text-muted-foreground">{value.length} selected · <button type="button" className="underline" onClick={() => onChange([])}>Clear</button></div>
        )}
      </div>
      <div className="max-h-56 overflow-auto p-2 space-y-1">
        {filtered.length === 0 && <div className="text-xs text-muted-foreground p-2">No matches</div>}
        {filtered.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label key={o.value} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-white/5">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

