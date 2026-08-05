// Page-image registry: every replaceable image/video slot on the storefront.
// Each slot has a stable `key` that the backend stores in `page_images`.
// Pages read overrides through usePageImage(key, defaultUrl) which returns the
// override when present and the hardcoded default otherwise. Same default URL
// can appear in multiple slots — they stay independently replaceable.

import { useEffect, useState } from "react";

export type PageImageKind = "image" | "video";

export type PageImageSlot = {
  key: string;
  page: "home" | "about";
  pageLabel: string;
  label: string;
  defaultUrl: string;
  kind: PageImageKind;
  /** Aspect ratio (w/h) for the admin preview tile, default 16/9. */
  ratio?: number;
};

export const PAGE_IMAGE_SLOTS: PageImageSlot[] = [
  // --- Home ---
  { key: "home.hero.video",            page: "home", pageLabel: "Home", label: "Hero background video",          defaultUrl: "/uploads/fire.mp4",            kind: "video", ratio: 16/9 },
  { key: "home.hero.video_poster",     page: "home", pageLabel: "Home", label: "Hero video poster (fallback)",   defaultUrl: "/uploads/fire-fallback.jpg",   kind: "image", ratio: 16/9 },
  { key: "home.hero.foreground",       page: "home", pageLabel: "Home", label: "Hero foreground food image",     defaultUrl: "/uploads/hero-foods.webp",     kind: "image", ratio: 1 },
  { key: "home.about.storefront",      page: "home", pageLabel: "Home", label: "About section — storefront",     defaultUrl: "/uploads/store-front.jpg",     kind: "image", ratio: 4/3 },
  { key: "home.offer.background",      page: "home", pageLabel: "Home", label: "Limited offer — background",     defaultUrl: "/uploads/happy-customers.jpg", kind: "image", ratio: 16/9 },
  { key: "home.offer.thali",           page: "home", pageLabel: "Home", label: "Limited offer — thali image",    defaultUrl: "/products/thali-box.jpg",      kind: "image", ratio: 4/3 },
  { key: "home.takeaway.delivery",     page: "home", pageLabel: "Home", label: "Take-away / delivery person",    defaultUrl: "/uploads/delivery-person.jpg", kind: "image", ratio: 4/5 },
  { key: "home.premium.background",    page: "home", pageLabel: "Home", label: "Premium on-the-go — background", defaultUrl: "/products/thali-box.jpg",      kind: "image", ratio: 16/9 },
  { key: "home.testimonials.customers", page: "home", pageLabel: "Home", label: "Testimonials — happy customers", defaultUrl: "/uploads/happy-customers.jpg", kind: "image", ratio: 4/3 },
  { key: "home.cta.background",        page: "home", pageLabel: "Home", label: "CTA strip — background",         defaultUrl: "/products/butter-chicken.jpg", kind: "image", ratio: 16/9 },
  { key: "home.cta.biryani",           page: "home", pageLabel: "Home", label: "CTA strip — decorative biryani", defaultUrl: "/products/biryani.avif",       kind: "image", ratio: 1 },

  // --- About ---
  { key: "about.hero.image",           page: "about", pageLabel: "About", label: "Hero banner",                  defaultUrl: "/uploads/hero-banner.jpg",     kind: "image", ratio: 16/5 },
  { key: "about.story.storefront",     page: "about", pageLabel: "About", label: "Storefront photo",             defaultUrl: "/uploads/store-front.jpg",     kind: "image", ratio: 4/3 },
  { key: "about.story.chef",           page: "about", pageLabel: "About", label: "Head chef portrait",           defaultUrl: "/uploads/chef-portrait.jpg",   kind: "image", ratio: 4/3 },
];

// --- Client cache + fetcher --------------------------------------------------

type Overrides = Record<string, string>;
let cache: Overrides | null = null;
let inflight: Promise<Overrides> | null = null;
const listeners = new Set<(o: Overrides) => void>();

function notify(o: Overrides) { for (const l of Array.from(listeners)) l(o); }

async function loadOverrides(): Promise<Overrides> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { request } = await import("./api");
      const data = await request<Overrides>("/page-images");
      cache = data || {};
    } catch {
      cache = {};
    }
    inflight = null;
    notify(cache!);
    return cache!;
  })();
  return inflight;
}

/** Force a refresh after an admin edit. */
export async function refreshPageImageOverrides() {
  cache = null;
  return loadOverrides();
}

/** Read an override for `key`, fall back to `defaultUrl` until loaded. */
export function usePageImage(key: string, defaultUrl: string): string {
  const [val, setVal] = useState<string>(() => cache?.[key] || defaultUrl);
  useEffect(() => {
    let mounted = true;
    loadOverrides().then((o) => { if (mounted) setVal(o[key] || defaultUrl); });
    const listener = (o: Overrides) => { if (mounted) setVal(o[key] || defaultUrl); };
    listeners.add(listener);
    return () => { mounted = false; listeners.delete(listener); };
  }, [key, defaultUrl]);
  return val;
}
