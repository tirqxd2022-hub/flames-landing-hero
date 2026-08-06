import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import LoginModal from "@/components/auth/LoginModal";
import { Clock, RefreshCw, CheckCircle2, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchAdminOrders, updateAdminOrder, type AdminOrder } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCA } from "@/lib/datetime";
import { detectOrderTriggers, snapshotOrders, useNotificationRules } from "@/lib/notification-rules";

const PAY_LABEL: Record<string, string> = { cash: "Cash", debit: "Debit Card", credit: "Credit Card" };

// Kitchen-facing live queue. Only shows orders that still need preparation.
const ACTIVE_STATUSES = new Set(["new", "preparing"]);
const STATUS_OPTIONS = ["new", "preparing", "ready", "cancelled"] as const;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function formatElapsed(ms: number) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function CurrentOrders() {
  const { user, isStaff, loading } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<AdminOrder | null>(null);
  const timerRef = useRef<number | null>(null);
  const now = useNow(1000);
  const notify = useNotificationRules();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const prevSnap = useRef<Map<string, string> | null>(null);

  const load = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const all = await fetchAdminOrders();
      for (const t of detectOrderTriggers(prevSnap.current, all)) notifyRef.current.play(t);
      prevSnap.current = snapshotOrders(all);
      const cutoff = Date.now() + 30 * 60 * 1000;
      setOrders(all.filter((o) => {
        if (!ACTIVE_STATUSES.has(o.status) || !o.paidAt) return false;
        // Pre-orders only appear once we're within 30 minutes of their scheduled time.
        if (o.isPreorder && o.preorderAt) {
          return new Date(o.preorderAt).getTime() <= cutoff;
        }
        return true;
      }));
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user || !isStaff) return;
    load();
    timerRef.current = window.setInterval(() => load(true), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isStaff]);

  const sorted = useMemo(
    () => [...orders].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [orders],
  );

  if (loading) return <section className="pt-32 pb-20 text-center text-muted-foreground">Loading…</section>;
  if (!user) return <CurrentOrdersLoginGate />;
  if (!isStaff) return <Navigate to="/" replace />;

  async function changeStatus(o: AdminOrder, status: string) {
    try {
      await updateAdminOrder(o.orderNumber, { status });
      // Remove from queue immediately if status leaves the active set.
      setOrders((p) => p
        .map((x) => x.orderNumber === o.orderNumber ? { ...x, status, readyAt: status === "ready" && !x.readyAt ? new Date().toISOString() : x.readyAt } : x)
        .filter((x) => ACTIVE_STATUSES.has(x.status) && !!x.paidAt),
      );
      toast.success(`Order #${o.orderNumber} → ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Current Orders</h1>
            <p className="text-sm text-muted-foreground">Live kitchen queue · auto-refreshing every 5s.</p>
          </div>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-white/10 hover:border-white/30 text-muted-foreground hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-[color:var(--card)] border border-white/5 p-16 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-400" />
            <p className="mt-3 text-muted-foreground">All caught up — no pending orders.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((o) => {
              const elapsed = now - new Date(o.createdAt).getTime();
              const isNew = o.status === "new";
              return (
                <article
                  key={o.orderNumber}
                  className={`rounded-2xl border bg-[color:var(--card)] p-5 flex flex-col gap-4 ${isNew ? "border-[color:var(--flame)]/60" : "border-white/10"}`}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        #{o.orderNumber}
                        <button
                          onClick={() => setViewing(o)}
                          className="text-muted-foreground hover:text-[color:var(--flame-light)] transition-colors"
                          aria-label="View order details"
                          title="View full order"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-xs text-muted-foreground">{o.customerName} · {o.customerPhone}</div>
                      {o.pickupTime && <div className="text-xs mt-0.5"><span className="text-muted-foreground">Pickup:</span> {o.pickupTime}</div>}
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums px-2 py-1 rounded-md ${elapsed > 20 * 60 * 1000 ? "bg-red-500/20 text-red-300" : elapsed > 10 * 60 * 1000 ? "bg-amber-500/15 text-amber-300" : "bg-white/5 text-white"}`}>
                        <Clock className="h-3.5 w-3.5" /> {formatElapsed(elapsed)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{o.status}</div>
                    </div>
                  </header>

                  <ul className="text-sm divide-y divide-white/5 border-y border-white/5 -mx-1">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex justify-between px-1 py-1.5">
                        <span className="truncate"><span className="font-bold text-[color:var(--flame-light)]">{it.quantity}×</span> {it.productName}</span>
                      </li>
                    ))}
                  </ul>

                  {o.notes && <p className="text-xs italic text-muted-foreground">Note: {o.notes}</p>}

                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Change status
                    <select
                      value={o.status}
                      onChange={(e) => changeStatus(o, e.target.value)}
                      className="flex-1 bg-transparent border border-white/10 rounded text-sm px-2 py-1.5 cursor-pointer"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s} className="bg-[color:var(--card)]">{s}</option>
                      ))}
                    </select>
                  </label>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg bg-[color:var(--card)] border-white/10">
          <DialogHeader><DialogTitle>Order #{viewing?.orderNumber}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">{formatCA(viewing.createdAt)}</div>
              <div><span className="text-muted-foreground">Customer:</span> {viewing.customerName} · {viewing.customerPhone}</div>
              {viewing.pickupTime && <div><span className="text-muted-foreground">Pickup:</span> {viewing.pickupTime}</div>}
              <ul className="divide-y divide-white/5 border border-white/10 rounded-lg">
                {viewing.items.map((it, i) => (
                  <li key={i} className="flex justify-between px-3 py-2">
                    <span>{it.quantity} × {it.productName}</span>
                    <span className="text-muted-foreground">${it.lineTotal.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {(() => {
                const isDel = (viewing.diningOption as string) === "delivery";
                const delFee = isDel ? Number(viewing.deliveryFee || 0) : 0;
                const total = Math.round((Number(viewing.subtotal || 0) + delFee) * 100) / 100;
                return (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${Number(viewing.subtotal).toFixed(2)}</span></div>
                    {delFee > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>${delFee.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between font-bold text-base border-t border-white/10 pt-2">
                      <span>Total</span>
                      <span className="text-[color:var(--flame-light)]">${total.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
              <div className="text-xs">
                {viewing.paidAt
                  ? <span className="text-green-400">Paid via {viewing.paymentMethod ? PAY_LABEL[viewing.paymentMethod] : "COD"} on {formatCA(viewing.paidAt)}</span>
                  : <span className="text-muted-foreground">Unpaid (COD)</span>}
              </div>
              {viewing.notes && <p className="text-xs text-muted-foreground italic">Note: {viewing.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CurrentOrdersLoginGate() {
  const nav = useNavigate();
  return (
    <section className="pt-32 pb-20 text-center max-w-md mx-auto px-4">
      <h1 className="text-2xl font-bold">Sign in required</h1>
      <p className="text-sm text-muted-foreground mt-2">Please sign in with a staff account to view the kitchen queue.</p>
      <Link to="/" className="btn-flame mt-6 inline-flex">Go to home</Link>
      <LoginModal open onClose={() => nav("/")} />
    </section>
  );
}
