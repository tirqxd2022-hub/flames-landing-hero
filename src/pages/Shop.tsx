import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchCategories, fetchProductsByCategory } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import type { Category as Cat, Product } from "@/lib/mock-data";

export default function Shop() {
  const [items, setItems] = useState<Product[]>([]);
  const [cat, setCat] = useState<Cat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCategories().then((cats) => cats.find((c) => c.slug === "packaged-food") ?? null).catch(() => null),
      fetchProductsByCategory("packaged-food").catch(() => []),
    ])
      .then(([c, prods]) => { setCat(c); setItems(prods); })
      .finally(() => setLoading(false));
  }, []);

  const heroSrc = cat?.heroImage || cat?.image;

  return (
    <>
      <section className="relative h-[340px] sm:h-[420px] overflow-hidden">
        {heroSrc && (
          <OptimizedImage src={heroSrc} alt={`${cat?.name || "Packaged Food"} hero`} width={1600} height={600} priority sizes="100vw" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Shop</span>
          <h1 className="mt-2 text-4xl sm:text-6xl font-bold text-white drop-shadow-lg">
            Home-made <span className="text-flame-gradient">Packaged Food</span>
          </h1>
          <p className="mt-3 text-white/85 max-w-xl mx-auto">
            Jarred pickles, jams, sauces and more — made fresh, sealed for the journey home.
          </p>
        </div>
      </section>

      <section className="section-pad bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground">No products available yet. Please check back soon.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10">
              {items.map((p) => (
                <article key={p.slug} className="flex flex-col">
                  <Link to={`/product/${p.slug}`} className="block aspect-square overflow-hidden bg-[color:var(--card)]">
                    <OptimizedImage src={p.image} alt={p.name} width={400} height={400} sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="w-full h-full object-cover hover:scale-105 transition" />
                  </Link>
                  <div className="mt-3">
                    <Link to={`/product/${p.slug}`} className="block text-sm font-semibold text-white hover:text-[color:var(--flame-light)]">
                      {p.name}
                    </Link>
                    <div className="mt-1 text-[color:var(--flame-light)] text-sm font-bold">${p.price.toFixed(2)}{p.productType === "variable" && <span className="text-muted-foreground font-normal text-xs"> onwards</span>}</div>
                    <Link to={`/product/${p.slug}`} className="mt-3 inline-block text-xs font-semibold uppercase tracking-wide bg-white text-neutral-900 px-3 py-2 rounded-sm hover:bg-[color:var(--flame)] hover:text-white transition">
                      View Product
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
