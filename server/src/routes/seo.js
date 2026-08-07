/**
 * SEO Tools admin router.
 * - Page-level SEO overrides stored in page_seo
 * - Sitemap and robots.txt generation (writes to public_html if reachable)
 * - Verification / analytics tags, JSON-LD blocks, cache settings stored in site_settings (k/v)
 * - Cloudflare cache purge proxy
 */
import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../db.js";
import { UPLOADS_DIR } from "./../lib/uploads.js";

export const seoRouter = Router();

const SITE = () =>
  (process.env.PUBLIC_SITE_URL || "https://flamesgourmet.ca").replace(/\/$/, "");

// Static, public-facing paths used for the sitemap and the initial "scan".
const STATIC_PATHS = ["/", "/menu", "/shop", "/about", "/contact"];

function publicHtmlDir() {
  if (process.env.PUBLIC_HTML_DIR) return process.env.PUBLIC_HTML_DIR;
  // Try cPanel-style layout: UPLOADS_DIR/../../public_html
  return path.resolve(UPLOADS_DIR, "../../public_html");
}

function tryWrite(file, contents) {
  try {
    const dir = publicHtmlDir();
    if (!fs.existsSync(dir)) return { written: false, path: dir, reason: "Directory does not exist" };
    fs.writeFileSync(path.join(dir, file), contents, "utf8");
    return { written: true, path: path.join(dir, file) };
  } catch (e) {
    return { written: false, reason: e.message };
  }
}

async function getSetting(k) {
  const [rows] = await pool.query("SELECT v FROM site_settings WHERE k = ?", [k]);
  return rows[0]?.v || "";
}

async function setSetting(k, v) {
  await pool.query(
    "INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
    [k, v],
  );
}

// ---------------- Pages ----------------
seoRouter.get("/seo/pages", async (_req, res, next) => {
  try {
    const [items] = await pool.query("SELECT * FROM page_seo ORDER BY path ASC");
    res.json({ items });
  } catch (e) { next(e); }
});

const pageSeoSchema = z.object({
  path: z.string().min(1).max(220),
  title: z.string().max(255).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  focusKeyword: z.string().max(160).optional().nullable(),
  ogImage: z.string().max(500).optional().nullable(),
  jsonLd: z.string().max(20000).optional().nullable(),
});

seoRouter.post("/seo/pages", async (req, res, next) => {
  try {
    const parsed = pageSeoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const d = parsed.data;
    const [existing] = await pool.query("SELECT id FROM page_seo WHERE path = ?", [d.path]);
    if (existing.length) {
      await pool.query(
        "UPDATE page_seo SET title=?, description=?, focus_keyword=?, og_image=?, json_ld=? WHERE id=?",
        [d.title || null, d.description || null, d.focusKeyword || null, d.ogImage || null, d.jsonLd || null, existing[0].id],
      );
      return res.json({ ok: true, id: existing[0].id });
    }
    const [r] = await pool.query(
      "INSERT INTO page_seo (path, title, description, focus_keyword, og_image, json_ld) VALUES (?, ?, ?, ?, ?, ?)",
      [d.path, d.title || null, d.description || null, d.focusKeyword || null, d.ogImage || null, d.jsonLd || null],
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { next(e); }
});

seoRouter.post("/seo/pages/scan", async (req, res, next) => {
  try {
    const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
    let added = 0;
    for (const raw of paths) {
      const p = String(raw || "").trim();
      if (!p || p.length > 220) continue;
      const [existing] = await pool.query("SELECT id FROM page_seo WHERE path = ?", [p]);
      if (existing.length === 0) {
        await pool.query("INSERT INTO page_seo (path, title, description) VALUES (?, NULL, NULL)", [p]);
        added++;
      }
    }
    res.json({ ok: true, added });
  } catch (e) { next(e); }
});

// ---------------- Sitemap ----------------
async function buildSitemapUrls() {
  const [products] = await pool.query("SELECT slug, created_at FROM products WHERE is_active = 1");
  const [categories] = await pool.query("SELECT slug FROM categories");
  const now = new Date().toISOString();
  return [
    ...STATIC_PATHS.map((p) => ({ loc: SITE() + p, lastmod: now })),
    ...categories.map((c) => ({ loc: `${SITE()}/category/${c.slug}`, lastmod: now })),
    ...products.map((p) => ({ loc: `${SITE()}/product/${p.slug}`, lastmod: p.created_at || now })),
  ];
}

function buildSitemapXml(urls) {
  const items = urls
    .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${new Date(u.lastmod).toISOString()}</lastmod></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>`;
}

seoRouter.get("/seo/sitemap", async (_req, res, next) => {
  try {
    const urls = await buildSitemapUrls();
    res.json({ urls, xml: buildSitemapXml(urls) });
  } catch (e) { next(e); }
});

seoRouter.post("/seo/sitemap/generate", async (_req, res, next) => {
  try {
    const urls = await buildSitemapUrls();
    const xml = buildSitemapXml(urls);
    await setSetting("sitemap_xml", xml);
    const written = tryWrite("sitemap.xml", xml);
    res.json({ ok: true, urls: urls.length, xml, written });
  } catch (e) { next(e); }
});

// ---------------- Robots ----------------
seoRouter.post("/seo/robots/generate", async (_req, res, next) => {
  try {
    const sitemapUrl = `${SITE()}/sitemap.xml`;
    const txt = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${sitemapUrl}\n`;
    await setSetting("robots_txt", txt);
    const written = tryWrite("robots.txt", txt);
    res.json({ ok: true, txt, written });
  } catch (e) { next(e); }
});

