import { SearchClearButton } from "@/components/ui/search-clear";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { type InventoryItem, deleteItem, loadInventory, newId, upsertItem } from "@/lib/inventory";

const EMPTY: InventoryItem = {
  id: "", name: "", sku: "", unit: "kg", quantity: 0, unitCost: 0, reorderLevel: 0, supplier: "", updatedAt: "",
};

export default function AdminInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InventoryItem>(EMPTY);

  useEffect(() => { setItems(loadInventory()); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || (i.sku || "").toLowerCase().includes(q) || (i.supplier || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalValue = filtered.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  function openAdd() { setDraft({ ...EMPTY, id: newId() }); setOpen(true); }
  function openEdit(i: InventoryItem) { setDraft({ ...i }); setOpen(true); }
  function save() {
    if (!draft.name.trim()) return toast.error("Name required");
    const item = { ...draft, updatedAt: new Date().toISOString() };
    upsertItem(item);
    setItems(loadInventory());
    setOpen(false);
    toast.success("Saved");
  }
  function remove(id: string) {
    if (!confirm("Delete this inventory item?")) return;
    deleteItem(id); setItems(loadInventory());
  }

  function exportCsv() {
    const rows = [["Name","SKU","Unit","Quantity","Unit Cost","Total Value","Reorder Level","Supplier","Updated"]];
    filtered.forEach((i) => rows.push([
      i.name, i.sku || "", i.unit, String(i.quantity), i.unitCost.toFixed(2),
      (i.quantity * i.unitCost).toFixed(2), String(i.reorderLevel ?? ""), i.supplier || "",
      i.updatedAt ? new Date(i.updatedAt).toLocaleString() : "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inventory-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage raw material stock and prices. Not linked to menu or orders.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add item</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 pr-8" placeholder="Search name, SKU, supplier" value={search} onChange={(e) => setSearch(e.target.value)} />
          <SearchClearButton show={!!search} onClear={() => setSearch("")} />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} item{filtered.length === 1 ? "" : "s"} · Total stock value: <span className="text-white font-medium">${totalValue.toFixed(2)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Reorder</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No inventory items yet.</TableCell></TableRow>
            )}
            {filtered.map((i) => {
              const low = i.reorderLevel != null && i.quantity <= (i.reorderLevel || 0);
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-muted-foreground">{i.sku || "—"}</TableCell>
                  <TableCell>{i.unit}</TableCell>
                  <TableCell className={`text-right ${low ? "text-red-400" : ""}`}>{i.quantity}</TableCell>
                  <TableCell className="text-right">${i.unitCost.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${(i.quantity * i.unitCost).toFixed(2)}</TableCell>
                  <TableCell>{i.reorderLevel ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{i.supplier || "—"}</TableCell>
                  <TableCell className="text-right">
                    <button onClick={() => openEdit(i)} className="p-1.5 hover:text-white text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(i.id)} className="p-1.5 hover:text-red-400 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{items.find((x) => x.id === draft.id) ? "Edit item" : "Add item"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="SKU"><Input value={draft.sku || ""} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></Field>
            <Field label="Unit">
              <select
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <optgroup label="Weight (Metric)">
                  <option value="mg">Milligram (mg)</option>
                  <option value="g">Gram (g)</option>
                  <option value="kg">Kilogram (kg)</option>
                </optgroup>
                <optgroup label="Weight (US/Imperial)">
                  <option value="oz">Ounce (oz)</option>
                  <option value="lb">Pound (lb)</option>
                </optgroup>
                <optgroup label="Volume (Metric)">
                  <option value="ml">Millilitre (ml)</option>
                  <option value="l">Litre (L)</option>
                </optgroup>
                <optgroup label="Volume (US)">
                  <option value="tsp">Teaspoon (tsp)</option>
                  <option value="tbsp">Tablespoon (tbsp)</option>
                  <option value="fl oz">Fluid ounce (fl oz)</option>
                  <option value="cup">Cup</option>
                  <option value="pt">Pint (pt)</option>
                  <option value="qt">Quart (qt)</option>
                  <option value="gal">Gallon (gal)</option>
                </optgroup>
                <optgroup label="Length">
                  <option value="mm">Millimetre (mm)</option>
                  <option value="cm">Centimetre (cm)</option>
                  <option value="m">Metre (m)</option>
                  <option value="in">Inch (in)</option>
                  <option value="ft">Foot (ft)</option>
                </optgroup>
                <optgroup label="Count / Pack">
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="dozen">Dozen</option>
                  <option value="pack">Pack</option>
                  <option value="box">Box</option>
                  <option value="case">Case</option>
                  <option value="bag">Bag</option>
                  <option value="bottle">Bottle</option>
                  <option value="can">Can</option>
                  <option value="jar">Jar</option>
                  <option value="tray">Tray</option>
                  <option value="roll">Roll</option>
                </optgroup>
              </select>
            </Field>
            <Field label="Quantity"><Input type="number" step="0.01" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} /></Field>
            <Field label="Unit cost (CAD)"><Input type="number" step="0.01" value={draft.unitCost} onChange={(e) => setDraft({ ...draft, unitCost: Number(e.target.value) })} /></Field>
            <Field label="Reorder level"><Input type="number" step="0.01" value={draft.reorderLevel ?? 0} onChange={(e) => setDraft({ ...draft, reorderLevel: Number(e.target.value) })} /></Field>
            <Field label="Supplier"><Input value={draft.supplier || ""} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
