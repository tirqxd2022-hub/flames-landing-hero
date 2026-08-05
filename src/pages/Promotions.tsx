import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize, X } from "lucide-react";
import { fetchActivePromotions, resolveAssetUrl, type Promotion } from "@/lib/api";
import { isVideoUrl } from "@/pages/admin/Promotions";
import { useKioskDisplay } from "@/lib/kiosk-display";
import { useAuth } from "@/lib/auth";


export default function PromotionsView() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [pIdx, setPIdx] = useState(0);
  const [sIdx, setSIdx] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sig = (xs: Promotion[]) =>
      xs.map((p) => `${p.id}:${p.slideDurationMs}:${p.slides.map((s) => s.id ?? s.imageUrl).join(",")}`).join("|");
    const load = () => {
      fetchActivePromotions().then((items) => {
        if (cancelled) return;
        setPromos((prev) => (sig(prev) === sig(items) ? prev : items));
      });
    };
    load();
    // Re-check schedule every 30s so promotions activate/deactivate without cron
    const refresh = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  const safePromos = useMemo(() => promos.filter((p) => p.slides.length > 0), [promos]);
  const current = safePromos[pIdx];
  const slide = current?.slides[sIdx];

  function advance() {
    if (!current) return;
    if (sIdx + 1 < current.slides.length) setSIdx(sIdx + 1);
    else { setSIdx(0); setPIdx((pIdx + 1) % safePromos.length); }
  }

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!current) return;
    // For video slides, advance on the video's onEnded event instead.
    if (slide && isVideoUrl(slide.imageUrl)) return;
    const dur = Math.max(500, current.slideDurationMs || 5000);
    timer.current = window.setTimeout(advance, dur);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pIdx, sIdx, current, safePromos.length]);

  // Reset indices when promo list changes
  useEffect(() => {
    if (pIdx >= safePromos.length) setPIdx(0);
    if (current && sIdx >= current.slides.length) setSIdx(0);
  }, [safePromos, pIdx, sIdx, current]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function enterFs() {
    try { await rootRef.current?.requestFullscreen(); } catch { /* ignore */ }
  }
  async function exitFs() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isFs) return;
    const w = window.innerWidth;
    const nearTopRight = e.clientY < 80 && e.clientX > w - 120;
    if (nearTopRight) {
      setShowClose(true);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => setShowClose(false), 2000);
    }
  }

  // Scope the running-order overlay to the punching staff member only. Other
  // logged-in users and public visitors see just the promo slides.
  const { user, isStaff } = useAuth();
  const viewerId = user && isStaff ? String(user.id) : null;
  const kiosk = useKioskDisplay(viewerId);
  const hasOrder = !!kiosk && kiosk.items.length > 0;


  return (
    <div
      ref={rootRef}
      onMouseMove={onMouseMove}
      className="fixed inset-0 w-screen h-screen bg-black overflow-hidden"
    >
      {!current ? (
        <div className="w-full h-full grid place-items-center text-white/60 text-sm">
          No active promotions
        </div>
      ) : (
        <>
          {current.slides.map((s, i) => {
            const active = i === sIdx;
            const cls = `absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0"}`;
            if (isVideoUrl(s.imageUrl)) {
              return (
                <VideoSlide
                  key={`${current.id}-${s.id ?? i}`}
                  src={resolveAssetUrl(s.imageUrl)}
                  className={cls}
                  active={active}
                  onEnded={advance}
                />
              );
            }
            return (
              <img
                key={`${current.id}-${s.id ?? i}`}
                src={resolveAssetUrl(s.imageUrl)}
                alt={current.name}
                className={cls}
              />
            );
          })}
        </>
      )}

      {!isFs && (
        <button
          onClick={enterFs}
          className="absolute top-4 right-4 z-10 inline-flex items-center gap-2 rounded-md bg-black/50 hover:bg-black/70 text-white text-xs px-3 py-2 backdrop-blur border border-white/15"
        >
          <Maximize className="h-4 w-4" /> View Fullscreen
        </button>
      )}

      {isFs && (
        <button
          onClick={() => { try { window.close(); } catch { /* ignore */ } }}
          aria-label="Close tab"
          className={`absolute top-3 right-3 z-10 grid place-items-center h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-opacity duration-200 ${
            showClose ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {hasOrder && kiosk && <OrderOverlay snap={kiosk} />}
    </div>
  );
}

function OrderOverlay({ snap }: { snap: NonNullable<ReturnType<typeof useKioskDisplay>> }) {
  const dining = snap.diningOption === "to_stay" ? "To stay" : snap.diningOption === "delivery" ? "Delivery" : "To go";
  return (
    <aside className="absolute top-4 right-4 bottom-4 z-20 w-[380px] max-w-[92vw] rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 text-white shadow-2xl flex flex-col overflow-hidden">

      <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="font-bold text-lg tracking-tight">Your Order</h2>
        <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">{dining}</span>
      </div>
      <ul className="flex-1 overflow-auto px-5 py-3 space-y-2">
        {snap.items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="leading-tight">
                {it.isOffer && <span className="mr-1">🎉</span>}
                <span className="font-semibold">{it.name}</span>
                {it.variantName && <span className="text-white/60"> — {it.variantName}</span>}
              </div>
              <div className="text-[11px] text-white/50 mt-0.5">${it.unit.toFixed(2)} × {it.qty}</div>
            </div>
            <div className="text-sm font-bold text-[color:var(--flame-light)] tabular-nums whitespace-nowrap">
              ${it.lineTotal.toFixed(2)}
            </div>
          </li>
        ))}
        {snap.offers && snap.offers.length > 0 && (
          <>
            <li className="pt-3 mt-2 border-t border-white/10 text-[10px] uppercase tracking-widest text-[color:var(--gold,#f5c518)] font-semibold">
              Available Offers
            </li>
            {snap.offers.map((o, i) => (
              <li key={`o-${i}`} className={`flex items-start gap-3 text-sm ${o.claimed ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="leading-tight">
                    <span className="mr-1">🎉</span>
                    <span className="font-semibold">{o.name}</span>
                    {o.variantName && <span className="text-white/60"> — {o.variantName}</span>}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {o.offerName}{o.claimed ? " · Added" : ""}
                  </div>
                </div>
                <div className="text-sm font-bold text-[color:var(--flame-light)] tabular-nums whitespace-nowrap">
                  ${o.price.toFixed(2)}
                </div>
              </li>
            ))}
          </>
        )}
      </ul>
      <OfferCarousel offers={snap.offers ?? []} />

      <div className="px-5 py-3 border-t border-white/10 text-sm space-y-1.5">
        <div className="flex justify-between text-white/70"><span>Subtotal</span><span className="tabular-nums">${snap.subtotal.toFixed(2)}</span></div>
        {snap.discount > 0 && (
          <div className="flex justify-between text-green-400">
            <span>Coupon{snap.couponCode ? ` (${snap.couponCode})` : ""}</span>
            <span className="tabular-nums">
              {snap.freeItemName ? `Free ${snap.freeItemName}` : `−$${snap.discount.toFixed(2)}`}
            </span>
          </div>
        )}
        {snap.taxRate > 0 && (
          <div className="flex justify-between text-white/70">
            <span>{snap.taxLabel} ({snap.taxRate}%)</span>
            <span className="tabular-nums">${snap.tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">
          <span>Total</span>
          <span className="text-[color:var(--flame-light)] tabular-nums">${snap.total.toFixed(2)}</span>
        </div>
      </div>
    </aside>
  );
}

function OfferCarousel({ offers }: { offers: NonNullable<ReturnType<typeof useKioskDisplay>>["offers"] }) {
  const withImg = (offers ?? []).filter((o) => !!o.image);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (withImg.length <= 1) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % withImg.length), 3000);
    return () => window.clearInterval(t);
  }, [withImg.length]);
  useEffect(() => { if (idx >= withImg.length) setIdx(0); }, [withImg.length, idx]);
  if (withImg.length === 0) return null;
  return (
    <div className="border-t border-white/10 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-[color:var(--gold,#f5c518)] font-semibold mb-2">
        Featured Offers
      </div>
      <div className="relative h-[12.5rem] overflow-hidden rounded-lg bg-white/5">
        {withImg.map((o, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-all duration-500 ease-out ${
              i === idx ? "opacity-100 translate-x-0" : i < idx ? "opacity-0 -translate-x-full" : "opacity-0 translate-x-full"
            }`}
          >
            <img
              src={resolveAssetUrl(o.image!)}
              alt={o.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pt-6 pb-2">
              <div className="text-sm font-semibold leading-tight truncate">
                {o.name}{o.variantName ? ` — ${o.variantName}` : ""}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] uppercase tracking-wider text-white/70 truncate">{o.offerName}</span>
                <span className="text-base font-bold text-[color:var(--flame-light)] tabular-nums">
                  ${o.price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {withImg.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {withImg.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${i === idx ? "w-4 bg-[color:var(--flame-light)]" : "w-1 bg-white/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function VideoSlide({ src, className, active, onEnded }: { src: string; className: string; active: boolean; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      try { v.currentTime = 0; } catch { /* ignore */ }
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* ignore autoplay block */ });
    } else {
      v.pause();
      try { v.currentTime = 0; } catch { /* ignore */ }
    }
  }, [active, src]);
  return (
    <video
      ref={ref}
      src={src}
      className={className}
      muted
      playsInline
      preload="auto"
      onEnded={() => { if (active) onEnded(); }}
    />
  );
}

