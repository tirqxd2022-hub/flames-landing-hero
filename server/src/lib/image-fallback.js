/**
 * Express middleware that rewrites a request for an image that no longer
 * exists at its original extension to a matching sibling. This lets the
 * frontend keep stable URLs like /uploads/store-front.jpg even after the
 * admin Media tool converts it to store-front.avif.
 */
import fs from "node:fs/promises";
import path from "node:path";

const TRY_ORDER = [".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif"];
const HANDLED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif"]);

export function imageFallback(dir) {
  return async (req, _res, next) => {
    try {
      const decoded = decodeURIComponent(req.path);
      const ext = path.extname(decoded).toLowerCase();
      if (!HANDLED_EXTS.has(ext)) return next();
      const full = path.join(dir, decoded);
      try { await fs.access(full); return next(); } catch { /* missing */ }
      const baseNoExt = decoded.slice(0, -ext.length);
      for (const alt of TRY_ORDER) {
        if (alt === ext) continue;
        try {
          await fs.access(path.join(dir, baseNoExt + alt));
          req.url = baseNoExt + alt + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
          return next();
        } catch { /* try next */ }
      }
      return next();
    } catch { return next(); }
  };
}
