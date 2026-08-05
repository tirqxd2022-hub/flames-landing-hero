import { useEffect, useState } from "react";
import { fetchSiteSettings, type SiteSettings } from "@/lib/api";

let cache: SiteSettings | null = null;
let pending: Promise<SiteSettings> | null = null;

export function useSiteSettings(): SiteSettings {
  const [s, setS] = useState<SiteSettings>(cache ?? {});
  useEffect(() => {
    if (cache) { setS(cache); return; }
    pending ??= fetchSiteSettings().then((r) => (cache = r ?? {}));
    pending.then((r) => setS(r));
  }, []);
  return s;
}

export function telHref(phone?: string): string {
  return `tel:${(phone || "").replace(/[^\d+]/g, "")}`;
}
