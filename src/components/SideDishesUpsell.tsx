import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { fetchCategories, fetchProductsByCategory } from "@/lib/api";
import type { Category, Product } from "@/lib/mock-data";
import { useCart } from "@/lib/cart";
import OptimizedImage from "@/components/OptimizedImage";

/**
 * Upsell carousel for "side dishes" on Cart and Checkout pages.
 * - Desktop: 5 cards, drag enabled, arrows on both sides
 * - Tablet: 3 cards, swipe
 * - Mobile: 2 cards, swipe
 * - Infinite loop
 */
export default function SideDishesUpsell({ heading = "Add a side dish" }: { heading?: string }) {
  const { items, add } = useCart();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [byCat, setByCat] = useState<Record<string, Product[]>>({});

  useEffect(() => { fetchCategories().then(setCats).catch(() => setCats([])); }, []);

  const sideSlugs = useMemo(() => {
    if (!cats) return [];
    const bySlug = new Map(cats.map((c) => [c.slug, c]));
    const inCart = new Set(items.map((it) => it.product.categorySlug));
    const out = new Set<string>();
    for (const slug of inCart) {
      const side = bySlug.get(slug)?.sideCategorySlug;
      if (side) out.add(side);
    }
    return Array.from(out);
  }, [cats, items]);

  useEffect(() => {
    const missing = sideSlugs.filter((s) => !(s in byCat));
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map((s) =>
      fetchProductsByCategory(s)
        .then((ps) => [s, ps] as [string, Product[]])
        .catch(() => [s, [] as Product[]] as [string, Product[]])
    )).then((pairs) => {
      if (cancelled) return;
      setByCat((prev) => {
        const next = { ...prev };
        for (const [s, ps] of pairs) next[s] = ps;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [sideSlugs, byCat]);

  const cartSlugs = useMemo(() => new Set(items.map((it) => it.product.slug)), [items]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const pool: Product[] = [];
    for (const s of sideSlugs) {
      for (const p of byCat[s] || []) {
        if (cartSlugs.has(p.slug) || seen.has(p.slug)) continue;
        seen.add(p.slug);
        pool.push(p);
      }
    }
    // Only shuffle when products come from multiple side categories.
    if (sideSlugs.length > 1) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    return pool;
  }, [sideSlugs, byCat, cartSlugs]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    dragFree: false,
    watchDrag: true,
    containScroll: false,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (suggestions.length === 0) return null;

  return (
    <section className="mt-8 bg-[color:var(--card)] border border-white/5 rounded-2xl p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="font-bold text-lg">{heading}</h2>
        <p className="text-xs text-muted-foreground">Picked to go with what's in your cart.</p>
      </div>
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex -ml-3">
            {suggestions.map((p) => (
              <div
                key={p.slug}
                className="pl-3 shrink-0 grow-0 basis-1/2 md:basis-1/3 lg:basis-1/4"
              >
                <article className="bg-[color:var(--background)] border border-white/5 rounded-xl overflow-hidden flex flex-col h-full">
                  <div className="aspect-square bg-white/5">
                    {p.image ? (
                      <OptimizedImage src={p.image} alt={p.name} width={240} height={240} className="h-full w-full object-cover pointer-events-none" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-3xl">🍽️</div>
                    )}
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col">
                    <div className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm text-[color:var(--flame-light)] font-semibold">${p.price.toFixed(2)}</span>
                      <button
                        onClick={() => add(p, 1)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-[color:var(--flame)] text-white hover:opacity-90"
                        aria-label={`Add ${p.name} to cart`}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={scrollPrev}
          aria-label="Previous"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 h-9 w-9 grid place-items-center rounded-full bg-[color:var(--card)] border border-white/10 hover:bg-white/5 shadow-lg"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={scrollNext}
          aria-label="Next"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 h-9 w-9 grid place-items-center rounded-full bg-[color:var(--card)] border border-white/10 hover:bg-white/5 shadow-lg"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
