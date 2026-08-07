/**
 * Loads the admin-configured Cache-Control values from site_settings
 * (keys: cache_enabled, cache_html_max_age, cache_html_swr,
 *  cache_asset_max_age, cache_image_max_age) and exposes Express
 * middleware that applies them to responses served by Node.
 *
 * NOTE: HTML / JS / CSS for the SPA are served by Apache (.htaccess) on
 * cPanel, NOT by this Node process — so the html/asset values only take
 * effect for responses Node actually emits (currently the image proxy
 * and the /uploads + /products static handlers).
 */
import { pool } from "../db.js";

const DEFAULTS = {
  cache_enabled: "1",
  cache_html_max_age: "300",
  cache_html_swr: "86400",
  cache_asset_max_age: "2592000",
  cache_image_max_age: "31536000",
};

const KEYS = Object.keys(DEFAULTS);
const TTL_MS = 10_000;
let cached = null;
let cachedAt = 0;

export async function loadCacheSettings() {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;
  try {
    const [rows] = await pool.query(
      `SELECT k, v FROM site_settings WHERE k IN (${KEYS.map(() => "?").join(",")})`,
      KEYS,
    );
    const out = { ...DEFAULTS };
    for (const r of rows) if (r.v != null && r.v !== "") out[r.k] = String(r.v);
    cached = out;
    cachedAt = now;
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

function isDisabled(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "0" || s === "false" || s === "off" || s === "no";
}

function num(v, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Returns the Cache-Control header value for a given kind based on the
 * latest admin settings. kind: "image" | "asset" | "html".
 */
export async function cacheControlHeader(kind) {
  const s = await loadCacheSettings();
  if (isDisabled(s.cache_enabled)) return "no-store";
  if (kind === "image") {
    return `public, max-age=${num(s.cache_image_max_age, 31536000)}, immutable`;
  }
  if (kind === "asset") {
    return `public, max-age=${num(s.cache_asset_max_age, 2592000)}, immutable`;
  }
  // html
  return `public, max-age=${num(s.cache_html_max_age, 300)}, stale-while-revalidate=${num(s.cache_html_swr, 86400)}`;
}

/** Express middleware: sets Cache-Control on uploaded-media responses. */
export function mediaCacheControl() {
  return async (_req, res, next) => {
    try {
      res.setHeader("Cache-Control", await cacheControlHeader("image"));
    } catch { /* ignore */ }
    next();
  };
}
