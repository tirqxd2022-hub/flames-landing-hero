import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { categories as fallbackCategories, type Category } from "@/lib/mock-data";
import { fetchCategories, resolveAssetUrl } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";

const fireVideo = { url: "/uploads/fire.mp4" } as const;
const fireFallback = { url: resolveAssetUrl("/uploads/fire-fallback.jpg") } as const;

export default function Menu() {
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) setCategories(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only show categories that actually have active products. Until the
  // real list arrives, render nothing rather than the fake mock counts.
  const visible = loaded ? categories.filter((c) => (c.itemCount ?? 0) > 0) : [];

  return (
    <>
      <section className="relative pt-32 pb-16 overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={fireFallback.url}
        >
          <source src={fireVideo.url} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Our Menu</span>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-white">
            Browse by <span className="text-flame-gradient">Category</span>
          </h1>
          <p className="mt-3 text-white/80 max-w-xl mx-auto">
            Pick a category to explore our à-la-carte dishes. Add items from any item page and pick up from our counter.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((c) => (
            <Link key={c.slug} to={`/category/${c.slug}`} className="group relative rounded-2xl overflow-hidden aspect-[4/3] block">
              <OptimizedImage src={c.image} alt={c.name} width={600} height={450} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <div className="font-bold text-lg text-white">{c.name}</div>
                <p className="text-xs text-white/70 mt-1 line-clamp-2">{c.description}</p>
                <div className="mt-2 text-xs text-[color:var(--gold)]">
                  {c.itemCount} {c.itemCount === 1 ? "item" : "items"}
                </div>
              </div>
            </Link>
          ))}
          {loaded && visible.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-16">
              No categories available yet. Please check back soon.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
