import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Truck, ExternalLink, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { fetchPublicOrder, type PublicOrder } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import { splitProductName } from "@/lib/utils";
import { formatCA } from "@/lib/datetime";
import DeliveryMap from "@/components/DeliveryMap";

const PAY_LABEL: Record<string, string> = { cash: "Cash", debit: "Debit Card", credit: "Credit Card" };
const STATUS_LABEL: Record<string, string> = {
  new: "New", preparing: "Preparing", ready: "Ready for Pickup",
  picked_up: "Picked Up", cancelled: "Cancelled",
};

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting courier",
  pickup: "Courier heading to store",
  pickup_complete: "Picked up — on the way",
  dropoff: "Arriving at your address",
  delivered: "Delivered",
  canceled: "Cancelled",
  returned: "Returned to store",
  failed: "Delivery failed",
};

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

export default function OrderDetails() {
  const { orderNumber = "" } = useParams<{ orderNumber: string }>();
  const s = useSiteSettings() as Record<string, string>;
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = (initial: boolean) => {
      if (initial) setLoading(true);
      fetchPublicOrder(orderNumber)
        .then((o) => { if (!cancelled) { setOrder(o); setError(null); } })
        .catch((e: Error) => { if (!cancelled && initial) setError(e.message || "Order not found"); })
        .finally(() => { if (!cancelled && initial) setLoading(false); });
    };
    load(true);
    // Poll every 20s so delivery status stays fresh without hammering the API.
    const id = setInterval(() => load(false), 20_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderNumber]);

  // Live geolocation push: while a delivery order is open on the customer's
  // device, stream coordinates to the server so the courier sees the exact
  // dropoff pin (rather than the geocoded street address). Stops automatically
  // once the order is delivered/cancelled or the page is closed.
  const isLiveDelivery = !!order
    && (order.diningOption as string) === "delivery"
    && !["picked_up", "cancelled"].includes(order.status as string);
  useEffect(() => {
    if (!isLiveDelivery || !orderNumber) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const post = (lat: number, lng: number, accuracy?: number) => {
      fetch(`${API_BASE_URL}/delivery/${encodeURIComponent(orderNumber)}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, accuracy }),
        keepalive: true,
      }).catch(() => {});
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => post(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isLiveDelivery, orderNumber]);

  // Once the courier has been dispatched and Uber has returned a live tracking
  // URL, redirect the customer to Uber's hosted tracking page (with the live
  // map, courier photo, ETA, etc.). Only fires once per browser session per
  // order so the customer can navigate back without being bounced again.
  const redirectedRef = useRef(false);
  useEffect(() => {
    const url = order?.delivery?.trackingUrl;
    const status = order?.delivery?.status;
    if (!url || redirectedRef.current) return;
    if (status && ["delivered", "canceled", "cancelled", "returned", "failed"].includes(status)) return;
    const key = `uber-tracking-redirected:${orderNumber}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;
    redirectedRef.current = true;
    try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    window.location.href = url;
  }, [order?.delivery?.trackingUrl, order?.delivery?.status, orderNumber]);




  const taxRate = parseFloat(s.gst_rate_percent || s.tax_rate || "0") || 0;
  const taxLabel = s.tax_label || (taxRate ? "GST/HST" : "Tax");
  const subtotal = order?.subtotal ?? 0;
  const discount = order?.discount ?? 0;
  const couponCode = order?.couponCode ?? null;
  const taxableBase = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableBase * (taxRate / 100) * 100) / 100;
  const isDelivery = (order?.diningOption as string) === "delivery";
  const deliveryFee = isDelivery
    ? (order?.delivery?.feeCents != null
        ? Number(order.delivery.feeCents) / 100
        : (order?.deliveryFee != null ? Number(order.deliveryFee) : 0))
    : 0;
  const packagingFee = isDelivery ? (parseFloat(s.delivery_packaging_fee || "0") || 0) : 0;
  const total = Math.round((taxableBase + tax + deliveryFee + packagingFee) * 100) / 100;

  return (
    <section className="pt-20 sm:pt-28 pb-16 px-3 sm:px-4 max-w-md sm:max-w-2xl mx-auto">
      {loading && (
        <div className="text-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      )}

      {!loading && error && (
        <div className="text-center py-16">
          <h1 className="text-xl sm:text-2xl font-bold">Order not found</h1>
          <p className="text-sm text-muted-foreground mt-2">This order may have been removed or the link is invalid.</p>
          <Link to="/" className="btn-flame mt-6 inline-flex">Back to home</Link>
        </div>
      )}

      {!loading && order && (
        <>
          <div className="text-center">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-[color:var(--flame)]/15 text-[color:var(--flame)] grid place-items-center mx-auto">
              <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h1 className="text-xl sm:text-3xl font-bold mt-3 break-all">Order #{order.orderNumber}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{formatCA(order.createdAt)}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] sm:text-xs uppercase tracking-wider bg-white/5 border border-white/10">
              {STATUS_LABEL[order.status] || order.status}
            </span>
          </div>

          <div className="mt-4 rounded-xl bg-[color:var(--card)] border border-white/5 p-4 space-y-1">
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Customer</div>
            <div className="font-medium text-sm sm:text-base">{order.customerName}</div>
            <a href={`tel:${order.customerPhone}`} className="text-xs sm:text-sm text-muted-foreground hover:text-white block">{order.customerPhone}</a>
            {order.pickupTime && <div className="text-xs sm:text-sm"><span className="text-muted-foreground">Pickup:</span> {order.pickupTime}</div>}
            
          </div>

          {(order.diningOption as string) === "delivery" && (
            <div className="mt-3 rounded-xl bg-[color:var(--card)] border border-[color:var(--flame)]/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-[color:var(--flame-light)]" />
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Delivery tracking</div>
              </div>
              {order.delivery ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{DELIVERY_STATUS_LABEL[order.delivery.status] || order.delivery.status}</span>
                    {order.delivery.dropoffEta && (
                      <span className="text-xs text-muted-foreground">ETA {formatCA(order.delivery.dropoffEta)}</span>
                    )}
                  </div>
                  {order.delivery.courierName && (
                    <div className="text-xs sm:text-sm flex items-center gap-2">
                      <span className="text-muted-foreground">Courier:</span>
                      <span>{order.delivery.courierName}</span>
                      {order.delivery.courierPhone && (
                        <a href={`tel:${order.delivery.courierPhone}`} className="inline-flex items-center gap-1 text-[color:var(--flame-light)] hover:underline">
                          <Phone className="h-3 w-3" />{order.delivery.courierPhone}
                        </a>
                      )}
                    </div>
                  )}
                  {order.delivery.trackingUrl && (
                    <a
                      href={order.delivery.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs sm:text-sm text-[color:var(--flame-light)] hover:underline"
                    >
                      Track live <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Courier will be dispatched shortly. Tracking details will appear here automatically.
                </div>
              )}
              {order.delivery?.deliveryId && (
                <div className="mt-2 text-[11px] sm:text-xs">
                  <span className="text-muted-foreground">Delivery ID:</span>{" "}
                  <span className="font-mono break-all">{order.delivery.deliveryId}</span>
                </div>
              )}
              {order.delivery?.trackingUrl && (
                <a
                  href={order.delivery.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-flame mt-3 w-full justify-center text-sm"
                >
                  <ExternalLink className="h-4 w-4" /> Open live tracking
                </a>
              )}
              <div className="mt-3">
                <DeliveryMap orderNumber={order.orderNumber} />
              </div>
            </div>
          )}


          <div className="mt-3 rounded-xl bg-[color:var(--card)] border border-white/5 p-4">
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mb-2">Items</div>
            <ul className="divide-y divide-white/5">
              {order.items.map((it, i) => {
                const { title, addons } = splitProductName(it.productName);
                return (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    {it.image ? (
                      <OptimizedImage src={it.image} alt={title} width={56} height={56} className="h-12 w-12 sm:h-14 sm:w-14 rounded-md object-cover bg-white/5 shrink-0" />
                    ) : (
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-md bg-white/5 grid place-items-center text-[10px] text-muted-foreground shrink-0">N/A</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-snug break-words whitespace-normal">{title}</div>
                      {addons && <div className="text-[11px] text-muted-foreground break-words whitespace-normal">({addons})</div>}
                      <div className="text-[11px] sm:text-xs text-muted-foreground">{it.quantity} × ${it.unitPrice.toFixed(2)}</div>
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">${it.lineTotal.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-3 rounded-xl bg-[color:var(--card)] border border-white/5 p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {couponCode && discount > 0 && (
              <div className="flex justify-between text-green-400"><span>Coupon ({couponCode})</span><span>−${discount.toFixed(2)}</span></div>
            )}
            {couponCode && discount === 0 && (
              <div className="flex justify-between text-green-400"><span>Coupon ({couponCode})</span><span>Free item</span></div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">{taxLabel} ({taxRate}%)</span><span>${tax.toFixed(2)}</span></div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>${deliveryFee.toFixed(2)}</span></div>
            )}
            {packagingFee > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Packaging</span><span>${packagingFee.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-white/10">
              <span>Total</span>
              <span className="text-[color:var(--flame-light)]">${total.toFixed(2)}</span>
            </div>
            {order.paymentMethod === "cash" && order.cashReceived != null && Number(order.cashReceived) > 0 && (
              <>
                <div className="flex justify-between pt-1"><span className="text-muted-foreground">Cash Received</span><span>${Number(order.cashReceived).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold"><span>Change</span><span className="text-[color:var(--flame-light)]">${Math.max(0, Number(order.cashReceived) - total).toFixed(2)}</span></div>
              </>
            )}
            <div className="pt-2 text-[11px] sm:text-xs">
              {order.paidAt
                ? <span className="text-green-400">● Paid via {order.paymentMethod ? PAY_LABEL[order.paymentMethod] : "COD"}</span>
                : <span className="text-muted-foreground">Unpaid (COD)</span>}
            </div>
            {order.readyAt && (() => {
              const ms = new Date(order.readyAt).getTime() - new Date(order.createdAt).getTime();
              const mins = Math.floor(ms / 60000);
              const secs = Math.floor((ms % 60000) / 1000);
              return (
                <div className="text-[11px] sm:text-xs text-[color:var(--gold)]">
                  ● Prepared in {mins}m {secs}s
                </div>
              );
            })()}
          </div>

          {order.notes && (
            <p className="mt-3 text-[11px] sm:text-xs text-muted-foreground italic text-center px-2">Note: {order.notes}</p>
          )}
        </>
      )}
    </section>
  );
}
