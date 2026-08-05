/**
 * Shared "view order" modal body.
 *
 * Used by both `src/pages/admin/Orders.tsx` and `src/pages/ViewOrders.tsx`
 * so the two surfaces show identical customer/order-type/items/totals/staff
 * information. Any change to what is shown for an order in the view modal
 * MUST happen here — do not fork this component per page.
 */
import type { AdminOrder, SiteSettings } from "@/lib/api";
import { splitProductName } from "@/lib/utils";
import { formatCA } from "@/lib/datetime";
import OptimizedImage from "@/components/OptimizedImage";
import { PAY_LABEL, computeOrderTotals, getOrderType, shouldShowStaff } from "@/lib/order-shared";

export default function OrderDetailsView({
  order,
  settings,
  productImages = {},
}: {
  order: AdminOrder;
  settings: SiteSettings;
  productImages?: Record<string, string>;
}) {
  const t = computeOrderTotals(order, settings);
  const type = getOrderType(order);
  const showStaff = shouldShowStaff(order);

  return (
    <div className="space-y-4 text-sm">
      <div className="text-xs text-muted-foreground">{formatCA(order.createdAt)}</div>

      <div className="rounded-lg border border-white/10 p-3 space-y-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Customer</div>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${type.cls}`}>
            {type.label}
          </span>
        </div>
        <div className="font-medium">{order.customerName}</div>
        <div className="text-xs">
          <span className="text-muted-foreground">Phone:</span>{" "}
          <a href={`tel:${order.customerPhone}`} className="hover:text-white">{order.customerPhone}</a>
        </div>
        {t.isDelivery && order.deliveryAddress && (
          <div className="text-xs"><span className="text-muted-foreground">Deliver to:</span> {order.deliveryAddress}</div>
        )}
        {t.isDelivery && order.deliveryInstructions && (
          <div className="text-xs text-muted-foreground italic">Instructions: {order.deliveryInstructions}</div>
        )}
        {t.isDelivery && (order.deliveryId || order.trackingUrl) && (
          <div className="mt-2 rounded-md border border-white/10 bg-white/5 p-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Courier {order.deliveryStatus ? `· ${order.deliveryStatus}` : ""}
            </div>
            {order.deliveryId && (
              <div className="text-xs break-all">
                <span className="text-muted-foreground">Delivery ID:</span> <span className="font-mono">{order.deliveryId}</span>
              </div>
            )}
            {order.trackingUrl && (
              <div className="text-xs">
                <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="underline hover:text-white break-all">
                  Track delivery →
                </a>
              </div>
            )}
          </div>
        )}
        {order.pickupTime && (
          <div className="text-xs"><span className="text-muted-foreground">Pickup:</span> {order.pickupTime}</div>
        )}
        {showStaff && (
          <div className="text-xs"><span className="text-muted-foreground">Punched by:</span> {order.staffUsername}</div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Items</div>
        <ul className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden">
          {order.items.map((it, i) => {
            const { title, addons } = splitProductName(it.productName);
            const baseName = title.split(/\s+[—–-]\s+/)[0].trim().toLowerCase();
            const img =
              it.image ||
              productImages[title.toLowerCase()] ||
              productImages[baseName] ||
              productImages[it.productName.toLowerCase()];
            return (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                {img ? (
                  <OptimizedImage src={img} alt={title} width={48} height={48} className="h-12 w-12 rounded-md object-cover bg-white/5" />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-white/5 grid place-items-center text-xs text-muted-foreground">N/A</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="break-words whitespace-normal">{title}</div>
                  {addons && <div className="text-[11px] text-muted-foreground break-words whitespace-normal">({addons})</div>}
                  <div className="text-xs text-muted-foreground">{it.quantity} × ${it.unitPrice.toFixed(2)}</div>
                </div>
                <span className="text-muted-foreground whitespace-nowrap">${it.lineTotal.toFixed(2)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-white/10 p-3 space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
        {order.couponCode && t.discount > 0 && (
          <div className="flex justify-between text-green-400"><span>Coupon ({order.couponCode})</span><span>−${t.discount.toFixed(2)}</span></div>
        )}
        {order.couponCode && t.discount === 0 && (
          <div className="flex justify-between text-green-400"><span>Coupon ({order.couponCode})</span><span>Free item</span></div>
        )}
        {t.taxRate > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">{t.taxLabel} ({t.taxRate}%)</span><span>${t.tax.toFixed(2)}</span></div>
        )}
        {t.deliveryFee > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>${t.deliveryFee.toFixed(2)}</span></div>
        )}
        {t.packagingFee > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Packaging</span><span>${t.packagingFee.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-bold text-base pt-1 border-t border-white/10">
          <span>Total</span>
          <span className="text-[color:var(--flame-light)]">${t.grand.toFixed(2)}</span>
        </div>
        {order.paymentMethod === "cash" && order.cashReceived != null && Number(order.cashReceived) > 0 && (
          <>
            <div className="flex justify-between pt-1"><span className="text-muted-foreground">Cash Received</span><span>${Number(order.cashReceived).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold"><span>Change</span><span className="text-[color:var(--flame-light)]">${Math.max(0, Number(order.cashReceived) - t.grand).toFixed(2)}</span></div>
          </>
        )}
      </div>

      <div className="text-xs">
        {order.paidAt
          ? <span className="text-green-400">● Paid via {order.paymentMethod ? PAY_LABEL[order.paymentMethod] : "COD"} on {formatCA(order.paidAt)}</span>
          : <span className="text-muted-foreground">Unpaid (COD)</span>}
      </div>
      {order.readyAt && (() => {
        const ms = new Date(order.readyAt).getTime() - new Date(order.createdAt).getTime();
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return (
          <div className="text-xs text-[color:var(--gold)]">
            ● Prepared in {mins}m {secs}s <span className="text-muted-foreground">(ready at {formatCA(order.readyAt)})</span>
          </div>
        );
      })()}
      {order.notes && <p className="text-xs text-muted-foreground italic">Note: {order.notes}</p>}
    </div>
  );
}
