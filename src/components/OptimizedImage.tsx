/**
 * OptimizedImage — site-wide responsive image component.
 *
 * Routes through the backend `/img` resizer (see server/src/routes/img.js)
 * to serve correctly-sized AVIF variants, with a disk cache and immutable
 * Cache-Control headers. Originals on disk are never modified.
 *
 * Always render with explicit width/height to avoid CLS. Use `priority`
 * for above-the-fold/LCP images so the browser does not lazy-load them
 * and assigns high fetch priority.
 */
import { resolveAssetUrl } from "@/lib/api";
import { forwardRef, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "srcSet" | "loading"> & {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Target rendered widths (CSS px) for srcset. Defaults to [w, w*2]. */
  widths?: number[];
  /** Sizes attribute for responsive srcset. */
  sizes?: string;
  /** Mark as LCP/above-the-fold — disables lazy load, sets fetchpriority=high. */
  priority?: boolean;
  /** Resize fit mode. Defaults to "cover". */
  fit?: "cover" | "contain";
};

const OptimizedImage = forwardRef<HTMLImageElement, Props>(function OptimizedImage(
  { src, alt, width, height, widths, sizes, priority, fit, ...rest },
  ref,
) {
  if (!src) return null;
  const ratio = height / width;
  // Default to a small ladder around the rendered size so high-DPI screens
  // get a sharper variant without overshooting on standard displays.
  const defaultWidths = [
    Math.round(width * 0.75),
    width,
    Math.round(width * 1.5),
    width * 2,
  ];
  const ws = Array.from(
    new Set(
      (widths && widths.length ? widths : defaultWidths).map((w) => Math.round(w)),
    ),
  ).sort((a, b) => a - b);
  const defaultSrc = resolveAssetUrl(src, { w: width, h: Math.round(width * ratio), fit });
  // Width descriptors (e.g. "400w") let the browser pair `sizes` with the
  // best candidate. Mixing `1x`/`2x` density descriptors with `sizes` is
  // invalid and causes oversized fetches on high-DPI screens.
  const srcSet = ws
    .map((w) => `${resolveAssetUrl(src, { w, h: Math.round(w * ratio), fit })} ${w}w`)
    .join(", ");
  return (
    <img
      ref={ref}
      src={defaultSrc}
      srcSet={srcSet}
      sizes={sizes || `${width}px`}
      width={width}
      height={height}
      alt={alt}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      {...rest}
    />
  );
});

export default OptimizedImage;