// ---------------- Settings (verification/analytics/cache/cloudflare/schema) ----------------
const SETTINGS_KEYS = [
  "google_site_verification", "bing_site_verification",
  "ga4_id", "gtm_id", "fb_pixel", "google_ads_id",
  "robots_txt",
  "schema_organization", "schema_website", "schema_local_business",
  "cache_html_max_age", "cache_html_swr",
  "cache_asset_max_age", "cache_image_max_age",
  "cache_enabled",
  "cf_zone_id", "cf_account_id", "cf_api_token",
];

seoRouter.get("/seo/settings", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT k, v FROM site_settings WHERE k IN (${SETTINGS_KEYS.map(() => "?").join(",")})`,
      SETTINGS_KEYS,
    );
    const out = {};
    for (const k of SETTINGS_KEYS) out[k] = "";
    for (const r of rows) out[r.k] = r.v || "";
    res.json({ settings: out });
  } catch (e) { next(e); }
});

const CACHE_KEYS = [
  "cache_enabled",
  "cache_html_max_age", "cache_html_swr",
  "cache_asset_max_age", "cache_image_max_age",
];

const HTACCESS_BEGIN = "# BEGIN LOVABLE CACHE";
const HTACCESS_END = "# END LOVABLE CACHE";

function isDisabled(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "0" || s === "false" || s === "off" || s === "no";
}
function num(v, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function buildHtaccessBlock(s) {
  if (isDisabled(s.cache_enabled)) {
    return [
      HTACCESS_BEGIN,
      "<IfModule mod_headers.c>",
      '  Header set Cache-Control "no-store"',
      "</IfModule>",
      HTACCESS_END,
    ].join("\n");
  }
  const htmlMax = num(s.cache_html_max_age, 300);
  const htmlSwr = num(s.cache_html_swr, 86400);
  const assetMax = num(s.cache_asset_max_age, 2592000);
  const imageMax = num(s.cache_image_max_age, 31536000);
  return [
    HTACCESS_BEGIN,
    "<IfModule mod_headers.c>",
    `  Header set Cache-Control "public, max-age=${htmlMax}, stale-while-revalidate=${htmlSwr}" "expr=%{CONTENT_TYPE} =~ m#^text/html#"`,
    `  Header set Cache-Control "public, max-age=${assetMax}, immutable" "expr=%{CONTENT_TYPE} =~ m#^(application/javascript|text/css|image/svg\\+xml|font/)#"`,
    `  Header set Cache-Control "public, max-age=${imageMax}, immutable" "expr=%{CONTENT_TYPE} =~ m#^image/(jpeg|png|webp|avif|gif)#"`,
    "</IfModule>",
    "<IfModule mod_expires.c>",
    "  ExpiresActive On",
    `  ExpiresByType image/jpeg "access plus ${imageMax} seconds"`,
    `  ExpiresByType image/png  "access plus ${imageMax} seconds"`,
    `  ExpiresByType image/webp "access plus ${imageMax} seconds"`,
    `  ExpiresByType image/avif "access plus ${imageMax} seconds"`,
    `  ExpiresByType text/css            "access plus ${assetMax} seconds"`,
    `  ExpiresByType application/javascript "access plus ${assetMax} seconds"`,
    "</IfModule>",
    HTACCESS_END,
  ].join("\n");
}

function writeCacheToHtaccess(settings) {
  try {
    const dir = publicHtmlDir();
    const file = path.join(dir, ".htaccess");
    if (!fs.existsSync(dir)) return { written: false, path: dir, reason: "Directory does not exist" };
    const block = buildHtaccessBlock(settings);
    let current = "";
    try { current = fs.readFileSync(file, "utf8"); } catch { /* new file */ }
    const re = new RegExp(`${HTACCESS_BEGIN}[\\s\\S]*?${HTACCESS_END}`, "m");
    const next = re.test(current)
      ? current.replace(re, block)
      : (current.replace(/\s*$/, "") + "\n\n" + block + "\n");
    fs.writeFileSync(file, next, "utf8");
    return { written: true, path: file };
  } catch (e) {
    return { written: false, reason: e.message };
  }
}

seoRouter.put("/seo/settings", async (req, res, next) => {
  try {
    const body = req.body || {};
    let cacheTouched = false;
    for (const k of SETTINGS_KEYS) {
      if (k in body) {
        const v = String(body[k] ?? "").slice(0, 20000);
        await setSetting(k, v);
        if (CACHE_KEYS.includes(k)) cacheTouched = true;
      }
    }
    let htaccess = null;
    if (cacheTouched) {
      const [rows] = await pool.query(
        `SELECT k, v FROM site_settings WHERE k IN (${CACHE_KEYS.map(() => "?").join(",")})`,
        CACHE_KEYS,
      );
      const current = {};
      for (const r of rows) current[r.k] = r.v || "";
      htaccess = writeCacheToHtaccess(current);
    }
    res.json({ ok: true, htaccess });
  } catch (e) { next(e); }
});

// ---------------- Cloudflare purge ----------------
seoRouter.post("/seo/cloudflare/purge", async (req, res, next) => {
  try {
    const zoneId = (req.body?.zoneId || await getSetting("cf_zone_id")).trim();
    const apiToken = (req.body?.apiToken || await getSetting("cf_api_token")).trim();
    if (!zoneId || !apiToken) {
      return res.status(400).json({ ok: false, error: "Missing Cloudflare Zone ID or API Token" });
    }
    const files = Array.isArray(req.body?.files) ? req.body.files.filter(Boolean) : null;
    const payload = files && files.length ? { files } : { purge_everything: true };

    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.success === false) {
      const msg = data?.errors?.[0]?.message || `Cloudflare returned ${r.status}`;
      return res.status(502).json({ ok: false, error: msg, details: data });
    }
    res.json({ ok: true, result: data?.result || null, scope: files?.length ? "files" : "all" });
  } catch (e) { next(e); }
});
