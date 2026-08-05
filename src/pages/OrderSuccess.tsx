import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";

export default function OrderSuccess() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const state = useLocation().state as { order?: { subtotal: number; discount?: number; couponCode?: string | null } } | null;
  const s = useSiteSettings() as Record<string, string>;
  const subtotal = state?.order?.subtotal ?? 0;
  const discount = state?.order?.discount ?? 0;
  const couponCode = state?.order?.couponCode ?? null;
  const taxRate = parseFloat(s.gst_rate_percent || "0") || 0;
  const taxLabel = taxRate ? "GST/HST" : "";
  const taxableBase = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableBase * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxableBase + tax) * 100) / 100;

  return (
    <section className="pt-32 pb-20 text-center max-w-md mx-auto px-4">
      <div className="h-16 w-16 rounded-full bg-[color:var(--flame)]/15 text-[color:var(--flame)] grid place-items-center mx-auto">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold mt-5">Order placed!</h1>
      <p className="text-muted-foreground mt-2">Show this order number at our counter to collect & pay (COD).</p>
      <div className="mt-6 rounded-2xl bg-[color:var(--card)] border border-white/5 p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Order number</div>
        <div className="text-3xl font-bold text-[color:var(--flame-light)] mt-1">#{orderNumber}</div>
        {state?.order && (
          <div className="text-sm text-muted-foreground mt-4 space-y-1 text-left max-w-xs mx-auto">
            <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {couponCode && discount > 0 && (
              <div className="flex justify-between text-green-400"><span>Coupon ({couponCode})</span><span>−${discount.toFixed(2)}</span></div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between"><span>{taxLabel} ({taxRate}%)</span><span>${tax.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-bold text-white border-t border-white/10 pt-1"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        )}
      </div>
      <Link to="/menu" className="btn-flame mt-8 inline-flex">Order something else</Link>
    </section>
  );
}
