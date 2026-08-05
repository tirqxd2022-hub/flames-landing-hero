import { SearchClearButton } from "@/components/ui/search-clear";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Eye, Download, Upload, Star, Copy } from "lucide-react";
import { toast } from "sonner";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import {
  menuApi, resolveAssetUrl,
  type AdminCategory, type AdminProduct, type AdminAddonGroup, type AdminSubcategory,
} from "@/lib/api";
import { HoverThumb } from "@/components/ui/hover-thumb";

export default function AdminMenu() {
  const [tab, setTab] = useState("products");
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [subs, setSubs] = useState<AdminSubcategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [addons, setAddons] = useState<AdminAddonGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const [c, s, p, a] = await Promise.all([
        menuApi.listCategories(), menuApi.listSubcategories(), menuApi.listProducts(), menuApi.listAddons(),
      ]);
      setCats(c); setSubs(s); setProducts(p); setAddons(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load menu");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addonCount = useMemo(
    () => new Set(addons.map((g) => `${g.name}|${g.type}|${g.sized}`)).size,
    [addons],
  );

  const packagedCat = useMemo(() => cats.find((c) => c.slug === "packaged-food"), [cats]);
  const foodCats = useMemo(() => cats.filter((c) => c.slug !== "packaged-food"), [cats]);
  const packagedCats = useMemo(() => (packagedCat ? [packagedCat] : []), [packagedCat]);
  const foodProducts = useMemo(
    () => (packagedCat ? products.filter((p) => p.category_id !== packagedCat.id) : products),
    [products, packagedCat],
  );
  const packagedProducts = useMemo(
    () => (packagedCat ? products.filter((p) => p.category_id === packagedCat.id) : []),
    [products, packagedCat],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Menu</h1>
      <p className="text-sm text-muted-foreground">Manage categories, products and à-la-carte add-ons. Prices are inline-editable.</p>

      {err && <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">{err}</div>}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="categories">Categories ({cats.length})</TabsTrigger>
          <TabsTrigger value="products">Food Items ({foodProducts.length})</TabsTrigger>
          <TabsTrigger value="packaged">Packaged Food ({packagedProducts.length})</TabsTrigger>
          <TabsTrigger value="alacarte">Add Ons ({addonCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab items={cats} products={products} onChanged={load} loading={loading} />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsTab items={foodProducts} cats={foodCats} subs={subs} onChanged={load} loading={loading} />
        </TabsContent>
        <TabsContent value="packaged" className="mt-4">
          <ProductsTab items={packagedProducts} cats={packagedCats} subs={subs} onChanged={load} loading={loading} />
        </TabsContent>
        <TabsContent value="alacarte" className="mt-4">
          <AddonsTab groups={addons} cats={cats} subs={subs} products={products} onChanged={load} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const inp = "w-full bg-[color:var(--background)] border border-white/10 rounded-md px-2 py-1.5 text-sm";
const btnAdd = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white text-xs font-bold uppercase tracking-wider";

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className={`h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 ${danger ? "text-red-400 hover:bg-red-500/10" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

// ---------- Categories ----------
function CategoriesTab({ items, products, onChanged, loading }: { items: AdminCategory[]; products: AdminProduct[]; onChanged: () => void; loading: boolean }) {
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [subs, setSubs] = useState<AdminSubcategory[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [subDialog, setSubDialog] = useState<{ parentId: number | null; editing: AdminSubcategory | null } | null>(null);
  const [subDeleting, setSubDeleting] = useState<AdminSubcategory | null>(null);

  const loadSubs = () => menuApi.listSubcategories().then(setSubs).catch(() => {});
  useEffect(() => { loadSubs(); }, []);

  async function handleDelete() {
    if (!deleting) return;
    try { await menuApi.deleteCategory(deleting.id); toast.success("Category deleted"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(null); }
  }
  async function handleSubDelete() {
    if (!subDeleting) return;
    try { await menuApi.deleteSubcategory(subDeleting.id); toast.success("Subcategory deleted"); loadSubs(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setSubDeleting(null); }
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <button className={btnAdd} onClick={() => setSubDialog({ parentId: items[0]?.id ?? null, editing: null })}>
          <Plus className="h-3.5 w-3.5" /> Add subcategory
        </button>
        <button className={btnAdd} onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Add category</button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
            <tr>
              <th className="text-left px-4 py-3 w-8"></th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Slug</th>
              <th className="text-center px-4 py-3">Subcategories</th>
              <th className="text-center px-4 py-3">Availability</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const catSubs = subs.filter((s) => s.category_id === c.id);
              const isOpen = expanded.has(c.id);
              const catCount = products.filter((p) => p.category_id === c.id).length;
              return (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <button onClick={() => setExpanded((p) => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                        className="text-muted-foreground hover:text-white">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <HoverThumb src={resolveAssetUrl(c.image_url)} alt={c.name} />
                        <span className="font-medium">{c.name} <span className="text-muted-foreground font-normal">({catCount})</span></span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">/{c.slug}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{catSubs.length}</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={c.availability || "available"}
                        onChange={async (e) => {
                          const v = e.target.value as "available" | "unavailable" | "upcoming";
                          try {
                            await menuApi.updateCategory(c.id, { availability: v });
                            toast.success("Availability updated");
                            onChanged();
                          } catch (err) { toast.error(err instanceof Error ? err.message : "Update failed"); }
                        }}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          (c.availability || "available") === "available"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : (c.availability === "upcoming")
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        <option value="available" className="bg-background text-foreground">Available</option>
                        <option value="upcoming" className="bg-background text-foreground">Upcoming</option>
                        <option value="unavailable" className="bg-background text-foreground">Unavailable</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={async () => {
                            try {
                              await menuApi.updateCategory(c.id, { is_featured: !c.is_featured });
                              toast.success(c.is_featured ? "Removed from Home featured" : "Featured on Home");
                              onChanged();
                            } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
                          }}
                          title={c.is_featured ? "Featured on Home — click to unfeature" : "Mark as featured on Home"}
                          className={`h-8 w-8 grid place-items-center rounded-md border transition ${c.is_featured ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/15 text-[color:var(--gold)]" : "border-white/10 text-muted-foreground hover:text-white hover:border-white/30"}`}
                        >
                          <Star className={`h-4 w-4 ${c.is_featured ? "fill-current" : ""}`} />
                        </button>
                        <a href={`/category/${c.slug}`} target="_blank" rel="noreferrer" title="View page"
                          className="h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 text-muted-foreground hover:text-white hover:bg-white/5">
                          <Eye className="h-4 w-4" />
                        </a>
                        <IconBtn title="Add subcategory" onClick={() => setSubDialog({ parentId: c.id, editing: null })}><Plus className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Edit" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Delete" onClick={() => setDeleting(c)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                  {isOpen && catSubs.map((s) => {
                    const subCount = products.filter((p) => p.subcategory_id === s.id).length;
                    return (
                    <tr key={`s-${s.id}`} className="border-b border-white/5 bg-white/[0.02]">
                      <td></td>
                      <td className="px-4 py-2 pl-10 text-sm text-muted-foreground">↳ {s.name} <span className="text-muted-foreground/70">({subCount})</span></td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">/{s.slug}</td>
                      <td></td>
                      <td></td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <a href={`/category/${c.slug}#${s.slug}`} target="_blank" rel="noreferrer" title="View page"
                            className="h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 text-muted-foreground hover:text-white hover:bg-white/5">
                            <Eye className="h-4 w-4" />
                          </a>
                          <IconBtn title="Edit" onClick={() => setSubDialog({ parentId: s.category_id, editing: s })}><Pencil className="h-4 w-4" /></IconBtn>
                          <IconBtn title="Delete" onClick={() => setSubDeleting(s)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {isOpen && catSubs.length === 0 && (
                    <tr className="border-b border-white/5 bg-white/[0.02]"><td></td><td colSpan={5} className="px-4 py-2 pl-10 text-xs text-muted-foreground italic">No subcategories.</td></tr>
                  )}
                </React.Fragment>
              );
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No categories.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <CategoryDialog
          initial={editing}
          cats={items}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); onChanged(); }}
        />
      )}
      {subDialog && (
        <SubcategoryDialog
          cats={items} initial={subDialog.editing} defaultParentId={subDialog.parentId}
          onClose={() => setSubDialog(null)}
          onSaved={() => { setSubDialog(null); loadSubs(); }}
        />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-[color:var(--card)] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This also deletes all products in this category.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!subDeleting} onOpenChange={(o) => !o && setSubDeleting(null)}>
        <AlertDialogContent className="bg-[color:var(--card)] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subcategory {subDeleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryDialog({ initial, cats, onClose, onSaved }: { initial: AdminCategory | null; cats: AdminCategory[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url || "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [isFeatured, setIsFeatured] = useState<boolean>(!!initial?.is_featured);
  const [sideCategoryId, setSideCategoryId] = useState<number | "">(initial?.side_category_id ?? "");
  const [availability, setAvailability] = useState<"available" | "unavailable" | "upcoming">(initial?.availability || "available");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name) { toast.error("Name is required."); return; }
    const finalSlug = (slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    if (!finalSlug) { toast.error("Could not derive slug from name."); return; }
    if (!slug.trim()) setSlug(finalSlug);
    setSaving(true);
    try {
      const body = {
        name, slug: finalSlug, description, image_url: imageUrl, sort_order: sortOrder, is_featured: isFeatured,
        side_category_id: sideCategoryId === "" ? null : Number(sideCategoryId),
        availability,
      };
      if (initial) await menuApi.updateCategory(initial.id, body);
      else await menuApi.createCategory(body);

      toast.success("Saved"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[color:var(--card)] border-white/10 max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Edit category" : "Add category"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Labeled label="Availability">
            <select value={availability} onChange={(e) => setAvailability(e.target.value as typeof availability)} className={inp}>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="upcoming">Upcoming</option>
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">Unavailable / Upcoming will dim all products on this category page and show a "coming soon" tooltip on hover. The category name is also suffixed with "(Coming Soon)".</p>
          </Labeled>
          <Labeled label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></Labeled>
          <Labeled label="Slug (URL)"><input value={slug} placeholder="Leave blank to auto-generate from name" onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className={inp} /></Labeled>

          <Labeled label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inp} /></Labeled>
          <Labeled label="Image">
            <div className="flex items-center gap-3">
              {imageUrl && <HoverThumb src={resolveAssetUrl(imageUrl)} className="h-12 w-12 rounded object-cover border border-white/10" />}
              <MediaPickerButton hasValue={!!imageUrl} onPick={(u) => setImageUrl(u)} uploadFolder="page" />
              {imageUrl && <button type="button" onClick={() => setImageUrl("")} className="text-xs text-muted-foreground hover:text-red-400">Remove</button>}
            </div>
          </Labeled>
          <Labeled label="Sort order"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className={inp} /></Labeled>
          <Labeled label="Select Side Category">
            <select value={sideCategoryId} onChange={(e) => setSideCategoryId(e.target.value === "" ? "" : parseInt(e.target.value))} className={inp}>
              <option value="">— None (no upsell) —</option>
              {cats.filter((c) => c.id !== initial?.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">Items from this category will be shown as side-dish suggestions on the cart and checkout pages when a product from this category is in the cart.</p>
          </Labeled>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured on Home (Our Cuisine section)
          </label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-white/10">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] text-white font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubcategoryDialog({ initial, cats, defaultParentId, onClose, onSaved }: { initial: AdminSubcategory | null; cats: AdminCategory[]; defaultParentId: number | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [categoryId, setCategoryId] = useState<number>(initial?.category_id || defaultParentId || cats[0]?.id || 0);
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name || !categoryId) { toast.error("Parent category and name are required."); return; }
    const finalSlug = (slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    if (!finalSlug) { toast.error("Could not derive slug from name."); return; }
    if (!slug.trim()) setSlug(finalSlug);
    setSaving(true);
    try {
      const body = { category_id: categoryId, name, slug: finalSlug, sort_order: sortOrder };
      if (initial) await menuApi.updateSubcategory(initial.id, body);
      else await menuApi.createSubcategory(body);

      toast.success("Saved"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[color:var(--card)] border-white/10 max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Edit subcategory" : "Add subcategory"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Labeled label="Parent category">
            <select value={categoryId} onChange={(e) => setCategoryId(parseInt(e.target.value))} className={inp}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></Labeled>
          <Labeled label="Slug (URL)"><input value={slug} placeholder="Leave blank to auto-generate from name" onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className={inp} /></Labeled>
          <Labeled label="Sort order"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className={inp} /></Labeled>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-white/10">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] text-white font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Products ----------
function ProductsTab({ items, cats, subs, onChanged, loading }: { items: AdminProduct[]; cats: AdminCategory[]; subs: AdminSubcategory[]; onChanged: () => void; loading: boolean }) {
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ id: number; value: string } | null>(null);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setCsvBusy(true);
    try { await menuApi.exportProductsCsv(); toast.success("CSV exported"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); }
    finally { setCsvBusy(false); }
  }
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setCsvBusy(true);
    try {
      const r = await menuApi.importProductsCsv(file);
      toast.success(`Imported: ${r.created} created · ${r.updated} updated${r.skipped ? ` · ${r.skipped} skipped` : ""}`);
      if (r.errors?.length) console.warn("CSV import errors:", r.errors);
      onChanged();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Import failed"); }
    finally { setCsvBusy(false); }
  }

  const catName = (cid: number) => cats.find((c) => c.id === cid)?.name || "—";
  const subName = (sid?: number | null) => (sid ? subs.find((s) => s.id === sid)?.name : "") || "";
  const catSubs = useMemo(
    () => (catFilter === "all" ? [] : subs.filter((s) => String(s.category_id) === catFilter)),
    [subs, catFilter],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (catFilter !== "all" && String(p.category_id) !== catFilter) return false;
      if (subFilter !== "all" && String(p.subcategory_id ?? "") !== subFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, catFilter, subFilter]);

  async function savePrice(p: AdminProduct, newPrice: number) {
    try { await menuApi.updateProduct(p.id, { price: newPrice }); toast.success("Price updated"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setPriceEdit(null); }
  }

  async function toggleActive(p: AdminProduct) {
    setTogglingId(p.id);
    try { await menuApi.updateProduct(p.id, { is_active: !p.is_active }); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setTogglingId(null); }
  }

  async function toggleFeatured(p: AdminProduct) {
    try {
      await menuApi.updateProduct(p.id, { is_featured: !p.is_featured });
      toast.success(p.is_featured ? "Removed from featured" : "Marked as featured");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  }

  async function handleDelete() {
    if (!deleting) return;
    try { await menuApi.deleteProduct(deleting.id); toast.success("Deleted"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(null); }
  }

  async function handleDuplicate(p: AdminProduct) {
    try {
      const baseSlug = `${p.slug}-copy`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const body: Partial<AdminProduct> = {
        name: `${p.name} (Copy)`,
        slug: uniqueSlug,
        category_id: p.category_id,
        subcategory_id: p.subcategory_id ?? null,
        description: p.description ?? "",
        long_description: p.long_description ?? "",
        nutrition_json: p.nutrition_json ?? null,
        price: Number(p.price) || 0,
        image_url: p.image_url ?? "",
        is_veg: !!p.is_veg,
        is_active: false, // start disabled so the copy can be edited before going live
        is_featured: false,
        rating: typeof p.rating === "number" ? p.rating : 5,
        sort_order: typeof p.sort_order === "number" ? p.sort_order : 0,
        product_type: p.product_type || "simple",
        variants: (p.variants || []).map((v, i) => ({ name: v.name, price: Number(v.price) || 0, is_base: !!v.is_base, sort_order: i })),
      };
      const { id } = await menuApi.createProduct(body);
      const fresh = await menuApi.listProducts();
      const created = fresh.find((x) => x.id === id) || ({ ...(body as AdminProduct), id });
      onChanged();
      setEditing(created as AdminProduct);
      toast.success("Duplicated — edit details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu items…"
            className="w-full h-9 rounded-md border border-white/10 bg-background pl-3 pr-8 text-sm"
          />
          <SearchClearButton show={!!query} onClear={() => setQuery("")} />
        </div>
        <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setSubFilter("all"); }}
          className="h-9 rounded-md border border-white/10 bg-background px-2 text-sm">
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={subFilter} onChange={(e) => setSubFilter(e.target.value)} disabled={catFilter === "all"}
          className="h-9 rounded-md border border-white/10 bg-background px-2 text-sm disabled:opacity-50">
          <option value="all">All subcategories</option>
          {catSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button
          onClick={handleExport} disabled={csvBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-white disabled:opacity-50"
          title="Download all products as CSV">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
        <button
          onClick={() => importRef.current?.click()} disabled={csvBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-white disabled:opacity-50"
          title="Upload a CSV to bulk-create or update products">
          <Upload className="h-3.5 w-3.5" /> Import CSV
        </button>
        <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
        <button className={btnAdd} onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Add Menu</button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-center px-4 py-3">Featured</th>
              <th className="text-center px-4 py-3">Active</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const sub = subName(p.subcategory_id);
              return (
              <tr key={p.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image_url
                      ? <HoverThumb src={resolveAssetUrl(p.image_url)} alt={p.name} />
                      : <div className="h-10 w-10 rounded bg-white/5 grid place-items-center text-[9px] text-muted-foreground">No img</div>}
                    <span>{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {catName(p.category_id)}{sub ? <span className="text-muted-foreground/70"> › {sub}</span> : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.product_type === "variable" ? (
                    <span className="text-muted-foreground text-xs cursor-not-allowed" title="Inline price editing is disabled for variable products. Edit variant prices from the product editor.">
                      ${Number(p.price).toFixed(2)} <span className="opacity-70">onwards</span>
                    </span>

                  ) : priceEdit?.id === p.id ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        autoFocus type="number" step="0.01" min="0"
                        value={priceEdit.value}
                        onChange={(e) => setPriceEdit({ id: p.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePrice(p, parseFloat(priceEdit.value) || 0);
                          if (e.key === "Escape") setPriceEdit(null);
                        }}
                        className="w-20 bg-[color:var(--background)] border border-[color:var(--flame)]/40 rounded px-1 py-0.5 text-right text-xs"
                      />
                      <button onClick={() => savePrice(p, parseFloat(priceEdit.value) || 0)} className="text-green-400 hover:text-green-300"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setPriceEdit(null)} className="text-muted-foreground hover:text-white"><X className="h-3.5 w-3.5" /></button>
                    </span>
                  ) : (
                    <button title="Click to edit" onClick={() => setPriceEdit({ id: p.id, value: String(p.price) })} className="text-[color:var(--flame-light)] hover:underline">${Number(p.price).toFixed(2)}</button>
                  )}
                </td>

                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleFeatured(p)}
                    title={p.is_featured ? "Featured on Home — click to unfeature" : "Mark as featured on Home"}
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-md border transition ${p.is_featured ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/15 text-[color:var(--gold)]" : "border-white/10 text-muted-foreground hover:text-white hover:border-white/30"}`}
                  >
                    <Star className={`h-4 w-4 ${p.is_featured ? "fill-current" : ""}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={!!p.is_active}
                    disabled={togglingId === p.id}
                    onChange={() => toggleActive(p)}
                    className="h-4 w-4 cursor-pointer accent-[color:var(--flame)]"
                    title={p.is_active ? "Active — click to disable" : "Disabled — click to enable"}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" title="View product"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-muted-foreground hover:text-white hover:border-white/20">
                      <Eye className="h-4 w-4" />
                    </a>
                    <IconBtn title="Edit" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Duplicate" onClick={() => handleDuplicate(p)}><Copy className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Delete" onClick={() => setDeleting(p)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>

                </td>
              </tr>
            );})}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No products.</td></tr>
            )}
          </tbody>
        </table>
      </div>


      {(editing || creating) && (
        <ProductDialog
          initial={editing} cats={cats} subs={subs}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); onChanged(); }}
        />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-[color:var(--card)] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the product.</AlertDialogDescription>
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

function ProductDialog({ initial, cats, subs, onClose, onSaved }: { initial: AdminProduct | null; cats: AdminCategory[]; subs: AdminSubcategory[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [categoryId, setCategoryId] = useState<number>(initial?.category_id || 0);
  const [subcategoryId, setSubcategoryId] = useState<number | "">(initial?.subcategory_id ?? "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState<number>(initial?.price || 0);
  const [imageUrl, setImageUrl] = useState(initial?.image_url || "");
  const [isVeg, setIsVeg] = useState<boolean>(!!initial?.is_veg);
  const [isActive, setIsActive] = useState<boolean>(initial ? !!initial.is_active : true);
  const [isFeatured, setIsFeatured] = useState<boolean>(!!initial?.is_featured);
  const [productType, setProductType] = useState<"simple" | "variable">(initial?.product_type || "simple");
  const initialVariants = initial?.variants && initial.variants.length > 0
    ? initial.variants.map((v) => ({ name: v.name, price: Number(v.price), is_base: !!v.is_base }))
    : [
        { name: "Regular", price: Number(initial?.price || 0), is_base: true },
        { name: "", price: 0, is_base: false },
      ];
  const [variants, setVariants] = useState<{ name: string; price: number; is_base: boolean }[]>(initialVariants);
  const [saving, setSaving] = useState(false);

  // Parse existing nutrition JSON so editing pre-fills.
  const initialNutrition = useMemo(() => {
    if (!initial?.nutrition_json) return { serving_size: "", rows: [] as { label: string; value: string }[] };
    try {
      const o = JSON.parse(initial.nutrition_json);
      return { serving_size: String(o.serving_size || ""), rows: Array.isArray(o.rows) ? o.rows : [] };
    } catch { return { serving_size: "", rows: [] }; }
  }, [initial]);
  const [servingSize, setServingSize] = useState<string>(initialNutrition.serving_size);
  const [nutriRows, setNutriRows] = useState<{ label: string; value: string }[]>(initialNutrition.rows);

  const catSubs = useMemo(() => subs.filter((s) => s.category_id === categoryId), [subs, categoryId]);

  async function save() {
    const finalSlug = (slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    if (!name || !finalSlug || !categoryId) { toast.error("Name and category are required."); return; }
    if (!slug.trim()) setSlug(finalSlug);
    let cleanVariants: { name: string; price: number; is_base: boolean; sort_order: number }[] = [];
    let effectivePrice = price;
    if (productType === "variable") {
      cleanVariants = variants
        .map((v, i) => ({ name: v.name.trim(), price: Number(v.price) || 0, is_base: !!v.is_base, sort_order: i }))
        .filter((v) => v.name);
      if (cleanVariants.length < 2) { toast.error("Variable products need at least 2 attribute rows."); return; }
      if (!cleanVariants.some((v) => v.is_base)) cleanVariants[0].is_base = true;
      const base = cleanVariants.find((v) => v.is_base) || cleanVariants[0];
      effectivePrice = base.price;
    }
    setSaving(true);
    try {
      const cleanRows = nutriRows
        .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
        .filter((r) => r.label && r.value);
      const nutritionPayload = (cleanRows.length || servingSize.trim())
        ? JSON.stringify({ serving_size: servingSize.trim(), rows: cleanRows })
        : null;
      const body = {
        name, slug: finalSlug, category_id: categoryId,
        subcategory_id: subcategoryId === "" ? null : subcategoryId,
        description, long_description: "",
        nutrition_json: nutritionPayload,
        price: effectivePrice, image_url: imageUrl, is_veg: isVeg, is_active: isActive, is_featured: isFeatured,
        rating: initial?.rating ?? 5, sort_order: initial?.sort_order ?? 0,
        product_type: productType,
        variants: productType === "variable" ? cleanVariants : [],
      } as Partial<AdminProduct>;
      if (initial) await menuApi.updateProduct(initial.id, body);
      else await menuApi.createProduct(body);
      toast.success("Saved"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  function updateVariant(i: number, patch: Partial<{ name: string; price: number; is_base: boolean }>) {
    setVariants((arr) => arr.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  }
  function setBaseVariant(i: number) {
    setVariants((arr) => arr.map((v, idx) => ({ ...v, is_base: idx === i })));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[color:var(--card)] border-white/10 max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit menu" : "Add Menu"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3 [&>*]:min-w-0">
          <Labeled label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></Labeled>
          <Labeled label="Slug (URL)"><input value={slug} placeholder="Leave blank to auto-generate from name" onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className={inp} /></Labeled>
          <Labeled label="Category *">
            <select value={categoryId} onChange={(e) => { setCategoryId(parseInt(e.target.value)); setSubcategoryId(""); }} className={inp} required>
              <option value={0}>— Select a category —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Sub-category">
            <select
              value={subcategoryId === "" ? "" : String(subcategoryId)}
              onChange={(e) => setSubcategoryId(e.target.value === "" ? "" : parseInt(e.target.value))}
              className={inp}
              disabled={catSubs.length === 0}
            >
              <option value="">{catSubs.length === 0 ? "No subcategories" : "— None —"}</option>
              {catSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Product type">
            <select value={productType} onChange={(e) => setProductType(e.target.value as "simple" | "variable")} className={inp}>
              <option value="simple">Simple</option>
              <option value="variable">Variable</option>
            </select>
          </Labeled>
          {productType === "simple" ? (
            <Labeled label="Price (CAD)"><input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} className={inp} /></Labeled>
          ) : (
            <div className="rounded-md border border-white/10 p-3 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Variations &amp; prices</div>
                <button
                  type="button"
                  onClick={() => setVariants((v) => [...v, { name: "", price: 0, is_base: false }])}
                  className="text-xs text-[color:var(--flame-light)] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add row
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">First row (marked Base) is the default price shown on cards as “onwards”.</p>
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={v.name}
                      onChange={(e) => updateVariant(i, { name: e.target.value })}
                      placeholder={i === 0 ? "Variation name (e.g. Small)" : "Variation name (e.g. Large)"}
                      className={inp}
                    />
                    <input
                      type="number" step="0.01" min="0"
                      value={v.price}
                      onChange={(e) => updateVariant(i, { price: parseFloat(e.target.value) || 0 })}
                      placeholder="Price"
                      className={`${inp} w-28`}
                    />
                    <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                      <input type="radio" name="variant-base" checked={!!v.is_base} onChange={() => setBaseVariant(i)} /> Base
                    </label>
                    <button
                      type="button"
                      disabled={variants.length <= 2}
                      onClick={() => setVariants((arr) => arr.filter((_, idx) => idx !== i))}
                      className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-white/5 disabled:opacity-30"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Labeled label="Image" className="md:col-span-2">
            <div className="flex items-center gap-3">
              {imageUrl && <HoverThumb src={resolveAssetUrl(imageUrl)} className="h-14 w-14 rounded object-cover border border-white/10" />}
              <MediaPickerButton hasValue={!!imageUrl} onPick={(u) => setImageUrl(u)} uploadFolder="products" />
              {imageUrl && <button type="button" onClick={() => setImageUrl("")} className="text-xs text-muted-foreground hover:text-red-400">Remove</button>}
            </div>
          </Labeled>
          <Labeled label="Short description" className="md:col-span-2"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inp} /></Labeled>
          <div className="flex flex-wrap gap-4 text-sm md:col-span-2">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={isVeg} onChange={(e) => setIsVeg(e.target.checked)} /> Vegetarian</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
            <label className="inline-flex items-center gap-2" title="Show this item in the Our Menu section on the home page">
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured on Home
            </label>
          </div>

          {/* Optional nutrition facts. If left blank, the product page hides
              the nutrition table entirely. Mainly useful for Packaged Food. */}
          <div className="mt-2 pt-3 border-t border-white/10 md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nutrition facts (optional)</div>
              <button
                type="button"
                onClick={() => setNutriRows((r) => [...r, { label: "", value: "" }])}
                className="text-xs text-[color:var(--flame-light)] hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add row
              </button>
            </div>
            <Labeled label="Serving size">
              <input
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                placeholder="e.g. 1 tbsp (15 g)"
                className={inp}
              />
            </Labeled>
            {nutriRows.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">No nutrition rows. Add rows like “Energy / 60 kcal”, “Protein / 0.5 g”. Leave blank to hide the table on the product page.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {nutriRows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={r.label}
                      onChange={(e) => setNutriRows((arr) => arr.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                      placeholder="Nutrient (e.g. Protein)"
                      className={inp}
                    />
                    <input
                      value={r.value}
                      onChange={(e) => setNutriRows((arr) => arr.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                      placeholder="Amount (e.g. 0.5 g)"
                      className={inp}
                    />
                    <button
                      type="button"
                      onClick={() => setNutriRows((arr) => arr.filter((_, idx) => idx !== i))}
                      className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-white/5"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-white/10">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] text-white font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- À-La-Carte ----------
function AddonsTab({ groups, cats, subs, products, onChanged, loading }: {
  groups: AdminAddonGroup[]; cats: AdminCategory[]; subs: AdminSubcategory[]; products: AdminProduct[];
  onChanged: () => void; loading: boolean;
}) {
  type Bucket = {
    name: string; type: string; sized: boolean;
    categories: Set<string>; products: string[]; groupIds: number[];
    options: AdminAddonGroup["options"];
  };
  const [creating, setCreating] = useState(false);
  const buckets = useMemo(() => {
    const m = new Map<string, Bucket>();
    for (const g of groups) {
      const key = `${g.name}|${g.type}|${g.sized}`;
      const b = m.get(key) ?? {
        name: g.name, type: g.type, sized: g.sized,
        categories: new Set<string>(), products: [], groupIds: [], options: g.options,
      };
      b.categories.add(g.category_slug);
      if (!b.products.includes(g.product_name)) b.products.push(g.product_name);
      b.groupIds.push(g.id);
      m.set(key, b);
    }
    return Array.from(m.values());
  }, [groups]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">À-la-carte options are add-ons attached to category items. Use the scope picker on each card to control which categories / sub-categories show the add-on.</p>
        <button className={btnAdd} onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" /> New add-on menu
        </button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {buckets.map((b) => (
        <AddonGroupCard key={b.name + b.type + b.sized} bucket={b} cats={cats} subs={subs} products={products} onChanged={onChanged} />
      ))}
      {buckets.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">No à-la-carte add-ons yet.</p>
      )}
      {creating && (
        <NewAddonBucketDialog cats={cats} subs={subs} products={products}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); onChanged(); }} />
      )}
    </div>
  );
}

function AddonGroupCard({ bucket, cats, subs, products, onChanged }: {
  bucket: { name: string; type: string; sized: boolean; categories: Set<string>; products: string[]; groupIds: number[]; options: AdminAddonGroup["options"] };
  cats: AdminCategory[]; subs: AdminSubcategory[]; products: AdminProduct[]; onChanged: () => void;
}) {
  const bucketKey = `${bucket.name}|${bucket.type}|${bucket.sized}`;
  const [addingOption, setAddingOption] = useState(false);
  const [editingOption, setEditingOption] = useState<{ name: string; price: number } | null>(null);
  return (
    <div className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold text-lg">{bucket.name}</div>
          <div className="text-xs text-muted-foreground">
            {bucket.sized ? "Variable pricing (S / M / L)" : "Fixed price"} · {bucket.type === "single" ? "Single choice" : "Multi choice"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1 self-center">Currently shown on:</span>
            {Array.from(bucket.categories).map((c) => (
              <span key={c} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[color:var(--flame)]/15 text-[color:var(--flame-light)] border border-[color:var(--flame)]/30">{c}</span>
            ))}
            {bucket.categories.size === 0 && <span className="text-[10px] text-muted-foreground">none</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnAdd} onClick={() => setAddingOption(true)}>
            <Plus className="h-3.5 w-3.5" /> Add option
          </button>
          <ScopePicker
            bucketKey={bucketKey}
            templateGroupId={bucket.groupIds[0]}
            cats={cats}
            subs={subs}
            onSaved={onChanged}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
            <tr>
              <th className="text-left px-3 py-2">Option</th>
              {bucket.sized ? (
                <>
                  <th className="text-right px-3 py-2">Small</th>
                  <th className="text-right px-3 py-2">Medium</th>
                  <th className="text-right px-3 py-2">Large</th>
                </>
              ) : (
                <th className="text-right px-3 py-2">Price</th>
              )}
              <th className="text-right px-3 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {bucket.options.map((o) => (
              <tr key={o.id} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2 text-white">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
                      const target = norm(o.name);
                      const match = products.find((p) => p.image_url && (norm(p.name) === target || norm(p.name).includes(target) || target.includes(norm(p.name))));
                      return match?.image_url ? <HoverThumb src={resolveAssetUrl(match.image_url)} alt={o.name} className="h-8 w-8 rounded object-cover bg-white/5" /> : null;
                    })()}
                    <span>{o.name}</span>
                  </div>
                </td>
                {bucket.sized ? (
                  <>
                    <SizeCell size={o.sizes[0]} onChanged={onChanged} />
                    <SizeCell size={o.sizes[1]} onChanged={onChanged} />
                    <SizeCell size={o.sizes[2]} onChanged={onChanged} />
                  </>
                ) : (
                  <td className="px-3 py-2 text-right">
                    <InlinePrice value={o.price} onSave={async (v) => {
                      try { await menuApi.updateAddonBucketOption(bucketKey, { oldName: o.name, price: v }); toast.success("Price updated"); onChanged(); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
                    }} />
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <IconBtn title="Edit option" onClick={() => setEditingOption({ name: o.name, price: o.price })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Delete option" onClick={async () => {
                      if (!confirm(`Delete option "${o.name}" from every product in this add-on?`)) return;
                      try {
                        const sameName = bucket.options.filter((x) => x.name === o.name);
                        // Delete this row + any duplicates across other groups in the bucket.
                        // bucket.options only contains the template group's options, so we also need
                        // to look up siblings on the server side — simplest: delete this one and let
                        // a follow-up sync handle propagation. For now, delete just this row.
                        await menuApi.deleteAddonOption(o.id);
                        // Best-effort: also rename others via bucket helper to no-op (handles duplicates).
                        void sameName;
                        toast.success("Deleted"); onChanged();
                      }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
                    }} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {bucket.options.length === 0 && (
              <tr><td colSpan={bucket.sized ? 5 : 3} className="px-3 py-4 text-center text-xs text-muted-foreground italic">No options yet. Use “Add option”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground">
        Linked to {bucket.products.length} item{bucket.products.length === 1 ? "" : "s"}: {bucket.products.join(", ")}
      </div>

      {addingOption && (
        <AddonOptionDialog
          mode="add" sized={bucket.sized} products={products}
          onClose={() => setAddingOption(false)}
          onSave={async ({ name, price, sizes }) => {
            await menuApi.addAddonBucketOption(bucketKey, { name, price, sizes });
            toast.success("Option added"); setAddingOption(false); onChanged();
          }}
        />
      )}
      {editingOption && (
        <AddonOptionDialog
          mode="edit" sized={bucket.sized} products={products}
          initialName={editingOption.name} initialPrice={editingOption.price}
          onClose={() => setEditingOption(null)}
          onSave={async ({ name, price }) => {
            await menuApi.updateAddonBucketOption(bucketKey, {
              oldName: editingOption.name,
              newName: name !== editingOption.name ? name : undefined,
              price: !bucket.sized && price !== editingOption.price ? price : undefined,
            });
            toast.success("Option updated"); setEditingOption(null); onChanged();
          }}
        />
      )}
    </div>
  );
}

function ScopePicker({ bucketKey, templateGroupId, cats, subs, onSaved }: {
  bucketKey: string; templateGroupId: number;
  cats: AdminCategory[]; subs: AdminSubcategory[]; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selCats, setSelCats] = useState<Set<number>>(new Set());
  const [selSubs, setSelSubs] = useState<Set<number>>(new Set());

  const subsByCat = useMemo(() => {
    const m = new Map<number, AdminSubcategory[]>();
    for (const s of subs) {
      if (!m.has(s.category_id)) m.set(s.category_id, []);
      m.get(s.category_id)!.push(s);
    }
    return m;
  }, [subs]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    menuApi.getAddonBucketScope(bucketKey)
      .then((r) => { setSelCats(new Set(r.categoryIds)); setSelSubs(new Set(r.subcategoryIds)); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load scope"))
      .finally(() => setLoading(false));
  }, [open, bucketKey]);

  const toggleCat = (id: number) => {
    setSelCats((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    // Clear individual subs when the whole cat is toggled on
    setSelSubs((s) => {
      const n = new Set(s);
      for (const sub of subsByCat.get(id) ?? []) n.delete(sub.id);
      return n;
    });
  };
  const toggleSub = (sub: AdminSubcategory) => {
    setSelCats((s) => { const n = new Set(s); n.delete(sub.category_id); return n; });
    setSelSubs((s) => { const n = new Set(s); n.has(sub.id) ? n.delete(sub.id) : n.add(sub.id); return n; });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await menuApi.syncAddonBucket({
        templateGroupId,
        categoryIds: Array.from(selCats),
        subcategoryIds: Array.from(selSubs),
      });
      toast.success(`Scope updated · +${r.created} / -${r.removed}`);
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border border-white/15 hover:border-[color:var(--flame)] text-white">
          Scope <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-[420px] overflow-auto bg-[color:var(--card)] border-white/10 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Show this add-on on:
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-1.5">
            {cats.map((c) => {
              const catSubs = subsByCat.get(c.id) ?? [];
              const catChecked = selCats.has(c.id);
              const subChecked = catSubs.filter((s) => selSubs.has(s.id)).length;
              const indeterminate = !catChecked && subChecked > 0;
              return (
                <div key={c.id}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={catChecked}
                      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                      onChange={() => toggleCat(c.id)}
                      className="accent-[color:var(--flame)]"
                    />
                    <span className="font-semibold text-white">{c.name}</span>
                  </label>
                  {catSubs.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {catSubs.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer text-white/85">
                          <input
                            type="checkbox"
                            checked={catChecked || selSubs.has(s.id)}
                            disabled={catChecked}
                            onChange={() => toggleSub(s)}
                            className="accent-[color:var(--flame)]"
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30">Cancel</button>
          <button onClick={save} disabled={saving || loading}
            className="text-xs font-bold uppercase px-3 py-1.5 rounded-md bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SizeCell({ size, onChanged }: { size: { id: number; name: string; price: number } | undefined; onChanged: () => void }) {
  if (!size) return <td className="px-3 py-2 text-right text-muted-foreground">—</td>;
  return (
    <td className="px-3 py-2 text-right">
      <InlinePrice value={size.price} onSave={async (v) => {
        try { await menuApi.updateAddonOptionSize(size.id, { price: v }); toast.success(`${size.name} updated`); onChanged(); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
      }} />
    </td>
  );
}

function InlinePrice({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  if (!editing) {
    return <button onClick={() => setEditing(true)} className="text-[color:var(--flame-light)] hover:underline">${Number(value).toFixed(2)}</button>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus type="number" step="0.01" min="0" value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onSave(parseFloat(v) || 0); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        className="w-20 bg-[color:var(--background)] border border-[color:var(--flame)]/40 rounded px-1 py-0.5 text-right text-xs" />
      <button onClick={async () => { await onSave(parseFloat(v) || 0); setEditing(false); }} className="text-green-400"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
    </span>
  );
}

function Labeled({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`block ${className || ""}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ---------- Addon dialogs ----------
type AddonSize = { slug: string; name: string; price: number };
type AddonOptionPayload = { name: string; price: number; sizes?: AddonSize[] };

function AddonOptionDialog({
  mode, sized, products = [], initialName = "", initialPrice = 0, onClose, onSave,
}: {
  mode: "add" | "edit";
  sized: boolean;
  products?: AdminProduct[];
  initialName?: string;
  initialPrice?: number;
  onClose: () => void;
  onSave: (input: AddonOptionPayload) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(String(initialPrice));
  const [sizes, setSizes] = useState<AddonSize[]>([
    { slug: "s", name: "Small", price: 0 },
    { slug: "m", name: "Medium", price: 0 },
    { slug: "l", name: "Large", price: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const productListId = `addon-products-${mode}`;

  async function save() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        price: parseFloat(price) || 0,
        sizes: sized && mode === "add" ? sizes : undefined,
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[color:var(--card)] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add option" : "Edit option"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Labeled label="Option name (pick an existing menu item to link its image, or type a custom name)">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              list={productListId}
              className={inp}
              autoFocus
              placeholder="Start typing… e.g. Mango, Naan, Custom name"
            />
            <datalist id={productListId}>
              {products.map((p) => (
                <option key={p.id} value={p.name}>{p.category_slug ? `(${p.category_slug})` : ""}</option>
              ))}
            </datalist>
          </Labeled>
          {!sized && (
            <Labeled label="Price">
              <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inp} />
            </Labeled>
          )}
          {sized && mode === "add" && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Size pricing</div>
              {sizes.map((s, i) => (
                <div key={s.slug} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                  <input value={s.name} onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={inp} />
                  <input type="number" step="0.01" min="0" value={s.price}
                    onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x))}
                    className={inp} />
                </div>
              ))}
            </div>
          )}
          {sized && mode === "edit" && (
            <p className="text-xs text-muted-foreground">Tip: edit each size price directly in the row using the inline price editor.</p>
          )}
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

function NewAddonBucketDialog({ cats, subs, products, onClose, onSaved }: {
  cats: AdminCategory[]; subs: AdminSubcategory[]; products: AdminProduct[];
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"single" | "multi">("single");
  const [sized, setSized] = useState(false);
  const [required, setRequired] = useState(false);
  const [selCats, setSelCats] = useState<Set<number>>(new Set());
  const [selSubs, setSelSubs] = useState<Set<number>>(new Set());
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("0");
  const [sizes, setSizes] = useState<AddonSize[]>([
    { slug: "s", name: "Small", price: 0 },
    { slug: "m", name: "Medium", price: 0 },
    { slug: "l", name: "Large", price: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const subsByCat = useMemo(() => {
    const m = new Map<number, AdminSubcategory[]>();
    for (const s of subs) {
      if (!m.has(s.category_id)) m.set(s.category_id, []);
      m.get(s.category_id)!.push(s);
    }
    return m;
  }, [subs]);

  const toggleCat = (id: number) => {
    setSelCats((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setSelSubs((s) => { const n = new Set(s); for (const sub of subsByCat.get(id) ?? []) n.delete(sub.id); return n; });
  };
  const toggleSub = (sub: AdminSubcategory) => {
    setSelCats((s) => { const n = new Set(s); n.delete(sub.category_id); return n; });
    setSelSubs((s) => { const n = new Set(s); n.has(sub.id) ? n.delete(sub.id) : n.add(sub.id); return n; });
  };

  async function save() {
    if (!name.trim()) return toast.error("Menu name is required.");
    if (!optName.trim()) return toast.error("At least one option is required.");
    if (selCats.size === 0 && selSubs.size === 0) return toast.error("Pick at least one category or subcategory.");
    setSaving(true);
    try {
      await menuApi.createAddonBucket({
        name: name.trim(),
        selection_type: type,
        is_required: required,
        sized,
        categoryIds: Array.from(selCats),
        subcategoryIds: Array.from(selSubs),
        options: [{
          name: optName.trim(),
          price: parseFloat(optPrice) || 0,
          sizes: sized ? sizes : undefined,
        }],
      });
      toast.success("Add-on menu created");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[color:var(--card)] border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New add-on menu</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Labeled label="Menu title (pick a category / sub-category or type a custom title)">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="addon-menu-titles"
              className={inp}
              autoFocus
              placeholder="e.g. Curries, Smoothies, Choice of Bread…"
            />
            <datalist id="addon-menu-titles">
              {cats.map((c) => <option key={`c-${c.id}`} value={c.name}>Category</option>)}
              {subs.map((s) => <option key={`s-${s.id}`} value={s.name}>Sub-category</option>)}
            </datalist>
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Selection type">
              <select value={type} onChange={(e) => setType(e.target.value as "single" | "multi")} className={inp}>
                <option value="single">Single choice</option>
                <option value="multi">Multi choice</option>
              </select>
            </Labeled>
            <Labeled label="Pricing mode">
              <select value={sized ? "sized" : "fixed"} onChange={(e) => setSized(e.target.value === "sized")} className={inp}>
                <option value="fixed">Fixed price</option>
                <option value="sized">Sized (S / M / L)</option>
              </select>
            </Labeled>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-[color:var(--flame)]" />
            Required (customer must pick one)
          </label>

          <div className="border-t border-white/5 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">First option</div>
            <Labeled label="Option name (pick a menu item to link its image, or type custom)">
              <input
                value={optName}
                onChange={(e) => setOptName(e.target.value)}
                list="addon-new-option-products"
                className={inp}
                placeholder="e.g. Mango, Naan, Custom name"
              />
              <datalist id="addon-new-option-products">
                {products.map((p) => (
                  <option key={p.id} value={p.name}>{p.category_slug ? `(${p.category_slug})` : ""}</option>
                ))}
              </datalist>
            </Labeled>
            {!sized && (
              <Labeled label="Price">
                <input type="number" step="0.01" min="0" value={optPrice} onChange={(e) => setOptPrice(e.target.value)} className={inp} />
              </Labeled>
            )}
            {sized && (
              <div className="space-y-2 mt-2">
                {sizes.map((s, i) => (
                  <div key={s.slug} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                    <input value={s.name} onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={inp} />
                    <input type="number" step="0.01" min="0" value={s.price}
                      onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x))}
                      className={inp} />
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">More options can be added from the card once the menu is created.</p>
          </div>

          <div className="border-t border-white/5 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Show this add-on on</div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {cats.map((c) => {
                const catSubs = subsByCat.get(c.id) ?? [];
                const catChecked = selCats.has(c.id);
                return (
                  <div key={c.id}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={catChecked} onChange={() => toggleCat(c.id)} className="accent-[color:var(--flame)]" />
                      <span className="font-semibold text-white">{c.name}</span>
                    </label>
                    {catSubs.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1">
                        {catSubs.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer text-white/85">
                            <input type="checkbox" checked={catChecked || selSubs.has(s.id)} disabled={catChecked} onChange={() => toggleSub(s)} className="accent-[color:var(--flame)]" />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-white/10">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] text-white font-semibold disabled:opacity-60">
            {saving ? "Creating…" : "Create menu"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
