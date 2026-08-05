import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { fetchActiveOffers, fetchProduct, type Offer } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

function describeOffer(o: Offer): string {
  const c = (o.config || {}) as Record<string, unknown>;
  switch (o.type) {
    case "cart_percent": {
      const min = Number(c.minSubtotal || 0);
      return `${c.percent}% off${min ? ` over $${min}` : ""}`;
    }
    case "cart_amount": {
      const min = Number(c.minSubtotal || 0);
      return `$${Number(c.amount || 0).toFixed(2)} off${min ? ` over $${min}` : ""}`;
    }
    case "bogo": {
      const pct = Number(c.discountPercent ?? 100);
      return pct >= 100 ? "Buy 1 Get 1 Free" : `Buy 1 Get 1 ${pct}% off`;
    }
    case "buy_x_get_y": {
      const price = Number(c.rewardPrice || 0);
      const name = (c.rewardProductName as string) || "reward item";
      return price > 0 ? `Add ${name} for $${price.toFixed(2)}` : `Free ${name}`;
    }
    default:
      return "";
  }
}

function firstRewardSlug(o: Offer): string | null {
  const c = (o.config || {}) as Record<string, unknown>;
  const slugs = Array.isArray(c.rewardSlugs) ? (c.rewardSlugs as string[]) : null;
  if (slugs && slugs.length > 0) return slugs[0];
  if (typeof c.rewardProductSlug === "string") return c.rewardProductSlug;
  return null;
}

type ProductCtx = {
  id: number | string;
  slug: string;
  name?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  variantIds?: Array<number | string>;
};

type OfferRole = "reward" | "qualifies" | "cartwide";

function relevanceFor(o: Offer, p: ProductCtx): OfferRole | null {
  const c = (o.config || {}) as Record<string, unknown>;
  // Reward match (buy_x_get_y where this product is the reward)
  const rewardSlugs: string[] = Array.isArray(c.rewardSlugs)
    ? (c.rewardSlugs as string[])
    : typeof c.rewardProductSlug === "string"
      ? [c.rewardProductSlug as string]
      : [];
  if (rewardSlugs.some((s) => s === p.slug || s.split("::v")[0] === p.slug)) {
    return "reward";
  }
  // Trigger match
  const triggerType = (c.triggerType as string) || "";
  const triggerIds = (Array.isArray(c.triggerIds) ? c.triggerIds : []).map(String);
  if (triggerType === "products" && triggerIds.length) {
    const variantTokens = (p.variantIds || []).map((v) => `${p.slug}::v${v}`);
    const candidates = [String(p.id), p.slug, ...variantTokens];
    if (triggerIds.some((t) => candidates.includes(t) || t.split("::v")[0] === p.slug)) {
      return "qualifies";
    }
  }
  if (triggerType === "categories" && triggerIds.length) {
    if (
      (p.categorySlug && triggerIds.includes(p.categorySlug)) ||
      (p.subcategorySlug && triggerIds.includes(p.subcategorySlug))
    ) {
      return "qualifies";
    }
  }
  // Cart-wide offers (no specific trigger) — surface for any product
  if (!triggerType || triggerIds.length === 0) {
    if (o.type === "cart_percent" || o.type === "cart_amount") return "cartwide";
  }
  return null;
}

type Props = {
  title?: string;
  className?: string;
  variant?: "generic" | "product";
  product?: ProductCtx;
};

