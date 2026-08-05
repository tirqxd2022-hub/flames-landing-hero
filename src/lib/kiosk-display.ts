// Cross-tab kiosk order display. The staff Create-Order screen publishes a
// snapshot of the current cart to localStorage; the /promotions screen (on the
// customer-facing monitor) subscribes and shows the running order.
import { useEffect, useState } from "react";

export type KioskDisplayItem = {
  name: string;
  variantName?: string;
  unit: number;
  qty: number;
  lineTotal: number;
  isOffer?: boolean;
};

export type KioskDisplayOffer = {
  name: string;
  variantName?: string;
  price: number;
  offerName: string;
  image?: string;
  claimed?: boolean;
};


export type KioskDisplaySnapshot = {
  ownerId: string;
  items: KioskDisplayItem[];
  offers?: KioskDisplayOffer[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  freeItemName?: string;
  taxLabel: string;
  taxRate: number;
  tax: number;
  total: number;
  diningOption?: string;
  updatedAt: number;
};

const KEY = "fg_kiosk_display";
const EVENT = "fg_kiosk_display_change";

export function publishKioskDisplay(snapshot: KioskDisplaySnapshot | null) {
  try {
    if (!snapshot || snapshot.items.length === 0 || !snapshot.ownerId) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    }
    // Notify same-tab subscribers (storage event only fires in OTHER tabs).
    window.dispatchEvent(new Event(EVENT));
  } catch { /* ignore quota */ }
}

function read(): KioskDisplaySnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KioskDisplaySnapshot;
    if (!parsed || !Array.isArray(parsed.items) || !parsed.ownerId) return null;
    return parsed;
  } catch { return null; }
}

/**
 * Returns the kiosk snapshot only when it was published by `viewerId` (the
 * currently signed-in staff user). Logged-out visitors and other users see
 * nothing — the running order is private to the punching staff member.
 */
export function useKioskDisplay(viewerId?: string | null): KioskDisplaySnapshot | null {
  const [snap, setSnap] = useState<KioskDisplaySnapshot | null>(() => read());
  useEffect(() => {
    const refresh = () => setSnap(read());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, refresh);
    // Also poll every 2s as a safety net (some browsers throttle background tabs).
    const t = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, refresh);
      window.clearInterval(t);
    };
  }, []);
  if (!snap || !viewerId || snap.ownerId !== viewerId) return null;
  return snap;
}

