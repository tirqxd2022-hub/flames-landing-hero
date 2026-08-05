import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { fetchCategories, fetchProductsByCategory } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import type { Category as Cat, Product } from "@/lib/mock-data";

type Sub = { slug: string; name: string; sort_order?: number };
type SortKey = "default" | "price-asc" | "price-desc" | "name-asc" | "rating-desc";
type DietFilter = "all" | "veg" | "nonveg";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [cat, setCat] = useState<Cat | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Controls
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [subFilter, setSubFilter] = useState<string>("all");

  useEffect(() => {
    if (!slug) return;
    setLoading(true); setNotFound(false);
    setQ(""); setSort("default"); setDiet("all"); setSubFilter("all");
    Promise.all([
      fetchCategories(),
      fetchProductsByCategory(slug),
      fetch(`${(import.meta.env.VITE_API_URL as string | undefined) || "/api"}/categories/${slug}/subcategories`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([cats, prods, subRows]) => {
        const found = cats.find((c) => c.slug === slug) || null;
        if (!found) setNotFound(true);
        setCat(found);
        setItems(prods);
        setSubs(Array.isArray(subRows) ? subRows : []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.slice();
    if (term) list = list.filter((p) => p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term));
    if (diet === "veg") list = list.filter((p) => p.isVeg);
    else if (diet === "nonveg") list = list.filter((p) => !p.isVeg);
    if (subFilter !== "all") list = list.filter((p) => p.subcategorySlug === subFilter);
    switch (sort) {
      case "price-asc": list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "name-asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "rating-desc": list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
    }
    return list;
  }, [items, q, diet, subFilter, sort]);

  if (loading) return <section className="pt-40 pb-20 text-center text-muted-foreground">Loading…</section>;
  if (notFound || !cat)
    return (
      <section className="pt-40 pb-20 text-center">
        <h1 className="text-3xl font-bold">Category not found</h1>
        <Link to="/menu" className="btn-flame mt-6 inline-flex">Back to menu</Link>
      </section>
    );

  const useGrouping = sort === "default" && subFilter === "all";
  const grouped: { key: string; title: string; items: Product[] }[] = [];
  if (useGrouping) {
    for (const sub of subs) {
      const subItems = filtered.filter((i) => i.subcategorySlug === sub.slug);
      if (subItems.length) grouped.push({ key: sub.slug, title: sub.name, items: subItems });
    }
    const ungrouped = filtered.filter((i) => !i.subcategorySlug);
    if (ungrouped.length) grouped.push({ key: "more", title: subs.length ? "More" : cat.name, items: ungrouped });
  } else {
    grouped.push({ key: "results", title: `${filtered.length} result${filtered.length === 1 ? "" : "s"}`, items: filtered });
  }

  const heroSrc = cat.heroImage || cat.image;
  const isUpcoming = cat.availability === "upcoming";
  const isUnavailable = cat.availability === "unavailable" || isUpcoming;
  const displayName = isUpcoming
    ? `${cat.name} (Coming Soon)`
    : cat.availability === "unavailable"
      ? `${cat.name} (Unavailable)`
      : cat.name;
  const unavailableMsg = isUpcoming ? "This item will be available soon." : "This item is currently unavailable.";

  return (
    <>
      <section className="relative h-[340px] sm:h-[420px] overflow-hidden">
        <OptimizedImage src={heroSrc} alt={`${displayName} hero`} width={1600} height={600} priority sizes="100vw" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative h-full flex items-center justify-center text-center px-4">
          <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg">{displayName}</h1>
        </div>
      </section>

      <section className="section-pad bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {/* Search / Sort / Filter controls */}
          <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-black/85 backdrop-blur supports-[backdrop-filter]:bg-black/70 border-b border-white/10 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--flame-light)]" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search in ${displayName}…`}
                className="w-full pl-9 pr-3 py-2.5 rounded-md bg-[color:var(--card)] border border-white/10 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-[color:var(--flame)]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {subs.length > 0 && (
                <select
                  value={subFilter}
                  onChange={(e) => setSubFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-md bg-[color:var(--card)] border border-white/10 text-sm text-white outline-none focus:border-[color:var(--flame)]"
                  aria-label="Filter by subcategory"
                >
                  <option value="all">All subcategories</option>
                  {subs.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.name}</option>
                  ))}
                </select>
              )}
              <select
                value={diet}
                onChange={(e) => setDiet(e.target.value as DietFilter)}
                className="px-3 py-2.5 rounded-md bg-[color:var(--card)] border border-white/10 text-sm text-white outline-none focus:border-[color:var(--flame)]"
                aria-label="Filter by diet"
              >
                <option value="all">Veg & Non-veg</option>
                <option value="veg">Veg only</option>
                <option value="nonveg">Non-veg only</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="px-3 py-2.5 rounded-md bg-[color:var(--card)] border border-white/10 text-sm text-white outline-none focus:border-[color:var(--flame)]"
                aria-label="Sort products"
              >
                <option value="default">Sort: Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A–Z</option>
                <option value="rating-desc">Rating: High to Low</option>
              </select>
            </div>
          </div>

          {isUnavailable && (
            <div className="rounded-md border border-[color:var(--flame)]/40 bg-[color:var(--flame)]/10 px-4 py-3 text-center text-sm sm:text-base text-[color:var(--flame-light)]">
              {isUpcoming
                ? "Items in this category will be available soon. Stay tuned!"
                : "Items in this category are currently unavailable. Please check back later."}
            </div>
          )}


          {grouped.length === 0 && (
            <p className="text-center text-muted-foreground">No items match your filters.</p>
          )}

          {grouped.map((group) => (
            <div key={group.key}>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wide text-[color:var(--flame)] uppercase mb-6">
                {group.title}
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10">
                {group.items.map((p) => (
                  <article
                    key={p.slug}
                    className={`flex flex-col group relative ${isUnavailable ? "opacity-50 pointer-events-none" : ""}`}
                    title={isUnavailable ? unavailableMsg : undefined}
                    aria-disabled={isUnavailable || undefined}
                  >
                    <Link to={`/product/${p.slug}`} className="block aspect-square overflow-hidden bg-[color:var(--card)]" tabIndex={isUnavailable ? -1 : undefined}>
                      <OptimizedImage src={p.image} alt={p.name} width={400} height={400} sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="w-full h-full object-cover hover:scale-105 transition" />
                    </Link>
                    <div className="mt-3">
                      <Link to={`/product/${p.slug}`} className="block text-sm font-semibold text-white hover:text-[color:var(--flame-light)]" tabIndex={isUnavailable ? -1 : undefined}>
                        {p.name}
                      </Link>
                      <div className="mt-1 text-[color:var(--flame-light)] text-sm font-bold">${p.price.toFixed(2)}{p.productType === "variable" && <span className="text-muted-foreground font-normal text-xs"> onwards</span>}</div>
                      <Link to={`/product/${p.slug}`} className="mt-3 inline-block text-xs font-semibold uppercase tracking-wide bg-white text-neutral-900 px-3 py-2 rounded-sm hover:bg-[color:var(--flame)] hover:text-white transition" tabIndex={isUnavailable ? -1 : undefined}>
                        Add to Cart
                      </Link>
                    </div>
                    {isUnavailable && (
                      <div className="pointer-events-none absolute inset-0 flex items-start justify-center opacity-0 group-hover:opacity-100 transition">
                        <span className="mt-3 px-3 py-1.5 rounded-md bg-black/85 text-white text-xs font-medium border border-white/15 shadow-lg">
                          {unavailableMsg}
                        </span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
