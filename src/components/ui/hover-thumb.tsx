import React, { useRef, useState } from "react";
import { resolveAssetUrl } from "@/lib/api";

/**
 * Small thumbnail that pops a larger preview next to it on hover.
 *
 * The popup renders with `position: fixed` so it escapes any ancestor with
 * `overflow: hidden` (e.g. cards / table wrappers used across the admin UI).
 * Position is computed from the thumb's bounding rect on hover.
 */
export function HoverThumb({
  src,
  alt = "",
  className = "h-10 w-10 rounded object-cover bg-white/5",
  previewSize = 240,
}: {
  src: string;
  alt?: string;
  className?: string;
  previewSize?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (!src) return null;

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let left = r.right + margin;
    // Flip to the left side if it would overflow the viewport.
    if (left + previewSize > window.innerWidth - 4) left = Math.max(4, r.left - previewSize - margin);
    let top = r.top + r.height / 2 - previewSize / 2;
    top = Math.max(4, Math.min(top, window.innerHeight - previewSize - 4));
    setPos({ top, left });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      className="relative inline-block align-middle"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <img
        src={resolveAssetUrl(src, { w: 80, h: 80, fit: "cover" })}
        alt={alt}
        className={className}
        loading="lazy"
      />
      {pos && (
        <span
          className="pointer-events-none fixed z-[9999] rounded-lg border border-white/10 bg-black/90 shadow-2xl shadow-black/60 p-1 animate-fade-in"
          style={{ top: pos.top, left: pos.left, width: previewSize, height: previewSize }}
        >
          <img
            src={resolveAssetUrl(src, { w: previewSize * 2, h: previewSize * 2, fit: "cover" })}
            alt={alt}
            className="w-full h-full object-cover rounded-md"
          />
        </span>
      )}
    </span>
  );
}
