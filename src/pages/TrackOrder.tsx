import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { lookupOrder } from "@/lib/api";

export default function TrackOrder() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ orderNumber: "", name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);

  // If the URL already carries an order number, jump straight to the tracking view.
  useEffect(() => {
    const n = params.get("n") || params.get("order") || params.get("orderNumber");
    if (n) nav(`/o/${encodeURIComponent(n)}`, { replace: true });
  }, [params, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const anything = form.orderNumber || form.name || form.phone || form.address;
    if (!anything.trim()) { toast.error("Enter at least one detail to search."); return; }
    setLoading(true);
    try {
      const r = await lookupOrder({
        orderNumber: form.orderNumber.trim() || undefined,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      nav(`/o/${encodeURIComponent(r.orderNumber)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No matching order found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-full bg-[color:var(--flame)]/15 text-[color:var(--flame)] grid place-items-center mx-auto">
            <Truck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold mt-4">Track your order</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your order number, or any of the details you provided at checkout. We'll show your most recent active order.
          </p>
        </div>
        <form onSubmit={onSubmit} className="bg-[color:var(--card)] border border-white/5 rounded-2xl p-5 space-y-3">
          <input
            maxLength={64}
            placeholder="Order number (e.g. FG-1234)"
            value={form.orderNumber}
            onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
            className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm"
          />
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">or your billing details</div>
          <input
            maxLength={80}
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            maxLength={20}
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            maxLength={200}
            placeholder="Delivery address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm"
          />
          <button type="submit" disabled={loading} className="btn-flame w-full justify-center disabled:opacity-60">
            {loading ? "Searching…" : "Track order"}
          </button>
        </form>
      </div>
    </section>
  );
}
