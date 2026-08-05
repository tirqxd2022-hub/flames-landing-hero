import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { splitProductName } from "@/lib/utils";
import OptimizedImage from "@/components/OptimizedImage";
import SideDishesUpsell from "@/components/SideDishesUpsell";
import OfferCards from "@/components/OfferCards";
import { useOfferEvaluation, OfferAdjustmentList } from "@/lib/offers";

export default function Cart() {
  const { items, subtotal, setQty, remove } = useCart();
  const s = useSiteSettings() as Record<string, string>;
  const taxRate = parseFloat(s.tax_rate || s.gst_rate_percent || "0") || 0;
  const taxLabel = s.tax_label || (taxRate ? "GST/HST" : "");
  const offers = useOfferEvaluation(items);
  const discounted = Math.max(0, subtotal - offers.totalDiscount);
  const tax = Math.round(discounted * (taxRate / 100) * 100) / 100;
  const total = Math.round((discounted + tax) * 100) / 100;

  if (items.length === 0) {
    return (
      <section className="pt-32 pb-20 text-center max-w-md mx-auto px-4">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground mt-3">Browse the menu and add a few items to get started.</p>
        <Link to="/menu" className="btn-flame mt-6 inline-flex">Browse menu</Link>
      </section>
    );
  }

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-6">Your Cart</h1>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="min-w-0">
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.product.slug} className="flex items-start sm:items-center gap-3 sm:gap-4 bg-[color:var(--card)] border border-white/5 rounded-2xl p-3">
                {it.product.image ? (
                  <OptimizedImage src={it.product.image} alt={it.product.name} width={80} height={80} className="h-20 w-20 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-white/5 grid place-items-center text-3xl flex-shrink-0">🥤</div>
                )}
                <div className="flex-1 min-w-0">
                  {(() => { const { title, addons } = splitProductName(it.product.name); return (
                    <>
                      <div className="font-semibold truncate">{title}</div>
                      {addons && <div className="text-xs text-muted-foreground truncate">({addons})</div>}
                    </>
                  ); })()}
                  <div className="text-sm text-[color:var(--flame-light)]">${it.product.price.toFixed(2)}</div>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 flex-shrink-0">
                  <button onClick={() => remove(it.product.slug)} className="h-9 w-9 grid place-items-center text-muted-foreground hover:text-red-400 order-1 sm:order-2" aria-label="remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="inline-flex items-center rounded-full border border-white/10 order-2 sm:order-1">
                    <button className="h-9 w-9 grid place-items-center" onClick={() => setQty(it.product.slug, it.quantity - 1)} aria-label="decrease"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-8 text-center text-sm">{it.quantity}</span>
                    <button className="h-9 w-9 grid place-items-center" onClick={() => setQty(it.product.slug, it.quantity + 1)} aria-label="increase"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <OfferCards className="mt-4" title="Available Offers" />
          <SideDishesUpsell heading="Complete your meal with a side" />
        </div>



        <aside>
          <div className="bg-[color:var(--card)] border border-white/5 rounded-2xl p-5 sticky top-6">
            <h2 className="font-bold text-lg">Order summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <OfferAdjustmentList adjustments={offers.adjustments} hints={offers.hints} />
              {taxRate > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">{taxLabel} ({taxRate}%)</span><span>${tax.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-white/5 pt-3"><span>Total (COD)</span><span className="text-[color:var(--flame-light)]">${total.toFixed(2)}</span></div>
            </div>
            <Link to="/checkout" className="btn-flame w-full justify-center mt-5 inline-flex">
              Proceed to Checkout
            </Link>
            <Link to="/menu" className="block text-center text-xs text-muted-foreground hover:text-white mt-3">
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
