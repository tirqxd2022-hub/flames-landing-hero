import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { fetchAllProducts } from "@/lib/api";
import type { Product } from "@/lib/mock-data";
import OptimizedImage from "@/components/OptimizedImage";
import { splitProductName } from "@/lib/utils";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setQ(params.get("q") ?? ""); }, [params]);

  useEffect(() => {
    setLoading(true);
    fetchAllProducts()
      .then((rows) => setItems(rows))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { document.title = q ? `Search: ${q} — Flames Gourmet` : "Search — Flames Gourmet"; }, [q]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return items.filter((p) =>
      p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term)
    );
  }, [q, items]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParams(q.trim() ? { q: q.trim() } : {});
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6">Search</h1>

      <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-xl bg-[color:var(--card)] border border-white/10 px-4 py-3 shadow-2xl shadow-black/30">
        <SearchIcon className="h-5 w-5 text-[color:var(--flame-light)]" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          className="flex-1 bg-transparent text-base text-white placeholder:text-muted-foreground outline-none"
        />
        <button type="submit" className="px-4 py-1.5 rounded-md bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white text-sm font-bold uppercase tracking-wider transition">
          Search
        </button>
      </form>

      <div className="mt-8">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : !q.trim() ? (
          <div className="py-16 text-center text-muted-foreground">Enter a term above to search our menu and shop.</div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No results found for “{q}”.</div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-4">
              {results.length} result{results.length === 1 ? "" : "s"} for “<span className="text-white font-semibold">{q}</span>”
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((p) => {
                const { title, addons } = splitProductName(p.name);
                return (
                  <li key={p.slug}>
                    <Link
                      to={`/product/${p.slug}`}
                      className="group flex items-start gap-3 p-3 rounded-xl bg-[color:var(--card)] border border-white/10 hover:border-[color:var(--flame)] transition h-full"
                    >
                      {p.image ? (
                        <OptimizedImage src={p.image} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-md object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-[72px] w-[72px] rounded-md bg-white/5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white group-hover:text-[color:var(--flame-light)] truncate">{title}</div>
                        {addons && <div className="text-[11px] text-muted-foreground truncate">({addons})</div>}
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                        )}
                        <div className="text-xs font-bold text-[color:var(--flame-light)] mt-1">${p.price.toFixed(2)}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
