import { useEffect, useRef, useState } from "react";

// Photon (photon.komoot.io) is a free, keyless OSM-based geocoder maintained
// by Komoot. No signup, no billing, no rate-limit key. We filter results to
// Canada client-side because Photon has no country-filter query param.

export type AddressPick = {
  label: string;
  lat: number;
  lng: number;
};

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
};

function formatFeature(f: Feature): string {
  const p = f.properties;
  const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
  return [line1, p.city, p.state, p.postcode, p.country].filter(Boolean).join(", ");
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
  className,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: AddressPick) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  const [suggestions, setSuggestions] = useState<Feature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!value || value.trim().length < 3) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=6&lang=en`;
        const r = await fetch(url, { signal: ac.signal });
        const data = await r.json();
        const feats = (data?.features || []).filter(
          (f: Feature) => (f.properties?.countrycode || "").toUpperCase() === "CA",
        );
        setSuggestions(feats);
        setOpen(true);
      } catch { /* aborted or network */ }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(f: Feature) {
    const label = formatFeature(f);
    const [lng, lat] = f.geometry.coordinates;
    onChange(label);
    onPick({ label, lat, lng });
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <textarea
        rows={rows}
        maxLength={500}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        className={className}
      />
      {open && (suggestions.length > 0 || loading) && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-[color:var(--background)] border border-white/10 rounded-lg shadow-lg max-h-64 overflow-auto text-sm">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">Searching…</li>
          )}
          {suggestions.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(f)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/90"
              >
                {formatFeature(f)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
