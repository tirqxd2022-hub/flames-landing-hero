import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { AddonGroup, AddonOption, Product as ProductT, Category as CategoryT } from "@/lib/mock-data";
import { fetchProduct, fetchCategories, fetchProductsByCategory, fetchAllProducts } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { HoverThumb } from "@/components/ui/hover-thumb";
import OptimizedImage from "@/components/OptimizedImage";
import OfferCards from "@/components/OfferCards";

type SizedSelection = { uid: string; groupId: string; groupName: string; optionId: string; sizeId: string; qty: number; name: string; sizeName: string; price: number; emoji?: string };

/** Pick a friendly emoji for an add-on option based on its name. Keeps the icons
 *  intact even when the backend doesn't store an explicit emoji field. */
const EMOJI_RULES: Array<[RegExp, string]> = [
  [/masala\s*chai|chai/i, "🍵"],
  [/coffee|latte|cappuccino|espresso/i, "☕"],
  [/plain\s*tea|green\s*tea|tea/i, "🍃"],
  [/strawberry/i, "🍓"],
  [/mango/i, "🥭"],
  [/banana/i, "🍌"],
  [/blueberry|berry/i, "🫐"],
  [/pineapple/i, "🍍"],
  [/orange/i, "🍊"],
  [/apple/i, "🍎"],
  [/lemon|lime/i, "🍋"],
  [/mint/i, "🌿"],
  [/chocolate|cocoa/i, "🍫"],
  [/vanilla/i, "🍦"],
  [/lassi|yogurt|yoghurt/i, "🥛"],
  [/milk/i, "🥛"],
  [/smoothie|shake|juice/i, "🥤"],
  [/water/i, "💧"],
  [/cola|coke|pepsi|soda|fizz/i, "🥤"],
];
function pickEmoji(option: { emoji?: string; name: string }): string {
  if (option.emoji) return option.emoji;
  for (const [re, e] of EMOJI_RULES) if (re.test(option.name)) return e;
  return "🥤";
}

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductT | null>(null);
  const [cats, setCats] = useState<CategoryT[]>([]);
  const [relatedAll, setRelatedAll] = useState<ProductT[]>([]);
  const [allProducts, setAllProducts] = useState<ProductT[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<number | null>(null);


  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setProduct(null);
    (async () => {
      try {
        const [p, cs] = await Promise.all([fetchProduct(slug), fetchCategories()]);
        setProduct(p ?? null);
        setCats(cs);
        if (p?.categorySlug) {
          fetchProductsByCategory(p.categorySlug).then(setRelatedAll).catch(() => setRelatedAll([]));
        }
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    fetchAllProducts().then(setAllProducts).catch(() => setAllProducts([]));
  }, []);

  // Look up a product image by addon-option name. Strips parenthetical/qualifier
  // text so "Mango (Small)" still matches a product called "Mango Smoothy" etc.
  const productImageByName = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const exact = new Map<string, string>();
    for (const p of allProducts) if (p.image) exact.set(norm(p.name), p.image);
    return (name: string): string => {
      const key = norm(name);
      if (!key) return "";
      if (exact.has(key)) return exact.get(key)!;
      // partial contains match (either direction)
      for (const [k, img] of exact) {
        if (k === key) continue;
        if (k.includes(key) || key.includes(k)) return img;
      }
      return "";
    };
  }, [allProducts]);


  // Non-sized selections (single radio / multi checkbox)
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  useEffect(() => {
    const s: Record<string, string | string[]> = {};
    product?.addons?.forEach((g) => {
      if (g.sized) return;
      if (g.type === "single") s[g.id] = g.required ? g.options[0].id : "";
      else s[g.id] = [];
    });
    setSelections(s);
    if (product?.productType === "variable" && product.variants?.length) {
      const base = product.variants.find((v) => v.isBase) || product.variants[0];
      setVariantId(base.id);
    } else {
      setVariantId(null);
    }
  }, [product]);

  // Sized selections — list of size+qty picks
  const [sized, setSized] = useState<SizedSelection[]>([]);
  // Modal state
  const [modal, setModal] = useState<{ group: AddonGroup; option: AddonOption } | null>(null);
  // (zoom is now in-place via transform; no modal state needed)



  const { add } = useCart();

  const sizedTotal = useMemo(() => sized.reduce((s, x) => s + x.price * x.qty, 0), [sized]);
  const nonSizedTotal = useMemo(() => {
    if (!product?.addons) return 0;
    let t = 0;
    for (const g of product.addons) {
      if (g.sized) continue;
      const sel = selections[g.id];
      if (g.type === "single") {
        const opt = g.options.find((o) => o.id === sel);
        if (opt) t += opt.price;
      } else if (Array.isArray(sel)) {
        for (const id of sel) {
          const opt = g.options.find((o) => o.id === id);
          if (opt) t += opt.price;
        }
      }
    }
    return t;
  }, [product, selections]);

  if (loading)
    return <section className="pt-40 pb-20 text-center text-muted-foreground">Loading…</section>;

  if (!product)
    return (
      <section className="pt-40 pb-20 text-center">
        <h1 className="text-3xl font-bold">Item not found</h1>
        <Link to="/menu" className="btn-flame mt-6 inline-flex">Back to menu</Link>
      </section>
    );

  const isVariable = product.productType === "variable" && (product.variants?.length ?? 0) > 0;
  const selectedVariant = isVariable ? product.variants!.find((v) => v.id === variantId) ?? null : null;
  const unitPrice = selectedVariant ? selectedVariant.price : product.price;
  const cat = cats.find((c) => c.slug === product.categorySlug);
  const related = relatedAll.filter((p) => p.slug !== product.slug).slice(0, 8);
  const baseUnit = unitPrice + nonSizedTotal;
  const grandTotal = baseUnit * qty + sizedTotal;


  const toggleMulti = (gid: string, oid: string) => {
    setSelections((s) => {
      const cur = (s[gid] as string[]) || [];
      return { ...s, [gid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
    });
  };

  const removeSized = (uid: string) => setSized((arr) => arr.filter((x) => x.uid !== uid));
  const updateSizedQty = (uid: string, q: number) =>
    setSized((arr) => arr.map((x) => (x.uid === uid ? { ...x, qty: Math.max(1, q) } : x)));

  const handleAddToCart = () => {
    // Build non-sized selection summary baked into main product variant
    const nonSizedSummary = product.addons
      ?.filter((g) => !g.sized)
      .map((g) => {
        const sel = selections[g.id];
        if (g.type === "single") {
          const o = g.options.find((x) => x.id === sel);
          return o ? `${g.name}: ${o.name}` : null;
        }
        const ids = Array.isArray(sel) ? sel : [];
        const names = g.options.filter((x) => ids.includes(x.id)).map((x) => x.name);
        return names.length ? `${g.name}: ${names.join(", ")}` : null;
      })
      .filter(Boolean)
      .join(" • ");

    const variantSuffix = selectedVariant ? `::v${selectedVariant.id}` : "";
    const variantSlug = nonSizedSummary
      ? `${product.slug}${variantSuffix}::${btoa(JSON.stringify(selections)).slice(0, 12)}`
      : `${product.slug}${variantSuffix}`;

    const displayName = [
      product.name,
      selectedVariant ? `— ${selectedVariant.name}` : null,
      nonSizedSummary ? `(${nonSizedSummary})` : null,
    ].filter(Boolean).join(" ");

    add(
      {
        ...product,
        slug: variantSlug,
        price: baseUnit,
        name: displayName,
      },

      qty
    );

    // Each sized add-on becomes its own cart line so the mini-cart lists them
    for (const s of sized) {
      const isSmoothie = /smooth/i.test(s.groupName);
      const displayName = isSmoothie && !/smooth/i.test(s.name)
        ? `${s.name} Smoothy (${s.sizeName})`
        : `${s.name} (${s.sizeName})`;
      const addonProduct: ProductT = {
        ...product,
        slug: `addon::${product.slug}::${s.uid}`,
        name: displayName,
        price: s.price,
        image: productImageByName(s.name) || "",
        addons: undefined,
      };
      add(addonProduct, s.qty);
    }

    toast.success(`${qty} × ${product.name} added to cart`);
    setSized([]);
  };

  return (
    <>
      <section className="relative h-[260px] sm:h-[340px] overflow-hidden">
        <OptimizedImage
          src={cat?.heroImage || cat?.image || ""}
          alt={cat ? `${cat.name} banner` : ""}
          width={1600}
          height={520}
          priority
          sizes="100vw"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
          {cat && (
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--flame-light)] mb-2">
              {cat.name}
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-bold text-white drop-shadow-lg">{product.name}</h1>
        </div>
      </section>

      <section className="pt-12 pb-16 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs text-muted-foreground mb-6">
            <Link to="/menu" className="hover:text-white">Menu</Link>
            {cat && <> / <Link to={`/category/${cat.slug}`} className="hover:text-white">{cat.name}</Link></>}
            {" / "}<span className="text-white">{product.name}</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-10">
            <div
              className="group relative rounded-sm overflow-hidden bg-[color:var(--card)] aspect-square cursor-zoom-in touch-none select-none"
              onMouseMove={(e) => {
                const t = e.currentTarget;
                const r = t.getBoundingClientRect();
                const x = ((e.clientX - r.left) / r.width) * 100;
                const y = ((e.clientY - r.top) / r.height) * 100;
                t.style.setProperty("--zx", `${x}%`);
                t.style.setProperty("--zy", `${y}%`);
              }}
              onTouchStart={(e) => {
                const t = e.currentTarget;
                const touch = e.touches[0];
                if (!touch) return;
                const r = t.getBoundingClientRect();
                const x = ((touch.clientX - r.left) / r.width) * 100;
                const y = ((touch.clientY - r.top) / r.height) * 100;
                t.style.setProperty("--zx", `${x}%`);
                t.style.setProperty("--zy", `${y}%`);
                t.classList.add("is-zoomed");
              }}
              onTouchMove={(e) => {
                const t = e.currentTarget;
                const touch = e.touches[0];
                if (!touch) return;
                e.preventDefault();
                const r = t.getBoundingClientRect();
                const x = Math.max(0, Math.min(100, ((touch.clientX - r.left) / r.width) * 100));
                const y = Math.max(0, Math.min(100, ((touch.clientY - r.top) / r.height) * 100));
                t.style.setProperty("--zx", `${x}%`);
                t.style.setProperty("--zy", `${y}%`);
              }}
              onTouchEnd={(e) => {
                e.currentTarget.classList.remove("is-zoomed");
              }}
            >
              <OptimizedImage
                src={product.image}
                alt={product.name}
                width={800}
                height={800}
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-[2.2] group-[.is-zoomed]:scale-[2.2]"
                style={{ transformOrigin: "var(--zx, 50%) var(--zy, 50%)" }}
              />
              <span className="absolute bottom-3 right-3 text-[10px] uppercase tracking-widest bg-black/70 text-white px-2.5 py-1 opacity-80 group-hover:opacity-0 group-[.is-zoomed]:opacity-0 transition pointer-events-none rounded">
                <span className="hidden md:inline">Hover to zoom</span>
                <span className="md:hidden">Tap & hold to zoom</span>
              </span>
            </div>

            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">{product.name}</h2>
              <p className="mt-3 text-muted-foreground">{product.description}</p>
              <div className="mt-4 text-2xl font-bold text-[color:var(--gold)]">
                ${unitPrice.toFixed(2)}
                {isVariable && !selectedVariant && <span className="text-muted-foreground text-base font-normal"> onwards</span>}
              </div>

              {isVariable && (
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {product.variants!.map((v) => {
                    const active = variantId === v.id;
                    return (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-2 select-none"
                      >
                        <input
                          id={`variant-${v.id}`}
                          type="radio"
                          name="product-variant"
                          checked={active}
                          onChange={() => setVariantId(v.id)}
                          className="h-4 w-4 accent-[color:var(--flame)] cursor-pointer"
                        />
                        <label
                          htmlFor={`variant-${v.id}`}
                          className={
                            "text-sm cursor-pointer " +
                            (active
                              ? "font-bold text-[color:var(--flame)]"
                              : "text-white/90")
                          }
                        >
                          {v.name} — ${v.price.toFixed(2)}
                        </label>
                      </span>

                    );
                  })}
                </div>

              )}


              {product.addons && product.addons.length > 0 && (
                <div className="mt-6 space-y-6">
                  {product.addons.map((g) => (
                    <div key={g.id}>
                      <div className="text-sm font-extrabold tracking-widest uppercase text-[color:var(--flame)]">
                        {g.name}
                        {g.required && <span className="text-[color:var(--flame)] ml-1">*</span>}
                      </div>

                      {g.sized ? (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                          {g.options.map((o) => {
                            const min = Math.min(...(o.sizes?.map((s) => s.price) ?? [0]));
                            const img = productImageByName(o.name);
                            return (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => setModal({ group: g, option: o })}
                                className="group rounded-lg border border-white/10 bg-white/[0.03] hover:border-[color:var(--flame)] hover:bg-white/[0.06] transition p-3 text-left flex items-center gap-3"
                              >
                                {img ? (
                                  <OptimizedImage src={img} alt={o.name} width={48} height={48} className="h-12 w-12 rounded-md object-cover flex-shrink-0 bg-white/5" />
                                ) : (
                                  <span className="h-12 w-12 rounded-md bg-white/5 flex-shrink-0 grid place-items-center text-2xl">{pickEmoji(o)}</span>
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-bold uppercase text-white leading-tight">{o.name}</div>
                                  <div className="text-[11px] text-[color:var(--flame-light)] font-semibold">
                                    ${min.toFixed(2)} Onwards
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                          {g.options.map((o) => {
                            const isSel =
                              g.type === "single"
                                ? selections[g.id] === o.id
                                : Array.isArray(selections[g.id]) && (selections[g.id] as string[]).includes(o.id);
                            return (
                              <label key={o.id} className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                                <input
                                  type={g.type === "single" ? "radio" : "checkbox"}
                                  name={g.id}
                                  checked={isSel}
                                  onChange={() =>
                                    g.type === "single"
                                      ? setSelections((s) => ({ ...s, [g.id]: o.id }))
                                      : toggleMulti(g.id, o.id)
                                  }
                                  className="accent-[color:var(--flame)]"
                                />
                                <span className="text-white/90">
                                  {o.name}
                                  {o.price > 0 && <span className="text-muted-foreground"> + ${o.price.toFixed(2)}</span>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center gap-6">
                <div className="text-xs font-bold tracking-widest uppercase text-white">Quantity</div>
                <div className="inline-flex items-center rounded-full bg-[color:var(--card)] border border-white/10">
                  <button className="h-10 w-10 grid place-items-center text-[color:var(--flame)]" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="decrease">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center font-semibold">{qty}</span>
                  <button className="h-10 w-10 grid place-items-center text-[color:var(--flame)]" onClick={() => setQty((q) => q + 1)} aria-label="increase">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <button
                  id="add-to-cart"
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white font-bold uppercase text-sm shadow-lg shadow-black/30 transition"
                  onClick={handleAddToCart}
                >
                  Add to Cart
                </button>
                <div className="text-sm text-muted-foreground">
                  Total: <span className="text-white font-semibold">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Price breakup */}
              <div className="mt-6 rounded-lg border border-white/10 overflow-hidden">
                <div className="px-4 py-2 bg-white/[0.04] text-[11px] font-bold uppercase tracking-widest text-[color:var(--gold)]">
                  Price Breakup
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-t border-white/5">
                      <td className="px-4 py-2 text-white">
                        <div>{product.name}</div>
                        {(() => {
                          const summary = product.addons
                            ?.filter((g) => !g.sized)
                            .map((g) => {
                              const sel = selections[g.id];
                              if (g.type === "single") {
                                const o = g.options.find((x) => x.id === sel);
                                return o ? `${g.name}: ${o.name}` : null;
                              }
                              const ids = Array.isArray(sel) ? sel : [];
                              const names = g.options.filter((x) => ids.includes(x.id)).map((x) => x.name);
                              return names.length ? `${g.name}: ${names.join(", ")}` : null;
                            })
                            .filter(Boolean)
                            .join(" • ");
                          return summary ? <div className="text-xs text-muted-foreground">({summary})</div> : null;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-center text-muted-foreground w-20">× {qty}</td>
                      <td className="px-4 py-2 text-right text-white w-28">${(baseUnit * qty).toFixed(2)}</td>
                      <td className="w-10" />
                    </tr>
                    {sized.map((s) => {
                      const sImg = productImageByName(s.name);
                      return (
                      <tr key={s.uid} className="border-t border-white/5">
                        <td className="px-4 py-2 text-white">
                          <div className="flex items-center gap-2">
                            {sImg ? (
                              <OptimizedImage src={sImg} alt={s.name} width={32} height={32} className="h-8 w-8 rounded object-cover bg-black/40" />
                            ) : (
                              <span className="h-8 w-8 rounded bg-white/5 grid place-items-center text-base">{s.emoji}</span>
                            )}
                            <span>{s.name}{" "}<span className="text-muted-foreground">— {s.sizeName}</span></span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="inline-flex items-center rounded-md border border-white/10">
                            <button className="h-7 w-7 grid place-items-center text-[color:var(--flame)]" onClick={() => updateSizedQty(s.uid, s.qty - 1)}><Minus className="h-3 w-3" /></button>
                            <span className="w-6 text-center text-xs">{s.qty}</span>
                            <button className="h-7 w-7 grid place-items-center text-[color:var(--flame)]" onClick={() => updateSizedQty(s.uid, s.qty + 1)}><Plus className="h-3 w-3" /></button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-white">${(s.price * s.qty).toFixed(2)}</td>
                        <td className="px-2">
                          <button onClick={() => removeSized(s.uid)} className="h-7 w-7 grid place-items-center text-muted-foreground hover:text-red-400" aria-label="remove">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );})}
                    <tr className="border-t border-white/10 bg-white/[0.03]">
                      <td className="px-4 py-2 font-bold text-white" colSpan={2}>Total</td>
                      <td className="px-4 py-2 text-right font-bold text-[color:var(--flame-light)]">${grandTotal.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground italic">
                Applicable taxes will be calculated on the checkout page.
              </p>

              <OfferCards
                className="mt-6"
                title="Offers with this item"
                variant="product"
                product={{
                  id: product.slug,
                  slug: product.slug,
                  name: product.name,
                  categorySlug: product.categorySlug,
                  subcategorySlug: product.subcategorySlug,
                  variantIds: product.variants?.map((v) => v.id),
                }}
              />


              {/* Optional nutrition facts — only renders when the admin has
                  filled in at least one row in the product editor. */}
              {product.nutrition && Array.isArray(product.nutrition.rows) && product.nutrition.rows.length > 0 && (
                <div className="mt-6 rounded-lg border border-white/10 overflow-hidden max-w-md">
                  <div className="px-4 py-2 bg-white/[0.04] text-[11px] font-bold uppercase tracking-widest text-[color:var(--gold)]">
                    Nutrition Facts
                  </div>
                  {product.nutrition.serving_size && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t border-white/5">
                      Serving size: <span className="text-white">{product.nutrition.serving_size}</span>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <tbody>
                      {product.nutrition.rows.map((r, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="px-4 py-2 text-white/90">{r.label}</td>
                          <td className="px-4 py-2 text-right text-white">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>

          {related.length > 0 && (
            <div className="mt-20">
              <h3 className="text-2xl font-bold mb-6">Related Items</h3>
              <Carousel opts={{ align: "start", loop: true }} className="relative">
                <CarouselContent className="-ml-4">
                  {related.map((p) => (
                    <CarouselItem key={p.slug} className="pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                      <article className="flex flex-col">
                        <Link to={`/product/${p.slug}`} className="block aspect-square overflow-hidden bg-[color:var(--card)]">
                          <OptimizedImage src={p.image} alt={p.name} width={400} height={400} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" className="w-full h-full object-cover hover:scale-105 transition" />
                        </Link>
                        <Link to={`/product/${p.slug}`} className="mt-3 text-sm font-semibold text-white hover:text-[color:var(--flame-light)]">
                          {p.name}
                        </Link>
                        <div className="mt-1 text-[color:var(--flame-light)] text-sm font-bold">${p.price.toFixed(2)}</div>
                      </article>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="-left-4" />
                <CarouselNext className="-right-4" />
              </Carousel>
            </div>
          )}
        </div>
      </section>

      {/* Size + Qty modal */}
      <SizeModal
        modal={modal}
        onClose={() => setModal(null)}
        onAdd={(sizeId, q) => {
          if (!modal) return;
          const sz = modal.option.sizes?.find((s) => s.id === sizeId);
          if (!sz) return;
          setSized((arr) => [
            ...arr,
            {
              uid: `${modal.option.id}-${sizeId}-${Date.now()}`,
              groupId: modal.group.id,
              groupName: modal.group.name,
              optionId: modal.option.id,
              sizeId,
              qty: q,
              name: modal.option.name,
              sizeName: sz.name,
              price: sz.price,
              emoji: pickEmoji(modal.option),
            },
          ]);
          setModal(null);
        }}
      />

    </>
  );
}

function SizeModal({
  modal,
  onClose,
  onAdd,
}: {
  modal: { group: AddonGroup; option: AddonOption } | null;
  onClose: () => void;
  onAdd: (sizeId: string, qty: number) => void;
}) {
  const [sizeId, setSizeId] = useState<string>("");
  const [q, setQ] = useState(1);

  // Reset when modal target changes
  useEffect(() => {
    setSizeId(modal?.option.sizes?.[0]?.id ?? "");
    setQ(1);
  }, [modal?.option.id]);

  const sz = modal?.option.sizes?.find((s) => s.id === sizeId);

  return (
    <Dialog open={!!modal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm bg-[color:var(--card)] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl">{modal?.option.emoji}</span>
            <span>{modal?.option.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs font-bold uppercase tracking-widest text-[color:var(--gold)]">Choose size</div>
        <div className="grid grid-cols-3 gap-2">
          {modal?.option.sizes?.map((s) => {
            const active = sizeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSizeId(s.id)}
                className={
                  "rounded-md py-2 text-center border transition " +
                  (active
                    ? "bg-[color:var(--flame)] border-[color:var(--flame)] text-white"
                    : "border-white/15 text-white/90 hover:border-[color:var(--flame)]")
                }
              >
                <div className="text-[11px] font-bold uppercase">{s.name}</div>
                <div className="text-sm font-bold">${s.price.toFixed(2)}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-widest text-white">Quantity</div>
          <div className="inline-flex items-center rounded-full bg-black/40 border border-white/10">
            <button className="h-9 w-9 grid place-items-center text-[color:var(--flame)]" onClick={() => setQ((v) => Math.max(1, v - 1))}><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-8 text-center text-sm">{q}</span>
            <button className="h-9 w-9 grid place-items-center text-[color:var(--flame)]" onClick={() => setQ((v) => v + 1)}><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <button
          disabled={!sz}
          onClick={() => sz && onAdd(sizeId, q)}
          className="mt-3 w-full inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white font-bold uppercase text-sm disabled:opacity-60"
        >
          Add ${sz ? (sz.price * q).toFixed(2) : "0.00"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
