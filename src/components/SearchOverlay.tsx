import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { fetchAllProducts } from "@/lib/api";
import type { Product } from "@/lib/mock-data";
import OptimizedImage from "@/components/OptimizedImage";
import { splitProductName } from "@/lib/utils";
import { VirtualInput } from "@/components/VirtualInput";

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  function submit() {
    const term = q.trim();
    if (!term) return;
    onClose();
    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  useEffect(() => {
    if (!open) return;
    setQ("");
    if (items.length === 0) {
      setLoading(true);
      fetchAllProducts()
        .then((rows) => setItems(rows))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items.length, onClose]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return items
      .filter((p) => p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term))
      .slice(0, 12);
  }, [q, items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto mt-20 max-w-2xl px-4" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-xl bg-[color:var(--card)] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <Search className="h-5 w-5 text-[color:var(--flame-light)]" />
            <VirtualInput
              kind="text"
              value={q}
              onChange={setQ}
              placeholder="Search products… (press Enter)"
              padTitle="Search"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none border-0"
            />
            <button type="submit" className="hidden sm:inline-flex px-3 py-1 rounded-md bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white text-xs font-bold uppercase tracking-wider transition">Search</button>
            <button type="button" onClick={onClose} aria-label="Close search" className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </form>
          <div className="max-h-[60vh] overflow-auto flame-scroll">
            {!q.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {loading ? "Loading…" : "Start typing to search our menu and shop."}
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results for “{q}”.</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {results.map((p) => {
                  const { title, addons } = splitProductName(p.name);
                  return (
                    <li key={p.slug}>
                      <Link
                        to={`/product/${p.slug}`}
                        onClick={onClose}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5"
                      >
                        {p.image ? (
                          <OptimizedImage src={p.image} alt="" width={48} height={48} className="h-12 w-12 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-white/5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{title}</div>
                          {addons && <div className="text-[11px] text-muted-foreground truncate">({addons})</div>}
                        </div>
                        <div className="text-xs font-bold text-[color:var(--flame-light)] flex-shrink-0">${p.price.toFixed(2)}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
