import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchActiveOffers, type Offer } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeSchedule(o: Offer): string {
  const parts: string[] = [];
  if (o.starts_at || o.expires_at) {
    const a = o.starts_at ? new Date(o.starts_at).toLocaleDateString() : "now";
    const b = o.expires_at ? new Date(o.expires_at).toLocaleDateString() : "ongoing";
    parts.push(`${a} – ${b}`);
  }
  if (typeof o.days_of_week === "number" && o.days_of_week !== 127) {
    const days = DOW.filter((_, i) => (o.days_of_week! >> i) & 1).join(", ");
    if (days) parts.push(days);
  }
  if (o.time_from && o.time_to) parts.push(`${o.time_from}–${o.time_to}`);
  return parts.join(" · ");
}

function describeOffer(o: Offer): string {
  const c = o.config as Record<string, unknown>;
  switch (o.type) {
    case "cart_percent": {
      const min = Number(c.minSubtotal || 0);
      return `${c.percent}% off${min ? ` orders over $${Number(min).toFixed(0)}` : ""}`;
    }
    case "cart_amount": {
      const min = Number(c.minSubtotal || 0);
      return `$${Number(c.amount || 0).toFixed(2)} off${min ? ` orders over $${Number(min).toFixed(0)}` : ""}`;
    }
    case "bogo": {
      const pct = Number(c.discountPercent ?? 100);
      return pct >= 100 ? "Buy 1 Get 1 Free" : `Buy 1 Get 1 ${pct}% off`;
    }
    case "buy_x_get_y": {
      return `Add ${c.rewardProductName || "the reward item"} for $${Number(c.rewardPrice || 0).toFixed(2)} with any qualifying purchase`;
    }
    default: return "";
  }
}

export default function OffersPage() {
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveOffers().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-2">Today's Offers</h1>
        <p className="text-muted-foreground mb-8">Deals applied automatically at checkout — no code needed.</p>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">No active offers right now. Check back soon!</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((o) => (
              <article key={o.id} className="rounded-2xl overflow-hidden bg-[color:var(--card)] border border-white/5 flex flex-col">
                {o.image_url ? (
                  <OptimizedImage src={o.image_url} alt={o.name} width={600} height={360} className="w-full aspect-[5/3] object-cover" />
                ) : (
                  <div className="aspect-[5/3] bg-gradient-to-br from-[color:var(--flame)]/30 to-black grid place-items-center text-3xl">🔥</div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <h2 className="font-bold text-lg">{o.name}</h2>
                  <p className="text-sm text-[color:var(--flame-light)] mt-1">{describeOffer(o)}</p>
                  {o.description && <p className="text-sm text-muted-foreground mt-2">{o.description}</p>}
                  <div className="text-xs text-muted-foreground mt-3">{describeSchedule(o)}</div>
                  <div className="mt-4">
                    <Link to="/menu" className="btn-flame inline-flex text-sm">Shop now</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
