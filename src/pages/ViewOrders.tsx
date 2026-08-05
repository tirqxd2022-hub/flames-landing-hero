import { SearchClearButton } from "@/components/ui/search-clear";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, Pencil, Printer, Trash2, Search, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchAdminOrders, fetchMyOrders, updateAdminOrder, deleteAdminOrder,
  fetchSiteSettings, fetchAllProducts,
  type AdminOrder, type PaymentMethod, type SiteSettings,
} from "@/lib/api";
import type { Product } from "@/lib/mock-data";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCA } from "@/lib/datetime";
import OrderDetailsView from "@/components/OrderDetailsView";
import EditOrderDialog from "@/components/EditOrderDialog";
import { printReceipt } from "@/lib/receipt";
import { PAY_LABEL, DINING_LABEL, computeOrderTotals } from "@/lib/order-shared";

const STATUSES = ["all", "new", "preparing", "ready", "picked_up", "cancelled"] as const;

export default function ViewOrders() {
  const { user, isStaff, loading } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<AdminOrder | null>(null);
  const [editing, setEditing] = useState<AdminOrder | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1);

  const load = (silent = true) => {
    if (!silent) setRefreshing(true);
    return (isStaff ? fetchAdminOrders() : fetchMyOrders())
      .then((d) => { setOrders(d); setLastRefresh(new Date()); })
      .catch((e) => toast.error(e.message))
      .finally(() => { if (!silent) setRefreshing(false); });
  };
  const manualRefresh = () => load(false);

  useEffect(() => {
    if (!user) return;
    load();
    fetchSiteSettings().then(setSettings).catch(() => {});
    fetchAllProducts().then((ps: Product[]) => {
      const map: Record<string, string> = {};
      for (const p of ps) map[p.name.toLowerCase()] = p.image;
      setProductImages(map);
    }).catch(() => {});
    // Auto-refresh every 5s so the counter view stays live.
    const id = window.setInterval(() => { load(); }, 5000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isStaff]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (payFilter === "paid" && !o.paidAt) return false;
      if (payFilter === "unpaid" && o.paidAt) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!o.orderNumber.toLowerCase().includes(q) && !o.customerName.toLowerCase().includes(q) && !o.customerPhone.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, status, payFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paged = useMemo(() => filtered.slice(pageStart, pageStart + pageSize), [filtered, pageStart, pageSize]);
  useEffect(() => { setPage(1); }, [status, payFilter, query, pageSize]);


  if (loading) return <section className="pt-32 pb-20 text-center text-muted-foreground">Loading…</section>;
  if (!user) return <Navigate to="/" replace />;

  function handlePrint(o: AdminOrder) { printReceipt(o, settings); }

  async function quickStatus(num: string, s: string) {
    if (!isStaff) return;
    await updateAdminOrder(num, { status: s });
    setOrders((p) => p.map((o) => o.orderNumber === num ? { ...o, status: s } : o));
  }

  async function quickPayment(num: string, value: string) {
    if (!isStaff) return;
    const paid = value !== "unpaid";
    const paymentMethod = (paid ? value : null) as PaymentMethod | null;
    const { order: updated, dispatchError } = await updateAdminOrder(num, { paid, paymentMethod });
    setOrders((p) => p.map((o) => o.orderNumber === num
      ? (updated || { ...o, paymentMethod, paidAt: paid ? (o.paidAt || new Date().toISOString()) : null })
      : o));
    if (viewing?.orderNumber === num && updated) setViewing(updated);
    if (dispatchError) toast.error(`Courier dispatch failed: ${dispatchError}`);
  }

  async function quickDining(num: string, value: "to_go" | "to_stay") {
    if (!isStaff) return;
    await updateAdminOrder(num, { diningOption: value });
    setOrders((p) => p.map((o) => o.orderNumber === num ? { ...o, diningOption: value } : o));
  }

  async function handleDelete(o: AdminOrder) {
    if (!confirm(`Delete order #${o.orderNumber}?`)) return;
    try { await deleteAdminOrder(o.orderNumber); setOrders((p) => p.filter((x) => x.orderNumber !== o.orderNumber)); toast.success("Deleted"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">{isStaff ? "All Orders" : "My Orders"}</h1>
            <p className="text-sm text-muted-foreground">
              {isStaff ? "Live COD pickup orders." : "Your past and current orders."} · Last updated {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-white/10 hover:border-white/30 text-muted-foreground hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order #, name, phone…" className="h-10 w-full rounded-md border border-white/10 bg-[color:var(--card)] pl-9 pr-9 text-sm" />
            <SearchClearButton show={!!query} onClear={() => setQuery("")} />
          </div>
          <div className="flex gap-1 flex-wrap text-xs">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-full border ${status === s ? "bg-[color:var(--flame)] border-[color:var(--flame)] text-white" : "border-white/10 text-muted-foreground hover:text-white"}`}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value as "all" | "paid" | "unpaid")} className="h-9 rounded-md border border-white/10 bg-[color:var(--card)] px-2 text-xs">
            <option value="all">All payments</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
          </select>
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
                  <th className="text-right px-3 py-3">Total</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Payment</th>
                  <th className="text-left px-3 py-3">Order Type</th>
                  {isStaff && <th className="text-right px-3 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">No orders.</td></tr>
                )}
                {paged.map((o) => {
                  const t = computeOrderTotals(o, settings);
                  const disc = t.discount;
                  return (
                  <tr key={o.orderNumber} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-bold">#{o.orderNumber}</td>
                    <td className="px-3 py-3">{o.customerName}</td>
                    <td className="px-3 py-3 text-muted-foreground"><a href={`tel:${o.customerPhone}`} className="hover:text-white">{o.customerPhone}</a></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatCA(o.createdAt)}</td>
                    <td className="px-3 py-3 text-right font-bold text-[color:var(--flame-light)]" title={`Subtotal $${o.subtotal.toFixed(2)}${disc ? ` − Discount $${disc.toFixed(2)}` : ""}${t.tax ? ` + Tax $${t.tax.toFixed(2)}` : ""}${t.deliveryFee ? ` + Delivery $${t.deliveryFee.toFixed(2)}` : ""}${t.packagingFee ? ` + Packaging $${t.packagingFee.toFixed(2)}` : ""}`}>${t.grand.toFixed(2)}</td>
                    <td className="px-3 py-3 text-xs uppercase tracking-wider">
                      {isStaff ? (
                        <select value={o.status} onChange={(e) => quickStatus(o.orderNumber, e.target.value)} className="bg-transparent border border-white/10 rounded text-xs px-2 py-1 cursor-pointer">
                          {STATUSES.slice(1).map((s) => <option key={s} value={s} className="bg-[color:var(--card)]">{s.replace("_", " ")}</option>)}
                        </select>
                      ) : o.status.replace("_", " ")}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {isStaff ? (
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
                      ) : o.paidAt ? (
                        <span className="text-green-400">● Paid <span className="text-muted-foreground">({o.paymentMethod ? PAY_LABEL[o.paymentMethod] : "COD"})</span></span>
                      ) : <span className="text-muted-foreground">Unpaid (COD)</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {(() => {
                        // Classify by dining option first — a delivery order is always
                        // customer-facing, even if a staff member punched it in on
                        // the customer's behalf.
                        if (o.diningOption === "delivery") {
                          return <span className="inline-block rounded text-[10px] uppercase tracking-wider px-2 py-1 font-semibold bg-purple-500/20 text-purple-300">Delivery</span>;
                        }
                        const isCounter = !!o.staffUsername && (o.diningOption === "to_go" || o.diningOption === "to_stay");
                        if (!isCounter) {
                          return <span className="inline-block rounded text-[10px] uppercase tracking-wider px-2 py-1 font-semibold bg-cyan-500/20 text-cyan-300">Pickup</span>;
                        }
                        return isStaff ? (
                          <select
                            value={o.diningOption === "to_stay" ? "to_stay" : "to_go"}
                            onChange={(e) => quickDining(o.orderNumber, e.target.value as "to_go" | "to_stay")}
                            className="bg-transparent border border-white/10 rounded text-xs px-2 py-1 cursor-pointer"
                          >
                            <option value="to_go" className="bg-[color:var(--card)]">To go</option>
                            <option value="to_stay" className="bg-[color:var(--card)]">To stay</option>
                          </select>
                        ) : DINING_LABEL[o.diningOption || "to_go"];
                      })()}
                    </td>
                    {isStaff && (
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <IconBtn title="View" onClick={() => setViewing(o)}><Eye className="h-4 w-4" /></IconBtn>
                          <IconBtn title="Edit" onClick={() => setEditing(o)}><Pencil className="h-4 w-4" /></IconBtn>
                          <IconBtn title="Print" onClick={() => handlePrint(o)}><Printer className="h-4 w-4" /></IconBtn>
                          <IconBtn title="Delete" onClick={() => handleDelete(o)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })}
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
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg bg-[color:var(--card)] border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order #{viewing?.orderNumber}</DialogTitle>
          </DialogHeader>
          {viewing && <OrderDetailsView order={viewing} settings={settings} productImages={productImages} />}
        </DialogContent>
      </Dialog>

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
    </section>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`h-8 w-8 grid place-items-center rounded-md border border-white/10 hover:border-white/30 ${danger ? "text-red-400 hover:bg-red-500/10" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