export default function OfferCards({
  title = "Available Offers",
  className = "",
  variant = "generic",
  product,
}: Props) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const { add } = useCart();
  const nav = useNavigate();

  useEffect(() => {
    fetchActiveOffers().then(setOffers).catch(() => setOffers([]));
  }, []);

  const scored = useMemo(() => {
    if (variant !== "product" || !product) {
      return offers.slice(0, 6).map((o) => ({ offer: o, role: null as OfferRole | null }));
    }
    const matched: Array<{ offer: Offer; role: OfferRole }> = [];
    let cartwideAllowed = 1;
    for (const o of offers) {
      const role = relevanceFor(o, product);
      if (!role) continue;
      if (role === "cartwide") {
        if (cartwideAllowed <= 0) continue;
        cartwideAllowed -= 1;
      }
      matched.push({ offer: o, role });
    }
    // Sort: reward first, then qualifies, then cartwide
    const rank = { reward: 0, qualifies: 1, cartwide: 2 } as const;
    matched.sort((a, b) => rank[a.role] - rank[b.role]);
    return matched.slice(0, 6);
  }, [offers, variant, product]);

  if (scored.length === 0) return null;

  async function handleAdd(o: Offer) {
    const rewardSlug = firstRewardSlug(o);
    if (!rewardSlug) {
      nav("/offers");
      return;
    }
    const baseSlug = rewardSlug.split("::v")[0];
    const variantIdStr = rewardSlug.includes("::v") ? rewardSlug.split("::v")[1] : null;
    try {
      setBusy(o.id);
      const p = await fetchProduct(baseSlug);
      if (!p) { toast.error("Reward product unavailable"); return; }
      const isVariable = p.productType === "variable" && (p.variants?.length ?? 0) > 0;
      if (isVariable && !variantIdStr) {
        nav(`/product/${p.slug}`);
        return;
      }
      let price = p.price;
      let name = p.name;
      let slugOut = p.slug;
      if (isVariable && variantIdStr) {
        const v = p.variants!.find((x) => String(x.id) === variantIdStr);
        if (v) {
          price = v.price;
          name = `${p.name} — ${v.name}`;
          slugOut = `${p.slug}::v${v.id}`;
        }
      }
      add({ ...p, slug: slugOut, name, price, addons: undefined }, 1);
      toast.success(`${name} added to cart`);
    } catch {
      toast.error("Could not add reward");
    } finally {
      setBusy(null);
    }
  }

  const roleLabel: Record<OfferRole, string> = {
    reward: "Reward in this offer",
    qualifies: "Qualifies for this offer",
    cartwide: "Site-wide bonus",
  };
  const roleClass: Record<OfferRole, string> = {
    reward: "bg-[color:var(--flame)]/15 text-[color:var(--flame-light)] border-[color:var(--flame)]/30",
    qualifies: "bg-[color:var(--gold)]/10 text-[color:var(--gold)] border-[color:var(--gold)]/30",
    cartwide: "bg-white/5 text-white/80 border-white/10",
  };

  return (
    <div className={"rounded-2xl border border-white/5 bg-[color:var(--card)] p-4 " + className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[color:var(--gold)]">{title}</h3>
        <Link to="/offers" className="text-xs text-muted-foreground hover:text-white">See all</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {scored.map(({ offer: o, role }) => {
          const isProductMode = variant === "product" && !!role;
          const rewardSlug = firstRewardSlug(o);
          const rewardPrice = Number((o.config as Record<string, unknown>)?.rewardPrice || 0);
          // Decide action
          let action: React.ReactNode;
          if (isProductMode && role === "reward" && rewardSlug) {
            action = (
              <button
                type="button"
                disabled={busy === o.id}
                onClick={() => handleAdd(o)}
                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white disabled:opacity-60"
              >
                <Plus className="h-3 w-3" />
                {busy === o.id ? "Adding…" : rewardPrice > 0 ? `Add  $${rewardPrice.toFixed(2)}` : "Add free"}
              </button>
            );
          } else if (isProductMode && role === "qualifies") {
            action = (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("add-to-cart");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border border-[color:var(--flame)]/40 text-[color:var(--flame-light)] hover:bg-[color:var(--flame)]/10"
              >
                Add to unlock
              </button>
            );
          } else if (!isProductMode && o.type === "buy_x_get_y" && rewardSlug) {
            action = (
              <button
                type="button"
                disabled={busy === o.id}
                onClick={() => handleAdd(o)}
                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white disabled:opacity-60"
              >
                <Plus className="h-3 w-3" /> {busy === o.id ? "Adding…" : "Add"}
              </button>
            );
          } else {
            action = (
              <Link
                to="/offers"
                className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border border-white/15 text-white/90 hover:border-[color:var(--flame)]"
              >
                See details
              </Link>
            );
          }
          return (
            <article key={o.id} className="flex gap-3 rounded-xl border border-white/5 bg-black/30 p-2.5">
              {o.image_url ? (
                <OptimizedImage src={o.image_url} alt={o.name} width={80} height={80} className="h-16 w-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-[color:var(--flame)]/30 to-black grid place-items-center text-xl flex-shrink-0">🔥</div>
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="text-sm font-semibold text-white truncate">{o.name}</div>
                <div className="text-[11px] text-[color:var(--flame-light)] line-clamp-2">{describeOffer(o)}</div>
                {isProductMode && role && (
                  <div className="mt-1">
                    <span className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${roleClass[role]}`}>
                      {roleLabel[role]}
                    </span>
                  </div>
                )}
                <div className="mt-auto pt-1.5">{action}</div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
