import { SearchClearButton } from "@/components/ui/search-clear";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAdminOrders, updateAdminOrder, deleteAdminOrder,
  fetchSiteSettings, fetchAllProducts, adminApi,
  type AdminOrder, type AdminOrderItem, type PaymentMethod, type SiteSettings, type AdminMe,
} from "@/lib/api";
import type { Product } from "@/lib/mock-data";
import { splitProductName } from "@/lib/utils";
import { formatCA } from "@/lib/datetime";
import OptimizedImage from "@/components/OptimizedImage";
import { toast } from "sonner";
import { TimePicker } from "@/components/ui/time-picker";
import { Eye, Pencil, Printer, Trash2, Plus, Minus, X, Search, Download, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { printReceipt } from "@/lib/receipt";
import OrderDetailsView from "@/components/OrderDetailsView";
import EditOrderDialog from "@/components/EditOrderDialog";
import { detectOrderTriggers, snapshotOrders, useNotificationRules } from "@/lib/notification-rules";

const STATUSES = ["new", "preparing", "ready", "picked_up", "cancelled"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300",
  preparing: "bg-yellow-500/20 text-yellow-300",
  ready: "bg-green-500/20 text-green-300",
  picked_up: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/20 text-red-300",
};
const PAY_LABEL: Record<string, string> = { cash: "Cash", debit: "Debit Card", credit: "Credit Card" };

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [kindFilter, setKindFilter] = useState<"all" | "regular" | "preorder">("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [settings, setSettings] = useState<SiteSettings>({});
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<AdminOrder | null>(null);
  const [editing, setEditing] = useState<AdminOrder | null>(null);
  const [deleting, setDeleting] = useState<AdminOrder | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [me, setMe] = useState<AdminMe | null>(null);
  useEffect(() => { adminApi.me().then((r) => setMe(r.user)).catch(() => {}); }, []);
  const canView = !me || me.is_super || me.role !== "kitchen_manager";
  const notify = useNotificationRules();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const prevSnap = useRef<Map<string, string> | null>(null);

  const load = async () => {
    try {
      const data = await fetchAdminOrders();
      for (const t of detectOrderTriggers(prevSnap.current, data)) notifyRef.current.play(t);
      prevSnap.current = snapshotOrders(data);
      setOrders(data);
      setLastRefresh(new Date());
    } catch { /* ignore polling errors */ }
  };
  const manualRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  useEffect(() => {
    load();
    fetchSiteSettings().then(setSettings);
    fetchAllProducts().then((ps: Product[]) => {
      const m: Record<string, string> = {};
      for (const p of ps) m[p.name.toLowerCase()] = p.image;
      setProductImages(m);
    }).catch(() => {});
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, []);


  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const isPre = !!o.isPreorder;
      if (kindFilter === "preorder" && !isPre) return false;
      if (kindFilter === "regular" && isPre) return false;
      if (filter !== "all" && o.status !== filter) return false;
      if (payFilter === "paid" && !o.paidAt) return false;
      if (payFilter === "unpaid" && o.paidAt) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!o.orderNumber.toLowerCase().includes(q) &&
            !o.customerName.toLowerCase().includes(q) &&
            !o.customerPhone.toLowerCase().includes(q)) return false;
      }
      if (dateFrom) {
        if (new Date(o.createdAt) < new Date(dateFrom + "T00:00:00")) return false;
      }
      if (dateTo) {
        if (new Date(o.createdAt) > new Date(dateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [orders, filter, payFilter, kindFilter, query, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paged = useMemo(() => filtered.slice(pageStart, pageStart + pageSize), [filtered, pageStart, pageSize]);

  useEffect(() => { setPage(1); }, [filter, payFilter, kindFilter, query, dateFrom, dateTo, pageSize]);

  function exportCSV() {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    const headers = ["Order #", "Date", "Customer", "Phone", "Status", "Payment", "Paid At", "Pickup Time", "Subtotal", "Items", "Notes"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((o) => [
      o.orderNumber,
      formatCA(o.createdAt),
      o.customerName,
      o.customerPhone,
      o.status,
      o.paidAt ? (o.paymentMethod || "cash") : "unpaid",
      o.paidAt ? formatCA(o.paidAt) : "",
      o.pickupTime || "",
      o.subtotal.toFixed(2),
      o.items.map((i) => `${i.quantity}x ${i.productName}`).join("; "),
      o.notes || "",
    ].map(esc).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} orders`);
  }

  async function quickStatus(orderNumber: string, status: string) {
    await updateAdminOrder(orderNumber, { status });
    setOrders((p) => p.map((o) => o.orderNumber === orderNumber ? { ...o, status } : o));
    toast.success(`Order #${orderNumber} → ${status.replace("_", " ")}`);
  }

  async function quickPayment(orderNumber: string, value: string) {
    const paid = value !== "unpaid";
    const paymentMethod = (paid ? value : null) as PaymentMethod | null;
    const { order: updated, dispatchError } = await updateAdminOrder(orderNumber, { paid, paymentMethod });
    setOrders((p) => p.map((o) => o.orderNumber === orderNumber
      ? (updated || { ...o, paymentMethod, paidAt: paid ? (o.paidAt || new Date().toISOString()) : null })
      : o));
    if (viewing?.orderNumber === orderNumber && updated) setViewing(updated);
    if (dispatchError) toast.error(`Courier dispatch failed: ${dispatchError}`);
    toast.success(`Payment updated`);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteAdminOrder(deleting.orderNumber);
      setOrders((p) => p.filter((o) => o.orderNumber !== deleting.orderNumber));
      toast.success(`Deleted #${deleting.orderNumber}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  function handlePrint(o: AdminOrder) { printReceipt(o, settings); }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Live COD pickup orders. Auto-refreshes every 5s. Last updated {lastRefresh.toLocaleTimeString()}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/15 hover:bg-white/5 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white text-xs font-semibold"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order #, name, phone…"
            className="h-9 w-full rounded-md border border-white/10 bg-[color:var(--background)] pl-9 pr-9 text-sm"
          />
          <SearchClearButton show={!!query} onClear={() => setQuery("")} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Date:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-md border border-white/10 bg-[color:var(--background)] px-2 text-xs" />
          <span>→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-md border border-white/10 bg-[color:var(--background)] px-2 text-xs" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-muted-foreground hover:text-white" title="Clear dates"><X className="h-4 w-4" /></button>
          )}
        </div>
        <select value={payFilter} onChange={(e) => setPayFilter(e.target.value as "all" | "paid" | "unpaid")} className="h-9 rounded-md border border-white/10 bg-[color:var(--background)] px-2 text-xs">
          <option value="all">All payments</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      <div className="mt-4 flex gap-2 flex-wrap text-xs items-center">
        <div className="flex gap-1 rounded-full border border-white/10 p-0.5 mr-2">
          {(["all", "regular", "preorder"] as const).map((k) => {
            const count = k === "all" ? orders.length : k === "preorder" ? orders.filter((o) => o.isPreorder).length : orders.filter((o) => !o.isPreorder).length;
            return (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                className={`px-3 py-1 rounded-full ${kindFilter === k ? "bg-[color:var(--flame)] text-white" : "text-muted-foreground hover:text-white"}`}
              >
                {k === "all" ? "All" : k === "preorder" ? "Pre-orders" : "Regular"} ({count})
              </button>
            );
          })}
        </div>
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full border ${filter === s ? "bg-[color:var(--flame)] border-[color:var(--flame)] text-white" : "border-white/10 text-muted-foreground hover:text-white"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
              <tr>
                <th className="text-left px-3 py-3">Order #</th>
                <th className="text-left px-3 py-3">Ordered By</th>
                <th className="text-left px-3 py-3">Phone</th>
                <th className="text-left px-3 py-3">Date / Time</th>
                <th className="text-left px-3 py-3">Order Type</th>
                <th className="text-right px-3 py-3">Total</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-left px-3 py-3">Payment</th>
                <th className="text-right px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No orders.</td></tr>
              )}
              {(() => {
                const taxRate = parseFloat(settings.gst_rate_percent || settings.tax_rate || "0") || 0;
                return paged.map((o) => {
                  const disc = o.discount ?? 0;
                  const base = Math.max(0, o.subtotal - disc);
                  const taxAmt = Math.round(base * (taxRate / 100) * 100) / 100;
                  const isDel = o.diningOption === "delivery";
                  const delFee = isDel ? Number(o.deliveryFee || 0) : 0;
                  const pkgFee = isDel ? (parseFloat(settings.delivery_packaging_fee || "0") || 0) : 0;
                  const grand = Math.round((base + taxAmt + delFee + pkgFee) * 100) / 100;
                  const orderType = o.diningOption === "delivery"
                    ? { label: "Delivery", cls: "bg-purple-500/20 text-purple-300" }
                    : o.diningOption === "to_stay"
                      ? { label: "To Stay", cls: "bg-amber-500/20 text-amber-300" }
                      : o.staffUsername
                        ? { label: "To Go", cls: "bg-emerald-500/20 text-emerald-300" }
                        : { label: "Pickup", cls: "bg-cyan-500/20 text-cyan-300" };
                  return (
                <tr key={o.orderNumber} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-3 font-bold">#{o.orderNumber}</td>
                  <td className="px-3 py-3">{o.customerName}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <a href={`tel:${o.customerPhone}`} className="hover:text-white">{o.customerPhone}</a>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatCA(o.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded text-[10px] uppercase tracking-wider px-2 py-1 font-semibold ${orderType.cls}`}>{orderType.label}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-[color:var(--flame-light)]" title={`Subtotal $${o.subtotal.toFixed(2)}${disc ? ` − Discount $${disc.toFixed(2)}` : ""}${taxAmt ? ` + Tax $${taxAmt.toFixed(2)}` : ""}${delFee ? ` + Delivery $${delFee.toFixed(2)}` : ""}${pkgFee ? ` + Packaging $${pkgFee.toFixed(2)}` : ""}`}>${grand.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <select
                      value={o.status}
                      onChange={(e) => quickStatus(o.orderNumber, e.target.value)}
                      className={`bg-transparent border-0 rounded text-[10px] uppercase tracking-wider px-2 py-1 cursor-pointer ${STATUS_COLORS[o.status] || ""}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s} className="bg-[color:var(--card)]">{s.replace("_", " ")}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <select
                      value={o.paidAt ? (o.paymentMethod || "cash") : "unpaid"}
                      onChange={(e) => quickPayment(o.orderNumber, e.target.value)}
                      className={`bg-transparent border border-white/10 rounded text-xs px-2 py-1 cursor-pointer ${o.paidAt ? "text-green-400" : "text-muted-foreground"}`}
                    >
                      <option value="unpaid" className="bg-[color:var(--card)]">Unpaid (COD)</option>
                      <option value="cash" className="bg-[color:var(--card)]">Paid · Cash</option>
                      <option value="debit" className="bg-[color:var(--card)]">Paid · Debit</option>
                      <option value="credit" className="bg-[color:var(--card)]">Paid · Credit</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {canView && <IconBtn title="View" onClick={() => setViewing(o)}><Eye className="h-4 w-4" /></IconBtn>}
                      <IconBtn title="Edit" onClick={() => setEditing(o)}><Pencil className="h-4 w-4" /></IconBtn>
                      <IconBtn title="Print receipt" onClick={() => handlePrint(o)}><Printer className="h-4 w-4" /></IconBtn>
                      <IconBtn title="Delete" onClick={() => setDeleting(o)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </td>
                </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-white/5 text-xs text-muted-foreground">
            <div>
              Showing <span className="text-white">{pageStart + 1}</span>–<span className="text-white">{Math.min(pageStart + pageSize, filtered.length)}</span> of <span className="text-white">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-[color:var(--card)] border border-white/10 rounded px-2 py-1 text-xs text-white"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2 py-1 rounded border border-white/10 disabled:opacity-40 hover:bg-white/5"
                >Prev</button>
                <span className="px-2">Page {currentPage} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2 py-1 rounded border border-white/10 disabled:opacity-40 hover:bg-white/5"
                >Next</button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* View modal */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg bg-[color:var(--card)] border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order #{viewing?.orderNumber}</DialogTitle></DialogHeader>
          {viewing && <OrderDetailsView order={viewing} settings={settings} productImages={productImages} />}
        </DialogContent>
      </Dialog>



      {/* Edit modal */}
      {editing && (
        <EditOrderDialog
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setOrders((p) => p.map((o) => o.orderNumber === updated.orderNumber ? updated : o));
            setEditing(null);
          }}
        />
      )}

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-[color:var(--card)] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order #{deleting?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the order and its line items.</AlertDialogDescription>
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

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 ${danger ? "text-red-400 hover:bg-red-500/10" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
    >
      {children}
    </button>
  );
}




