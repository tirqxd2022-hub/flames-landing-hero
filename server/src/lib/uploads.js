/**
 * File-upload helpers using multer + sharp.
 *
 * Two image roots:
 *   - "page"     => UPLOADS_DIR (served at /uploads) — logo, hero, etc.
 *   - "products" => PRODUCTS_DIR (served at /products) — food images.
 *
 * On cPanel point UPLOADS_DIR / PRODUCTS_DIR at folders outside the
 * document root and let Apache serve them via /uploads + /products aliases
 * in .htaccess.
 */
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getSharp() {
  try {
    const mod = await import("sharp");
    return mod.default || mod;
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      console.warn("[uploads] sharp is not installed; image conversion skipped.");
      return null;
    }
    throw err;
  }
}

export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR || process.env.UPLOAD_DIR || path.resolve(__dirname, "../../uploads"),
);
export const UPLOADS_PUBLIC_BASE = "/uploads";

export const PRODUCTS_DIR = path.resolve(
  process.env.PRODUCTS_DIR || path.resolve(UPLOADS_DIR, "../products"),
);
export const PRODUCTS_PUBLIC_BASE = "/products";

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

export function normalizeFolder(folder) {
  return folder === "products" ? "products" : "page";
}
export function dirFor(folder) {
  return normalizeFolder(folder) === "products" ? PRODUCTS_DIR : UPLOADS_DIR;
}
export function publicBaseFor(folder) {
  return normalizeFolder(folder) === "products" ? PRODUCTS_PUBLIC_BASE : UPLOADS_PUBLIC_BASE;
}
export function folderFromUrl(url) {
  const s = String(url || "");
  if (s.startsWith(PRODUCTS_PUBLIC_BASE + "/") || s.includes(`/api${PRODUCTS_PUBLIC_BASE}/`)) return "products";
  return "page";
}
export function publicUrlFor(filename, folder = "page") {
  return `${publicBaseFor(folder)}/${filename}`;
}

// Resolve a stored image URL to the actual existing file's URL on disk.
// After optimization, the file may be saved as .avif/.webp while DB rows
// (or seeded mock data) still reference the original .jpeg/.png. This
// helper rewrites the URL extension to whatever extension currently
// exists on disk, preferring optimized formats. Results are cached.
const TRY_EXTS = [".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif"];
const _resolveCache = new Map(); // url -> resolved url
export function resolveImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (/^https?:\/\//i.test(url)) return url;
  const cached = _resolveCache.get(url);
  if (cached !== undefined) return cached;

  const m = /^(\/(?:uploads|products))\/([^?#]+?)(\.[a-zA-Z0-9]+)(\?.*)?$/.exec(url);
  if (!m) { _resolveCache.set(url, url); return url; }
  const [, base, name, ext, qs = ""] = m;
  const folder = base === PRODUCTS_PUBLIC_BASE ? "products" : "page";
  const dir = dirFor(folder);

  // If the original exists and is already optimized, keep it.
  const origPath = path.join(dir, name + ext);
  if (fs.existsSync(origPath) && isOptimizedFilename(name + ext)) {
    _resolveCache.set(url, url);
    return url;
  }
  // Prefer optimized siblings, otherwise the first existing variant.
  for (const alt of TRY_EXTS) {
    const candidate = path.join(dir, name + alt);
    if (fs.existsSync(candidate)) {
      const resolved = `${base}/${name}${alt}${qs}`;
      _resolveCache.set(url, resolved);
      return resolved;
    }
  }
  _resolveCache.set(url, url);
  return url;
}
export function invalidateImageUrlCache() { _resolveCache.clear(); }

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "file";
}
function uniqueFilenameIn(dir, original) {
  const safe = sanitize(original);
  const ext = path.extname(safe);
  const base = ext ? safe.slice(0, -ext.length) : safe;
  let candidate = safe;
  let i = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${i}${ext}`;
    i++;
  }
  return candidate;
}

function makeUploader(folder) {
  const dir = dirFor(folder);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => cb(null, uniqueFilenameIn(dir, file.originalname)),
  });
  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => {
      if (!/^image\/(jpe?g|png|webp|avif|gif|svg\+xml)$/.test(file.mimetype)) {
        return cb(new Error("Only image uploads are allowed."));
      }
      cb(null, true);
    },
  });
}

export const pageUpload = makeUploader("page");
export const productsUpload = makeUploader("products");

export function uploadSingleAny(field) {
  const m1 = pageUpload.single(field);
  const m2 = productsUpload.single(field);
  return (req, res, next) => {
    const folder = normalizeFolder(req.query?.folder || req.body?.folder);
    return (folder === "products" ? m2 : m1)(req, res, next);
  };
}

const IMG_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp", ".tif", ".tiff"];

export function isOptimizedFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".avif" || ext === ".svg";
}

const CONVERTIBLE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".bmp", ".webp"]);

export async function convertFileToAvif(filename, folder = "page") {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".avif" || ext === ".svg") return filename;
  if (!CONVERTIBLE_EXT.has(ext)) return filename;

  const dir = dirFor(folder);
  const src = path.join(dir, filename);
  const base = path.basename(filename, ext);
  let outName = `${base}.avif`;
  let out = path.join(dir, outName);
  if (fs.existsSync(out)) {
    outName = `${base}-${crypto.randomBytes(3).toString("hex")}.avif`;
    out = path.join(dir, outName);
  }
  const isAnimated = ext === ".gif" || ext === ".webp";
  const sharp = await getSharp();
  if (!sharp) return filename;
  await sharp(src, isAnimated ? { animated: true } : {})
    .avif({ quality: 55, effort: 4 })
    .toFile(out);
  return outName;
}

export async function listUploadedImages(folder = "page") {
  const dir = dirFor(folder);
  const base = publicBaseFor(folder);
  const items = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!IMG_EXTS.includes(ext)) continue;
    const full = path.join(dir, e.name);
    const st = await fsp.stat(full).catch(() => null);
    if (!st) continue;
    items.push({
      filename: e.name,
      folder: normalizeFolder(folder),
      url: `${base}/${e.name}`,
      size: st.size,
      mtime: st.mtimeMs,
      optimized: isOptimizedFilename(e.name),
    });
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return items;
}

// ---------- Videos (page-folder bucket, mp4 + webm) ----------
const VIDEO_EXTS = [".mp4", ".webm"];

export function isVideoFilename(name) {
  return VIDEO_EXTS.includes(path.extname(String(name || "")).toLowerCase());
}

function videoMime(ext) {
  return ext === ".webm" ? "video/webm" : "video/mp4";
}

export async function listUploadedVideos() {
  const dir = UPLOADS_DIR;
  const items = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!VIDEO_EXTS.includes(ext)) continue;
    const full = path.join(dir, e.name);
    const st = await fsp.stat(full).catch(() => null);
    if (!st) continue;
    items.push({
      filename: e.name,
      url: `${UPLOADS_PUBLIC_BASE}/${e.name}`,
      size: st.size,
      mtime: st.mtimeMs,
      mime: videoMime(ext),
      ext: ext.slice(1),
    });
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return items;
}

export const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, uniqueFilenameIn(UPLOADS_DIR, file.originalname)),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okMime = /^video\/(mp4|webm)$/i.test(file.mimetype);
    const okExt = isVideoFilename(file.originalname);
    if (!okMime && !okExt) return cb(new Error("Only .mp4 and .webm video uploads are allowed."));
    cb(null, true);
  },
});
