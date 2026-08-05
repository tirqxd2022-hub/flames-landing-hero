import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/lib/cart";
import { placeOrder, quoteDelivery } from "@/lib/api";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { splitProductName } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";
import { CouponInput, type AppliedCoupon } from "@/components/CouponInput";
import SideDishesUpsell from "@/components/SideDishesUpsell";
import OfferCards from "@/components/OfferCards";
import { useOfferEvaluation, OfferAdjustmentList } from "@/lib/offers";
import { toast } from "sonner";
import AddressAutocomplete, { type AddressPick } from "@/components/AddressAutocomplete";

type Mode = "to_go" | "delivery";

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const s = useSiteSettings() as Record<string, string>;
  const taxRate = parseFloat(s.tax_rate || s.gst_rate_percent || "0") || 0;
  const taxLabel = taxRate ? "GST/HST" : "";
  const offers = useOfferEvaluation(items);
  const offersDiscount = offers.totalDiscount;
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [mode, setMode] = useState<Mode>("to_go");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [deliveryPick, setDeliveryPick] = useState<AddressPick | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoted, setQuoted] = useState(false);
  const subtotalAfterOffers = Math.max(0, subtotal - offersDiscount);
  const couponDiscount = coupon ? Math.min(coupon.discount, subtotalAfterOffers) : 0;
  const taxableBase = Math.max(0, subtotalAfterOffers - couponDiscount);
  const tax = Math.round(taxableBase * (taxRate / 100) * 100) / 100;
  const packagingFee = mode === "delivery" ? (parseFloat(s.delivery_packaging_fee || "0") || 0) : 0;
  const total = Math.round((taxableBase + tax + (mode === "delivery" ? deliveryFee : 0) + packagingFee) * 100) / 100;
  const discount = couponDiscount;
  const nav = useNavigate();
  const [form, setForm] = useState({ customerName: "", customerPhone: "", pickupTime: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <section className="pt-32 pb-20 text-center max-w-md mx-auto px-4">
        <h1 className="text-3xl font-bold">Nothing to checkout</h1>
        <p className="text-muted-foreground mt-3">Add a few items to your cart first.</p>
        <Link to="/menu" className="btn-flame mt-6 inline-flex">Browse menu</Link>
      </section>
    );
  }

  async function handleQuote() {
    const addr = deliveryAddress.trim();
    if (!addr) { toast.error("Enter your delivery address first."); return; }
    setQuoting(true);
    try {
      const q = await quoteDelivery({
        address: addr,
        phone: form.customerPhone.trim(),
        name: form.customerName.trim(),
        orderValue: subtotalAfterOffers,
        lat: deliveryPick?.label === addr ? deliveryPick.lat : undefined,
        lng: deliveryPick?.label === addr ? deliveryPick.lng : undefined,
      });
      setDeliveryFee(Math.round((q.fee_cents || 0)) / 100);
      setQuoted(true);
      toast.success(`Delivery fee: $${((q.fee_cents || 0) / 100).toFixed(2)}`);
    } catch (err) {
      setQuoted(false);
      setDeliveryFee(0);
      toast.error(err instanceof Error ? err.message : "Could not get delivery quote");
    } finally {
      setQuoting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (mode === "delivery") {
      if (!deliveryAddress.trim()) { toast.error("Enter your delivery address."); return; }
      if (!quoted) { toast.error("Please get a delivery quote first."); return; }
    }
    setSubmitting(true);
    try {
      const order = await placeOrder({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        pickupTime: form.pickupTime || undefined,
        notes: form.notes || undefined,
        paymentMethod: "cash",
        paid: false,
        couponCode: coupon?.code,
        diningOption: mode,
        deliveryAddress: mode === "delivery" ? deliveryAddress.trim() : undefined,
        deliveryInstructions: mode === "delivery" ? deliveryInstructions.trim() || undefined : undefined,
        deliveryFee: mode === "delivery" ? deliveryFee : undefined,
        items: items.map((it) => ({
          productSlug: it.product.slug,
          quantity: it.quantity,
          name: it.product.name,
          unitPrice: it.product.price,
        })),
      });
      clear();
      toast.success(`Order ${order.orderNumber} placed. Pay cash on ${mode === "delivery" ? "delivery" : "pickup"}.`);
      nav(`/o/${encodeURIComponent(order.orderNumber)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-6">Checkout</h1>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="min-w-0">
          <form onSubmit={handleSubmit} className="bg-[color:var(--card)] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setMode("to_go"); setQuoted(false); setDeliveryFee(0); }}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${mode === "to_go" ? "border-[color:var(--flame-light)] text-white bg-[color:var(--flame-light)]/10" : "border-white/10 text-muted-foreground"}`}>
                Pickup
              </button>
              <button type="button" onClick={() => setMode("delivery")}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${mode === "delivery" ? "border-[color:var(--flame-light)] text-white bg-[color:var(--flame-light)]/10" : "border-white/10 text-muted-foreground"}`}>
                Delivery
              </button>
            </div>
            <h2 className="font-bold">{mode === "delivery" ? "Delivery details" : "Pickup details"}</h2>
            <p className="text-xs text-muted-foreground">Cash on {mode === "delivery" ? "delivery" : "pickup"} is enabled for testing.</p>
            <input maxLength={80} placeholder="Full name (optional)" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm" />
            <input maxLength={20} placeholder="Phone number (optional)" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm" />

            {mode === "delivery" ? (
              <>
                <AddressAutocomplete
                  value={deliveryAddress}
                  onChange={(v) => {
                    setDeliveryAddress(v);
                    setQuoted(false); setDeliveryFee(0);
                    if (deliveryPick && v !== deliveryPick.label) setDeliveryPick(null);
                  }}
                  onPick={(p) => { setDeliveryPick(p); setQuoted(false); setDeliveryFee(0); }}
                  placeholder="Start typing your delivery address…"
                  className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  maxLength={200}
                  placeholder="Delivery instructions (optional)"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleQuote}
                  disabled={quoting || !deliveryAddress.trim()}
                  className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-60"
                >
                  {quoting ? "Getting quote…" : quoted ? `Update quote (fee $${deliveryFee.toFixed(2)})` : "Get delivery quote"}
                </button>
              </>
            ) : (
              <label className="block">
                <span className="block text-xs text-muted-foreground mb-1">Pickup time</span>
                <TimePicker
                  value={form.pickupTime}
                  onChange={(v) => setForm({ ...form, pickupTime: v })}
                  placeholder="Select pickup time (optional)"
                />
              </label>
            )}
            <textarea maxLength={300} rows={2} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm" />
            <div className="rounded-lg border border-white/10 bg-background/40 p-3 text-xs text-muted-foreground mt-2">
              <div className="font-semibold text-white mb-1">Payment method</div>
              <label className="flex items-center gap-2">
                <input type="radio" name="pm" defaultChecked readOnly />
                <span>Cash on {mode === "delivery" ? "delivery" : "pickup"}</span>
              </label>
            </div>
            <button type="submit" disabled={submitting || (mode === "delivery" && !quoted)} className="btn-flame w-full justify-center mt-2 disabled:opacity-60">
              {submitting ? "Placing order…" : "Place order"}
            </button>
          </form>
          <SideDishesUpsell heading="Add a side before you go" />
        </div>


        <aside>
          <OfferCards className="mb-4" title="Available Offers" />
          <div className="bg-[color:var(--card)] border border-white/5 rounded-2xl p-5 sticky top-6">
            <h2 className="font-bold text-lg">Order summary</h2>
            <ul className="mt-4 space-y-2 text-sm max-h-80 overflow-auto pr-1">
              {items.map((it) => {
                const { title, addons } = splitProductName(it.product.name);
                return (
                  <li key={it.product.slug} className="flex justify-between gap-3">
                    <span className="text-white/90 min-w-0 flex-1">
                      <span className="block">{it.quantity} × {title}</span>
                      {addons && <span className="block text-[11px] text-muted-foreground">({addons})</span>}
                    </span>
                    <span className="text-white whitespace-nowrap">${(it.product.price * it.quantity).toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 pt-3 border-t border-white/5">
              <CouponInput
                subtotal={subtotalAfterOffers}
                customerPhone={form.customerPhone.trim() || undefined}
                applied={coupon}
                onApplied={setCoupon}
                onCleared={() => setCoupon(null)}
              />
            </div>
            <div className="mt-3 space-y-2 text-sm border-t border-white/5 pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <OfferAdjustmentList adjustments={offers.adjustments} hints={offers.hints} />
              {coupon && (
                <div className="flex justify-between text-green-400">
                  <span>Coupon ({coupon.code})</span>
                  <span>{coupon.freeItem ? `Free ${coupon.freeItem.name}` : `−$${discount.toFixed(2)}`}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">{taxLabel} ({taxRate}%)</span><span>${tax.toFixed(2)}</span></div>
              )}
              {mode === "delivery" && quoted && (
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>${deliveryFee.toFixed(2)}</span></div>
              )}
              {packagingFee > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Packaging</span><span>${packagingFee.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-[color:var(--flame-light)]">${total.toFixed(2)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
