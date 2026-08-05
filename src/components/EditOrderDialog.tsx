import { useEffect, useMemo, useState } from "react";
import { fetchAllProducts, updateAdminOrder, type AdminOrder, type AdminOrderItem, type PaymentMethod } from "@/lib/api";
import type { Product } from "@/lib/mock-data";
import { toast } from "sonner";
import { TimePicker } from "@/components/ui/time-picker";
import { Plus, Minus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function ProductNameInput({
  value, onPick, onChange, className,
  catalog,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (name: string, price: number) => void;
  className?: string;
  catalog: Product[];
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, catalog]);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={className}
        placeholder="Item name"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-[color:var(--background)] border border-white/10 rounded-md shadow-lg max-h-56 overflow-auto text-xs">
          {matches.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(p.name, p.price); setOpen(false); }}
                className="w-full text-left px-2 py-1.5 hover:bg-white/5 flex justify-between gap-2"
              >
                <span className="truncate">{p.name}</span>
                <span className="text-[color:var(--flame-light)] shrink-0">${p.price.toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUSES = ["new", "preparing", "ready", "picked_up", "cancelled"] as const;
const PAY_LABEL: Record<string, string> = { cash: "Cash", debit: "Debit Card", credit: "Credit Card" };

const inp = "w-full bg-[color:var(--background)] border border-white/10 rounded-md px-2 py-1.5 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/**
 * Shared edit-order dialog used by both admin (/admin/orders) and staff/customer
 * (/orders) surfaces so edit behaviour never drifts.
 */
export default function EditOrderDialog({
  order, onClose, onSaved,
}: {
  order: AdminOrder; onClose: () => void; onSaved: (o: AdminOrder) => void;
}) {
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone);
  const [pickupTime, setPickupTime] = useState(order.pickupTime || "");
  const [notes, setNotes] = useState(order.notes || "");
  const [status, setStatus] = useState(order.status);
  const [paid, setPaid] = useState(!!order.paidAt);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod || "cash");
  const [items, setItems] = useState<AdminOrderItem[]>(order.items.map((i) => ({ ...i })));
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => { fetchAllProducts().then(setCatalog).catch(() => {}); }, []);

  const subtotal = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100,
    [items]
  );

  const updateQty = (idx: number, qty: number) => {
    setItems((arr) => arr.map((it, i) => i === idx
      ? { ...it, quantity: Math.max(1, qty), lineTotal: Math.round(it.unitPrice * Math.max(1, qty) * 100) / 100 }
      : it));
  };
  const updatePrice = (idx: number, price: number) => {
    setItems((arr) => arr.map((it, i) => i === idx
      ? { ...it, unitPrice: price, lineTotal: Math.round(price * it.quantity * 100) / 100 }
      : it));
  };
  const removeItem = (idx: number) => setItems((arr) => arr.filter((_, i) => i !== idx));
  const addItem = () => setItems((arr) => [...arr, { productName: "", unitPrice: 0, quantity: 1, lineTotal: 0 }]);

  async function save() {
    setSaving(true);
    try {
      const { order: updated, dispatchError } = await updateAdminOrder(order.orderNumber, {
        status, customerName, customerPhone,
        pickupTime: pickupTime || undefined,
        notes: notes || undefined,
        paid, paymentMethod: paid ? paymentMethod : null,
        items,
      });
      if (dispatchError) toast.error(`Courier dispatch failed: ${dispatchError}`);
      onSaved(updated || {
        ...order, customerName, customerPhone, pickupTime: pickupTime || undefined,
        notes: notes || undefined, status, items, subtotal,
        paymentMethod: paid ? paymentMethod : null,
        paidAt: paid ? (order.paidAt || new Date().toISOString()) : null,
      });
      toast.success("Order updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-[color:var(--card)] border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit order #{order.orderNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Customer name"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inp} /></Field>
            <Field label="Phone"><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inp} /></Field>
            <Field label="Pickup time"><TimePicker value={pickupTime} onChange={setPickupTime} placeholder="Pickup time" /></Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inp} /></Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Items</div>
              <button onClick={addItem} className="text-xs inline-flex items-center gap-1 text-[color:var(--flame-light)] hover:text-white">
                <Plus className="h-3 w-3" /> Add item
              </button>
            </div>
            <div className="border border-white/10 rounded-lg divide-y divide-white/5">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_90px_70px_90px_32px] gap-2 items-center p-2">
                  <ProductNameInput
                    value={it.productName}
                    catalog={catalog}
                    className={inp + " text-xs"}
                    onChange={(v) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, productName: v } : x))}
                    onPick={(name, price) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, productName: name, unitPrice: price, lineTotal: Math.round(price * x.quantity * 100) / 100 } : x))}
                  />
                  <input type="number" step="0.01" min="0" value={it.unitPrice} onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)} className={inp + " text-xs text-right"} />
                  <div className="inline-flex items-center justify-center rounded border border-white/10">
                    <button onClick={() => updateQty(idx, it.quantity - 1)} className="h-7 w-6 text-[color:var(--flame)]"><Minus className="h-3 w-3 mx-auto" /></button>
                    <span className="w-6 text-center text-xs">{it.quantity}</span>
                    <button onClick={() => updateQty(idx, it.quantity + 1)} className="h-7 w-6 text-[color:var(--flame)]"><Plus className="h-3 w-3 mx-auto" /></button>
                  </div>
                  <div className="text-right text-xs text-[color:var(--flame-light)]">${it.lineTotal.toFixed(2)}</div>
                  <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-red-400"><X className="h-3.5 w-3.5 mx-auto" /></button>
                </div>
              ))}
              {items.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">No items.</div>}
            </div>
            <div className="text-right font-bold mt-2">Total: <span className="text-[color:var(--flame-light)]">${subtotal.toFixed(2)}</span></div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-green-500" />
              <span className="text-sm font-semibold">Mark as paid</span>
            </label>
            {paid && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {(["cash", "debit", "credit"] as PaymentMethod[]).map((m) => (
                  <label key={m} className={`px-3 py-1.5 rounded-full border cursor-pointer text-xs ${paymentMethod === m ? "bg-[color:var(--flame)] border-[color:var(--flame)] text-white" : "border-white/10 text-muted-foreground hover:text-white"}`}>
                    <input type="radio" name="pm" className="hidden" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} />
                    {PAY_LABEL[m]}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-white/10 hover:bg-white/5">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white font-semibold disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
