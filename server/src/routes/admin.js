import { Router } from "express";
import bcrypt from "bcryptjs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { pool } from "../db.js";
import { hasJwtSecret, requireAdmin, signAdminToken } from "../auth.js";
import { uploadSingleAny, publicUrlFor, normalizeFolder, videoUpload, listUploadedVideos, UPLOADS_DIR, UPLOADS_PUBLIC_BASE, isVideoFilename, resolveImageUrl, convertFileToAvif, invalidateImageUrlCache } from "../lib/uploads.js";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { effectivePermissionsAsync, defaultPermissionsForRole, isReadOnlyRole } from "../lib/roles.js";
import { imagesRouter } from "./images.js";
import { settingsRouter } from "./settings.js";
import { usersRouter, rolePermissionsRouter } from "./users.js";
import { newsletterRouter } from "./newsletter.js";
import { submissionsRouter } from "./submissions.js";
import { seoRouter } from "./seo.js";
import { couponsRouter } from "./coupons.js";
import { promotionsRouter } from "./promotions.js";
import { offersRouter } from "./offers.js";
import { adminPageImagesRouter } from "./page-images.js";
import { customersRouter } from "./customers.js";
import { deliveryAdminRouter } from "./delivery.js";
import { attendanceRouter } from "./attendance.js";
import { dispatchOrderToCourier } from "../lib/uber-direct.js";
// Assistant router is loaded lazily so a missing optional dependency
// (`ai`, `@ai-sdk/openai-compatible`) on production cPanel never crashes the
// whole admin API — which would take down /uploads, /products, and login.
let assistantRouter = null;
try {
  ({ assistantRouter } = await import("./assistant.js"));
} catch (e) {
  console.warn("[admin] assistant router disabled:", e?.message || e);
}

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const adminRouter = Router();

// ---------- Auth ----------
adminRouter.post("/login", async (req, res) => {
  if (!hasJwtSecret()) return res.status(503).json({ error: "JWT_SECRET environment variable is required" });
  const schema = z.object({
    email: z.string().trim().min(1).max(255),
    password: z.string().min(6).max(200),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  // admin_users table (new RBAC). Accept email OR username in the email field.
  const ident = parsed.data.email;
  const [rows] = await pool.query(
    `SELECT id, username, email, password_hash, is_super, role, permissions
       FROM admin_users WHERE email = ? OR username = ? LIMIT 1`,
    [ident, ident],
  );
  if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

  const u = rows[0];
  const ok = await bcrypt.compare(parsed.data.password, u.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  await pool.query("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?", [u.id]);
  const token = signAdminToken({
    sub: u.id, email: u.email, username: u.username,
    is_super: !!u.is_super, role: u.role || "admin",
  });
  res.json({ token });
});

// All routes below require admin JWT
adminRouter.use(requireAdmin);

// Read-only roles (e.g. Guest) can browse every page but cannot mutate anything.
// GET/HEAD/OPTIONS pass through; mutating requests short-circuit with a benign
// success response so the UI doesn't surface an error toast on every save.
adminRouter.use((req, res, next) => {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  if (req.admin?.is_super) return next();
  if (isReadOnlyRole(req.admin?.role)) {
    return res.status(200).json({ ok: true, readOnly: true });
  }
  next();
});

// ---------- Me / permissions ----------
adminRouter.get("/me", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, email, full_name, is_super, role, permissions FROM admin_users WHERE id = ? LIMIT 1",
      [req.admin?.sub],
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    const perms = await effectivePermissionsAsync(pool, u);
    let navOrder = null;
    try {
      const [nr] = await pool.query("SELECT v FROM site_settings WHERE k = ?", ["admin_nav_order"]);
      if (nr[0]?.v) {
        const parsed = JSON.parse(nr[0].v);
        if (Array.isArray(parsed)) navOrder = parsed.filter((x) => typeof x === "string");
      }
    } catch { /* ignore */ }
    res.json({
      user: {
        id: u.id, username: u.username, email: u.email,
        full_name: u.full_name || null,
        is_super: !!u.is_super, role: u.role || "admin",
        permissions: perms,
        navOrder,
      },
    });
  } catch (e) { next(e); }
});

adminRouter.use(imagesRouter);
adminRouter.use(settingsRouter);
adminRouter.use(rolePermissionsRouter);
adminRouter.use(usersRouter);
adminRouter.use(newsletterRouter);
adminRouter.use(customersRouter);
adminRouter.use(submissionsRouter);
adminRouter.use(seoRouter);
adminRouter.use(couponsRouter);
adminRouter.use(promotionsRouter);
adminRouter.use(offersRouter);
adminRouter.use(adminPageImagesRouter);
adminRouter.use(deliveryAdminRouter);
adminRouter.use(attendanceRouter);
if (assistantRouter) adminRouter.use(assistantRouter);

// ---------- Orders ----------
import { autoCancelStaleUnpaidOrders } from "../lib/auto-cancel.js";

async function loadAdminOrderById(orderId) {
  const [orders] = await pool.query(
    `SELECT o.order_number AS orderNumber, o.status, o.subtotal, o.discount, o.coupon_code AS couponCode,
            o.customer_name AS customerName,
            o.customer_phone AS customerPhone, o.pickup_time AS pickupTime, o.notes,
            o.payment_method AS paymentMethod, o.cash_received AS cashReceived, o.paid_at AS paidAt,
            o.dining_option AS diningOption,
            o.delivery_address AS deliveryAddress,
            o.delivery_instructions AS deliveryInstructions,
            o.ready_at AS readyAt,
            o.is_preorder AS isPreorder, o.preorder_at AS preorderAt,
            o.created_at AS createdAt, o.staff_username AS staffUsername,
            COALESCE(o.delivery_fee_cents, (SELECT d.fee_cents FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1)) AS deliveryFeeCents,
            (SELECT d.delivery_id FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS deliveryId,
            (SELECT d.tracking_url FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS trackingUrl,
            (SELECT d.status FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS deliveryStatus
       FROM orders o WHERE o.id = ? LIMIT 1`,
    [orderId],
  );
  const order = orders[0];
  if (!order) return null;
  const [items] = await pool.query(
    `SELECT o.order_number AS orderNumber, oi.product_name AS productName, oi.unit_price AS unitPrice,
            oi.quantity, oi.line_total AS lineTotal, p.image_url AS image
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.id = ?`,
    [orderId],
  );
  return {
    ...order,
    deliveryFee: order.deliveryFeeCents != null ? Number(order.deliveryFeeCents) / 100 : null,
    items: items.map((i) => ({ ...i, image: resolveImageUrl(i.image) })),
  };
}

adminRouter.get("/orders", async (_req, res) => {
  await autoCancelStaleUnpaidOrders(true);
  const [orders] = await pool.query(
    `SELECT o.order_number AS orderNumber, o.status, o.subtotal, o.discount, o.coupon_code AS couponCode,
            o.customer_name AS customerName,
            o.customer_phone AS customerPhone, o.pickup_time AS pickupTime, o.notes,
            o.payment_method AS paymentMethod, o.cash_received AS cashReceived, o.paid_at AS paidAt,
            o.dining_option AS diningOption,
            o.delivery_address AS deliveryAddress,
            o.delivery_instructions AS deliveryInstructions,
            o.ready_at AS readyAt,
            o.is_preorder AS isPreorder, o.preorder_at AS preorderAt,
            o.created_at AS createdAt, o.staff_username AS staffUsername,
            COALESCE(o.delivery_fee_cents, (SELECT d.fee_cents FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1)) AS deliveryFeeCents,
            (SELECT d.delivery_id FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS deliveryId,
            (SELECT d.tracking_url FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS trackingUrl,
            (SELECT d.status FROM deliveries d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS deliveryStatus
     FROM orders o ORDER BY o.created_at DESC LIMIT 500`
  );
  const ids = orders.map((o) => o.orderNumber);
  if (ids.length === 0) return res.json([]);
  const [items] = await pool.query(
    `SELECT o.order_number AS orderNumber, oi.product_name AS productName, oi.unit_price AS unitPrice,
            oi.quantity, oi.line_total AS lineTotal, p.image_url AS image
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.order_number IN (?)`,
    [ids]
  );
  const withImage = items.map((i) => ({ ...i, image: resolveImageUrl(i.image) }));
  res.json(orders.map((o) => ({
    ...o,
    deliveryFee: o.deliveryFeeCents != null ? Number(o.deliveryFeeCents) / 100 : null,
    items: withImage.filter((i) => i.orderNumber === o.orderNumber),
  })));
});

const orderPatchSchema = z.object({
  status: z.enum(["new", "preparing", "ready", "picked_up", "cancelled"]).optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  pickupTime: z.string().max(40).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  paymentMethod: z.enum(["cash", "debit", "credit"]).nullable().optional(),
  diningOption: z.enum(["to_go", "to_stay"]).optional(),
  paid: z.boolean().optional(),
  items: z.array(z.object({
    productName: z.string().min(1).max(200),
    unitPrice: z.number().nonnegative(),
    quantity: z.number().int().min(1).max(99),
    lineTotal: z.number().nonnegative(),
  })).optional(),
});

adminRouter.patch("/orders/:orderNumber", async (req, res) => {
  const parsed = orderPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const p = parsed.data;
  const orderNumber = req.params.orderNumber;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT id, paid_at, ready_at, dining_option, is_preorder FROM orders WHERE order_number = ? LIMIT 1",
      [orderNumber],
    );
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: "Order not found" }); }
    const orderId = rows[0].id;

    const sets = [];
    const vals = [];
    const map = {
      status: "status", customerName: "customer_name", customerPhone: "customer_phone",
      pickupTime: "pickup_time", notes: "notes", paymentMethod: "payment_method",
      diningOption: "dining_option",
    };
    for (const [k, col] of Object.entries(map)) {
      if (p[k] !== undefined) { sets.push(`${col} = ?`); vals.push(p[k]); }
    }
    // Stamp ready_at the first time status flips to "ready".
    if (p.status === "ready" && !rows[0].ready_at) {
      sets.push("ready_at = ?"); vals.push(new Date());
    }
    if (p.paid !== undefined) {
      sets.push("paid_at = ?");
      vals.push(p.paid ? new Date() : null);
    }
    if (p.items) {
      const subtotal = Math.round(p.items.reduce((s, it) => s + it.lineTotal, 0) * 100) / 100;
      sets.push("subtotal = ?"); vals.push(subtotal);
      await conn.query("DELETE FROM order_items WHERE order_id = ?", [orderId]);
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES ?`,
        [p.items.map((it) => [orderId, null, it.productName, it.unitPrice, it.quantity, it.lineTotal])]
      );
    }
    if (sets.length) {
      vals.push(orderId);
      await conn.query(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, vals);
    }
    await conn.commit();

    let dispatchError = null;
    const finalDiningOption = p.diningOption ?? rows[0].dining_option;
    const finalIsPreorder = Boolean(rows[0].is_preorder);
    if (p.paid === true && finalDiningOption === "delivery" && !finalIsPreorder) {
      try {
        await dispatchOrderToCourier(pool, orderId);
      } catch (e) {
        dispatchError = e?.message || "Courier dispatch failed";
        console.error(`[uber dispatch] order ${orderNumber} failed after paid update:`, dispatchError);
      }
    }

    const order = await loadAdminOrderById(orderId);
    res.json({ ok: true, order, dispatchError });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: "Update failed" });
  } finally {
    conn.release();
  }
});

adminRouter.delete("/orders/:orderNumber", async (req, res) => {
  await pool.query("DELETE FROM orders WHERE order_number = ?", [req.params.orderNumber]);
  res.json({ ok: true });
});

// ---------- Categories ----------
const catSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  image_url: z.string().max(500).optional().default(""),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
  is_featured: z.boolean().optional().default(false),
  side_category_id: z.number().int().positive().nullable().optional(),
  availability: z.enum(["available", "unavailable", "upcoming"]).optional().default("available"),
});

adminRouter.get("/categories", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, sc.slug AS side_category_slug
       FROM categories c
       LEFT JOIN categories sc ON sc.id = c.side_category_id
       ORDER BY c.sort_order, c.name`
  );
  res.json(rows.map((r) => ({ ...r, is_featured: !!r.is_featured })));
});
adminRouter.post("/categories", async (req, res) => {
  const p = catSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const [r] = await pool.query(
    `INSERT INTO categories (slug, name, description, image_url, sort_order, is_featured, side_category_id, availability) VALUES (?,?,?,?,?,?,?,?)`,
    [p.data.slug, p.data.name, p.data.description, p.data.image_url, p.data.sort_order, p.data.is_featured ? 1 : 0, p.data.side_category_id ?? null, p.data.availability || "available"]
  );
  res.status(201).json({ id: r.insertId });
});
adminRouter.patch("/categories/:id", async (req, res) => {
  const p = catSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const data = { ...p.data };
  if (typeof data.is_featured === "boolean") data.is_featured = data.is_featured ? 1 : 0;
  const entries = Object.entries(data);
  if (entries.length === 0) return res.json({ ok: true });
  await pool.query(
    `UPDATE categories SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
    [...entries.map(([, v]) => v), req.params.id]
  );
  res.json({ ok: true });
});
adminRouter.delete("/categories/:id", async (req, res) => {
  await pool.query(`DELETE FROM categories WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

// ---------- Products ----------
const variantSchema = z.object({
  name: z.string().min(1).max(120),
  price: z.number().nonnegative().max(99999),
  is_base: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});
const productSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(120),
  category_id: z.number().int().positive(),
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional().default(""),
  long_description: z.string().max(2000).optional().default(""),
  nutrition_json: z.string().max(4000).nullable().optional(),
  price: z.number().nonnegative().max(99999),
  image_url: z.string().max(500).optional().default(""),
  is_veg: z.boolean().optional().default(true),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  rating: z.number().min(0).max(5).optional().default(5),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
  product_type: z.enum(["simple", "variable"]).optional().default("simple"),
  variants: z.array(variantSchema).max(50).optional(),
});

async function persistVariants(productId, variants) {
  await pool.query(`DELETE FROM product_variants WHERE product_id = ?`, [productId]);
  if (!variants || variants.length === 0) return;
  const rows = variants.map((v, i) => [
    productId, v.name, v.price, v.is_base ? 1 : 0, v.sort_order ?? i,
  ]);
  await pool.query(
    `INSERT INTO product_variants (product_id, name, price, is_base, sort_order) VALUES ?`,
    [rows],
  );
}

async function attachVariants(products) {
  if (products.length === 0) return products;
  const ids = products.map((p) => p.id);
  const [rows] = await pool.query(
    `SELECT id, product_id, name, price, is_base, sort_order
       FROM product_variants WHERE product_id IN (?) ORDER BY product_id, sort_order, id`,
    [ids],
  );
  const byProd = new Map();
  for (const r of rows) {
    const arr = byProd.get(r.product_id) || [];
    arr.push({ id: r.id, name: r.name, price: Number(r.price), is_base: !!r.is_base, sort_order: r.sort_order });
    byProd.set(r.product_id, arr);
  }
  for (const p of products) p.variants = byProd.get(p.id) || [];
  return products;
}

adminRouter.get("/products", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, c.slug AS category_slug FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.sort_order, p.name`
  );
  await attachVariants(rows);
  res.json(rows);
});
adminRouter.post("/products", async (req, res) => {
  const p = productSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const [r] = await pool.query(
    `INSERT INTO products (slug, category_id, name, description, long_description, nutrition_json, price, image_url, is_veg, is_active, is_featured, rating, sort_order, product_type)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.data.slug, p.data.category_id, p.data.name, p.data.description, p.data.long_description, p.data.nutrition_json ?? null, p.data.price, p.data.image_url, p.data.is_veg ? 1 : 0, p.data.is_active ? 1 : 0, p.data.is_featured ? 1 : 0, p.data.rating, p.data.sort_order, p.data.product_type || "simple"]
  );
  if (p.data.product_type === "variable") await persistVariants(r.insertId, p.data.variants || []);
  res.status(201).json({ id: r.insertId });
});
adminRouter.patch("/products/:id", async (req, res) => {
  const p = productSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const data = { ...p.data };
  const variants = data.variants;
  delete data.variants;
  if (typeof data.is_veg === "boolean") data.is_veg = data.is_veg ? 1 : 0;
  if (typeof data.is_active === "boolean") data.is_active = data.is_active ? 1 : 0;
  if (typeof data.is_featured === "boolean") data.is_featured = data.is_featured ? 1 : 0;
  const entries = Object.entries(data);
  if (entries.length > 0) {
    await pool.query(
      `UPDATE products SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), req.params.id]
    );
  }
  if (variants !== undefined) {
    await persistVariants(Number(req.params.id), variants);
  } else if (data.product_type === "simple") {
    await pool.query(`DELETE FROM product_variants WHERE product_id = ?`, [req.params.id]);
  }
  if (Object.prototype.hasOwnProperty.call(data, "image_url")) invalidateImageUrlCache();
  res.json({ ok: true });
});
adminRouter.delete("/products/:id", async (req, res) => {
  await pool.query(`DELETE FROM products WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

// ---------- Products CSV export / import ----------
const CSV_HEADERS = [
  "slug","name","category_slug","subcategory_slug","description","long_description",
  "price","image_url","is_veg","is_active","rating","sort_order",
];
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function parseCsv(text) {
  const rows = []; let cur = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.length && r.some((c) => c.trim() !== ""));
}

adminRouter.get("/products/export.csv", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.slug, p.name, c.slug AS category_slug, s.slug AS subcategory_slug,
              p.description, p.long_description, p.price, p.image_url,
              p.is_veg, p.is_active, p.rating, p.sort_order
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN subcategories s ON s.id = p.subcategory_id
        ORDER BY c.sort_order, p.sort_order, p.name`,
    );
    const lines = [CSV_HEADERS.join(",")];
    for (const p of rows) {
      lines.push([
        p.slug, p.name, p.category_slug, p.subcategory_slug || "",
        p.description, p.long_description, p.price, p.image_url,
        p.is_veg ? 1 : 0, p.is_active ? 1 : 0, p.rating, p.sort_order,
      ].map(csvEscape).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="products-${Date.now()}.csv"`);
    res.send(lines.join("\n"));
  } catch (e) { next(e); }
});

adminRouter.post("/products/import", csvUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Upload a CSV file." });
    const text = req.file.buffer.toString("utf8").replace(/^\uFEFF/, "");
    const rows = parseCsv(text);
    if (rows.length < 2) return res.status(400).json({ error: "CSV is empty." });
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (k) => headers.indexOf(k);

    const [catRows] = await pool.query("SELECT id, slug FROM categories");
    const catMap = new Map(catRows.map((c) => [c.slug.toLowerCase(), c.id]));
    const [subRows] = await pool.query("SELECT id, slug, category_id FROM subcategories");

    let created = 0, updated = 0, skipped = 0;
    const errors = [];
    const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
    const bool = (v) => /^(1|true|yes|y)$/i.test(String(v ?? "").trim()) ? 1 : 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const get = (k) => { const i = idx(k); return i >= 0 ? (row[i] ?? "").trim() : ""; };
      const slug = get("slug");
      const name = get("name");
      if (!slug || !name) { skipped++; continue; }
      const catSlug = get("category_slug").toLowerCase();
      const categoryId = catMap.get(catSlug);
      if (!categoryId) { errors.push(`Row ${r + 1} (${slug}): unknown category_slug "${catSlug}"`); skipped++; continue; }
      const subSlug = get("subcategory_slug").toLowerCase();
      const subRow = subSlug ? subRows.find((s) => s.slug.toLowerCase() === subSlug && s.category_id === categoryId) : null;
      const subcategoryId = subRow ? subRow.id : null;

      const fields = {
        slug, name, category_id: categoryId, subcategory_id: subcategoryId,
        description: get("description"),
        long_description: get("long_description"),
        price: num(get("price")) ?? 0,
        image_url: get("image_url"),
        is_veg: idx("is_veg") >= 0 ? bool(get("is_veg")) : 1,
        is_active: idx("is_active") >= 0 ? bool(get("is_active")) : 1,
        rating: num(get("rating")) ?? 5,
        sort_order: Math.trunc(num(get("sort_order")) ?? 0),
      };

      try {
        const [exist] = await pool.query("SELECT id FROM products WHERE slug = ? LIMIT 1", [slug]);
        if (exist.length) {
          const entries = Object.entries(fields).filter(([k]) => k !== "slug");
          await pool.query(
            `UPDATE products SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
            [...entries.map(([, v]) => v), exist[0].id],
          );
          updated++;
        } else {
          await pool.query(
            `INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, rating, sort_order)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [fields.slug, fields.category_id, fields.subcategory_id, fields.name, fields.description, fields.long_description,
             fields.price, fields.image_url, fields.is_veg, fields.is_active, fields.rating, fields.sort_order],
          );
          created++;
        }
      } catch (err) {
        errors.push(`Row ${r + 1} (${slug}): ${err.message}`);
      }
    }
    res.json({ ok: true, created, updated, skipped, errors });
  } catch (e) { next(e); }
});



// ---------- Uploads ----------
adminRouter.post("/upload", uploadSingleAny("file"), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  try {
    const folder = normalizeFolder(req.query?.folder || req.body?.folder);
    const uploadedName = req.file.filename;
    const convertedName = await convertFileToAvif(uploadedName, folder);
    if (convertedName !== uploadedName) {
      await fsp.unlink(req.file.path).catch(() => {});
      invalidateImageUrlCache();
    }
    const finalPath = convertedName === uploadedName ? req.file.path : path.join(path.dirname(req.file.path), convertedName);
    const stat = await fsp.stat(finalPath).catch(() => null);
    res.status(201).json({
      url: publicUrlFor(convertedName, folder),
      filename: convertedName,
      folder,
      size: stat?.size ?? req.file.size,
      mime: convertedName.endsWith(".avif") ? "image/avif" : req.file.mimetype,
    });
  } catch (e) { next(e); }
});



// ---------- Videos (mp4 / webm) ----------
adminRouter.get("/videos", async (_req, res, next) => {
  try {
    const items = await listUploadedVideos();
    res.json({ items });
  } catch (e) { next(e); }
});

adminRouter.post("/videos/upload", videoUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  res.status(201).json({
    url: `${UPLOADS_PUBLIC_BASE}/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size,
    mime: req.file.mimetype,
  });
});

adminRouter.post("/videos/replace", videoUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const target = path.basename(String(req.body?.filename || ""));
    if (!target || !isVideoFilename(target)) {
      await fsp.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: "Invalid target filename" });
    }
    const targetPath = path.join(UPLOADS_DIR, target);
    if (!fs.existsSync(targetPath)) {
      await fsp.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: "Target video not found" });
    }
    // Overwrite target in place; preserves the public URL so references keep working.
    await fsp.copyFile(req.file.path, targetPath);
    await fsp.unlink(req.file.path).catch(() => {});
    const st = await fsp.stat(targetPath);
    res.json({
      ok: true,
      filename: target,
      url: `${UPLOADS_PUBLIC_BASE}/${target}`,
      size: st.size,
    });
  } catch (e) { next(e); }
});

adminRouter.delete("/videos/:filename", async (req, res, next) => {
  try {
    const filename = path.basename(String(req.params.filename || ""));
    if (!filename || !isVideoFilename(filename)) return res.status(400).json({ error: "Invalid filename" });
    const p = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(p)) await fsp.unlink(p);
    res.json({ ok: true });
  } catch (e) { next(e); }


});

// ---------- Subcategories ----------
const subSchema = z.object({
  category_id: z.number().int().positive(),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(80),
  name: z.string().min(1).max(160),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});
adminRouter.get("/subcategories", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, c.slug AS category_slug FROM subcategories s JOIN categories c ON c.id = s.category_id ORDER BY s.sort_order, s.name`
  );
  res.json(rows);
});
adminRouter.post("/subcategories", async (req, res) => {
  const p = subSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const [r] = await pool.query(
    `INSERT INTO subcategories (category_id, slug, name, sort_order) VALUES (?,?,?,?)`,
    [p.data.category_id, p.data.slug, p.data.name, p.data.sort_order]
  );
  res.status(201).json({ id: r.insertId });
});
adminRouter.patch("/subcategories/:id", async (req, res) => {
  const p = subSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const entries = Object.entries(p.data);
  if (entries.length === 0) return res.json({ ok: true });
  await pool.query(
    `UPDATE subcategories SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
    [...entries.map(([, v]) => v), req.params.id]
  );
  res.json({ ok: true });
});
adminRouter.delete("/subcategories/:id", async (req, res) => {
  await pool.query(`DELETE FROM subcategories WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

// ---------- Addon groups & options ----------
const groupSchema = z.object({
  product_id: z.number().int().positive(),
  name: z.string().min(1).max(120),
  selection_type: z.enum(["single", "multi"]).default("single"),
  is_required: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});
const optionSchema = z.object({
  group_id: z.number().int().positive(),
  name: z.string().min(1).max(120),
  price: z.number().nonnegative().max(99999).default(0),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});

adminRouter.get("/products/:id/addons", async (req, res) => {
  const [groups] = await pool.query(
    `SELECT * FROM addon_groups WHERE product_id = ? ORDER BY sort_order`,
    [req.params.id]
  );
  const [opts] = await pool.query(
    `SELECT o.* FROM addon_options o JOIN addon_groups g ON g.id = o.group_id WHERE g.product_id = ? ORDER BY o.sort_order`,
    [req.params.id]
  );
  res.json(groups.map((g) => ({ ...g, options: opts.filter((o) => o.group_id === g.id) })));
});

// All addon groups with options + sizes (flattened across products) for admin Menu.
adminRouter.get("/addons", async (_req, res) => {
  const [groups] = await pool.query(
    `SELECT g.id, g.product_id, p.name AS product_name, p.slug AS product_slug,
            c.slug AS category_slug, g.name, g.selection_type AS type,
            g.is_required, g.is_sized AS sized, g.sort_order
     FROM addon_groups g
     JOIN products p ON p.id = g.product_id
     JOIN categories c ON c.id = p.category_id
     ORDER BY g.name, g.sort_order`
  );
  const [opts] = await pool.query(
    `SELECT id, group_id, name, price, sort_order FROM addon_options ORDER BY sort_order, name`
  );
  const [sizes] = await pool.query(
    `SELECT id, option_id, slug, name, price, sort_order FROM addon_option_sizes ORDER BY sort_order`
  );
  res.json(groups.map((g) => ({
    ...g,
    is_required: !!g.is_required,
    sized: !!g.sized,
    options: opts.filter((o) => o.group_id === g.id).map((o) => ({
      ...o, price: Number(o.price),
      sizes: sizes.filter((s) => s.option_id === o.id).map((s) => ({ ...s, price: Number(s.price) })),
    })),
  })));
});

adminRouter.post("/addon-groups", async (req, res) => {
  const p = groupSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const [r] = await pool.query(
    `INSERT INTO addon_groups (product_id, name, selection_type, is_required, sort_order) VALUES (?,?,?,?,?)`,
    [p.data.product_id, p.data.name, p.data.selection_type, p.data.is_required ? 1 : 0, p.data.sort_order]
  );
  res.status(201).json({ id: r.insertId });
});
adminRouter.delete("/addon-groups/:id", async (req, res) => {
  await pool.query(`DELETE FROM addon_groups WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});
adminRouter.post("/addon-options", async (req, res) => {
  const p = optionSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const [r] = await pool.query(
    `INSERT INTO addon_options (group_id, name, price, sort_order) VALUES (?,?,?,?)`,
    [p.data.group_id, p.data.name, p.data.price, p.data.sort_order]
  );
  res.status(201).json({ id: r.insertId });
});
adminRouter.patch("/addon-options/:id", async (req, res) => {
  const p = optionSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const entries = Object.entries(p.data);
  if (entries.length === 0) return res.json({ ok: true });
  await pool.query(
    `UPDATE addon_options SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
    [...entries.map(([, v]) => v), req.params.id]
  );
  res.json({ ok: true });
});
adminRouter.delete("/addon-options/:id", async (req, res) => {
  await pool.query(`DELETE FROM addon_options WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});
adminRouter.patch("/addon-option-sizes/:id", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(60).optional(),
    price: z.number().nonnegative().max(99999).optional(),
    sort_order: z.number().int().min(0).max(9999).optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const entries = Object.entries(p.data);
  if (entries.length === 0) return res.json({ ok: true });
  await pool.query(
    `UPDATE addon_option_sizes SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
    [...entries.map(([, v]) => v), req.params.id]
  );
  res.json({ ok: true });
});

// ---------- Addon bucket scope (hierarchical category/subcategory multiselect) ----------
// A "bucket" groups addon_groups across products that share (name, selection_type, is_sized).
// Bucket key (URL-encoded by client) = `${name}|${type}|${sized}` where sized is "true"/"false".
function parseBucketKey(raw) {
  const k = decodeURIComponent(raw || "");
  const idx1 = k.lastIndexOf("|");
  const idx0 = k.lastIndexOf("|", idx1 - 1);
  if (idx0 < 0 || idx1 < 0) return null;
  const name = k.slice(0, idx0);
  const type = k.slice(idx0 + 1, idx1);
  const sizedRaw = k.slice(idx1 + 1);
  const sized = sizedRaw === "true" || sizedRaw === "1";
  if (!name || !["single", "multi"].includes(type)) return null;
  return { name, type, sized };
}

async function productsInBucket({ name, type, sized }) {
  const [rows] = await pool.query(
    `SELECT g.product_id, p.category_id, p.subcategory_id
       FROM addon_groups g
       JOIN products p ON p.id = g.product_id
      WHERE g.name = ? AND g.selection_type = ? AND g.is_sized = ?`,
    [name, type, sized ? 1 : 0]
  );
  return rows;
}

adminRouter.get("/addon-buckets/:bucketKey/scope", async (req, res) => {
  const key = parseBucketKey(req.params.bucketKey);
  if (!key) return res.status(400).json({ error: "Bad bucket key" });
  const bucketProducts = await productsInBucket(key);
  const productIds = new Set(bucketProducts.map((r) => r.product_id));

  const [allProducts] = await pool.query(
    `SELECT id, category_id, subcategory_id FROM products WHERE is_active = 1`
  );
  const byCat = new Map();
  const bySub = new Map();
  for (const pr of allProducts) {
    if (!byCat.has(pr.category_id)) byCat.set(pr.category_id, []);
    byCat.get(pr.category_id).push(pr);
    if (pr.subcategory_id != null) {
      if (!bySub.has(pr.subcategory_id)) bySub.set(pr.subcategory_id, []);
      bySub.get(pr.subcategory_id).push(pr);
    }
  }

  const subcategoryIds = [];
  for (const [subId, list] of bySub) {
    if (list.length && list.every((pr) => productIds.has(pr.id))) subcategoryIds.push(subId);
  }
  const categoryIds = [];
  for (const [catId, list] of byCat) {
    if (list.length && list.every((pr) => productIds.has(pr.id))) categoryIds.push(catId);
  }

  res.json({ categoryIds, subcategoryIds });
});

adminRouter.put("/addon-buckets/sync", async (req, res) => {
  const schema = z.object({
    templateGroupId: z.number().int().positive(),
    categoryIds: z.array(z.number().int().positive()).default([]),
    subcategoryIds: z.array(z.number().int().positive()).default([]),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });

  const [tplRows] = await pool.query(
    `SELECT id, name, selection_type, is_required, is_sized, sort_order
       FROM addon_groups WHERE id = ? LIMIT 1`,
    [p.data.templateGroupId]
  );
  if (!tplRows.length) return res.status(404).json({ error: "Template group not found" });
  const tpl = tplRows[0];
  const bucketKey = { name: tpl.name, type: tpl.selection_type, sized: !!tpl.is_sized };

  const targetIds = new Set();
  if (p.data.categoryIds.length) {
    const [rows] = await pool.query(
      `SELECT id FROM products WHERE is_active = 1 AND category_id IN (?)`,
      [p.data.categoryIds]
    );
    rows.forEach((r) => targetIds.add(r.id));
  }
  if (p.data.subcategoryIds.length) {
    const [rows] = await pool.query(
      `SELECT id FROM products WHERE is_active = 1 AND subcategory_id IN (?)`,
      [p.data.subcategoryIds]
    );
    rows.forEach((r) => targetIds.add(r.id));
  }

  const current = await productsInBucket(bucketKey);
  const currentIds = new Set(current.map((r) => r.product_id));

  const [tplOpts] = await pool.query(
    `SELECT id, name, price, sort_order FROM addon_options WHERE group_id = ? ORDER BY sort_order`,
    [tpl.id]
  );
  const optIds = tplOpts.map((o) => o.id);
  const tplSizes = optIds.length
    ? (await pool.query(
        `SELECT option_id, slug, name, price, sort_order FROM addon_option_sizes WHERE option_id IN (?) ORDER BY sort_order`,
        [optIds]
      ))[0]
    : [];

  let created = 0, removed = 0;

  for (const pid of current.map((r) => r.product_id)) {
    if (targetIds.has(pid)) continue;
    await pool.query(
      `DELETE FROM addon_groups WHERE product_id = ? AND name = ? AND selection_type = ? AND is_sized = ?`,
      [pid, bucketKey.name, bucketKey.type, bucketKey.sized ? 1 : 0]
    );
    removed++;
  }

  for (const pid of targetIds) {
    if (currentIds.has(pid)) continue;
    const [r] = await pool.query(
      `INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
       VALUES (?,?,?,?,?,?)`,
      [pid, tpl.name, tpl.selection_type, tpl.is_required ? 1 : 0, tpl.is_sized ? 1 : 0, tpl.sort_order]
    );
    const newGroupId = r.insertId;
    for (const o of tplOpts) {
      const [or] = await pool.query(
        `INSERT INTO addon_options (group_id, name, price, sort_order) VALUES (?,?,?,?)`,
        [newGroupId, o.name, o.price, o.sort_order]
      );
      const newOptId = or.insertId;
      const sizes = tplSizes.filter((s) => s.option_id === o.id);
      for (const s of sizes) {
        await pool.query(
          `INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order) VALUES (?,?,?,?,?)`,
          [newOptId, s.slug, s.name, s.price, s.sort_order]
        );
      }
    }
    created++;
  }

  res.json({ ok: true, created, removed });
});

// ---------- Bucket-level option helpers ----------
// Find all addon_groups belonging to a bucket (name|type|sized).
async function groupsInBucket({ name, type, sized }) {
  const [rows] = await pool.query(
    `SELECT id FROM addon_groups WHERE name = ? AND selection_type = ? AND is_sized = ?`,
    [name, type, sized ? 1 : 0]
  );
  return rows.map((r) => r.id);
}

// Create a new addon bucket from scratch: builds a group on each in-scope product,
// each with the same options (and optional size tiers when `sized` is true).
adminRouter.post("/addon-buckets", async (req, res) => {
  const sizeSchema = z.object({
    slug: z.string().min(1).max(40),
    name: z.string().min(1).max(60),
    price: z.number().nonnegative().max(99999).default(0),
  });
  const optSchema = z.object({
    name: z.string().min(1).max(120),
    price: z.number().nonnegative().max(99999).default(0),
    sizes: z.array(sizeSchema).optional().default([]),
  });
  const schema = z.object({
    name: z.string().min(1).max(120),
    selection_type: z.enum(["single", "multi"]).default("single"),
    is_required: z.boolean().optional().default(false),
    sized: z.boolean().optional().default(false),
    categoryIds: z.array(z.number().int().positive()).default([]),
    subcategoryIds: z.array(z.number().int().positive()).default([]),
    options: z.array(optSchema).min(1),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });

  const targetIds = new Set();
  if (p.data.categoryIds.length) {
    const [rows] = await pool.query(
      `SELECT id FROM products WHERE is_active = 1 AND category_id IN (?)`,
      [p.data.categoryIds]
    );
    rows.forEach((r) => targetIds.add(r.id));
  }
  if (p.data.subcategoryIds.length) {
    const [rows] = await pool.query(
      `SELECT id FROM products WHERE is_active = 1 AND subcategory_id IN (?)`,
      [p.data.subcategoryIds]
    );
    rows.forEach((r) => targetIds.add(r.id));
  }
  if (targetIds.size === 0) return res.status(400).json({ error: "Select at least one category or subcategory with active products." });

  let created = 0;
  for (const pid of targetIds) {
    const [gr] = await pool.query(
      `INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order)
       VALUES (?,?,?,?,?,?)`,
      [pid, p.data.name, p.data.selection_type, p.data.is_required ? 1 : 0, p.data.sized ? 1 : 0, 0]
    );
    const gid = gr.insertId;
    for (let i = 0; i < p.data.options.length; i++) {
      const o = p.data.options[i];
      const [or] = await pool.query(
        `INSERT INTO addon_options (group_id, name, price, sort_order) VALUES (?,?,?,?)`,
        [gid, o.name, o.price, i]
      );
      if (p.data.sized) {
        for (let j = 0; j < (o.sizes || []).length; j++) {
          const s = o.sizes[j];
          await pool.query(
            `INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order) VALUES (?,?,?,?,?)`,
            [or.insertId, s.slug, s.name, s.price, j]
          );
        }
      }
    }
    created++;
  }
  res.status(201).json({ ok: true, created });
});

// Add an option (with optional sizes) to every group in a bucket.
adminRouter.post("/addon-buckets/:bucketKey/options", async (req, res) => {
  const key = parseBucketKey(req.params.bucketKey);
  if (!key) return res.status(400).json({ error: "Bad bucket key" });
  const sizeSchema = z.object({
    slug: z.string().min(1).max(40),
    name: z.string().min(1).max(60),
    price: z.number().nonnegative().max(99999).default(0),
  });
  const schema = z.object({
    name: z.string().min(1).max(120),
    price: z.number().nonnegative().max(99999).default(0),
    sizes: z.array(sizeSchema).optional().default([]),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });

  const groupIds = await groupsInBucket(key);
  if (groupIds.length === 0) return res.status(404).json({ error: "Bucket has no groups" });

  let added = 0;
  for (const gid of groupIds) {
    const [or] = await pool.query(
      `INSERT INTO addon_options (group_id, name, price, sort_order) VALUES (?,?,?,?)`,
      [gid, p.data.name, p.data.price, 999]
    );
    if (key.sized) {
      for (let j = 0; j < (p.data.sizes || []).length; j++) {
        const s = p.data.sizes[j];
        await pool.query(
          `INSERT INTO addon_option_sizes (option_id, slug, name, price, sort_order) VALUES (?,?,?,?,?)`,
          [or.insertId, s.slug, s.name, s.price, j]
        );
      }
    }
    added++;
  }
  res.status(201).json({ ok: true, added });
});

// Rename/reprice an option across every group in a bucket. Matches by current name.
adminRouter.patch("/addon-buckets/:bucketKey/options", async (req, res) => {
  const key = parseBucketKey(req.params.bucketKey);
  if (!key) return res.status(400).json({ error: "Bad bucket key" });
  const schema = z.object({
    oldName: z.string().min(1).max(120),
    newName: z.string().min(1).max(120).optional(),
    price: z.number().nonnegative().max(99999).optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });

  const groupIds = await groupsInBucket(key);
  if (groupIds.length === 0) return res.json({ ok: true, updated: 0 });

  const sets = [];
  const vals = [];
  if (p.data.newName !== undefined) { sets.push("name = ?"); vals.push(p.data.newName); }
  if (p.data.price !== undefined) { sets.push("price = ?"); vals.push(p.data.price); }
  if (sets.length === 0) return res.json({ ok: true, updated: 0 });

  const [r] = await pool.query(
    `UPDATE addon_options SET ${sets.join(", ")} WHERE group_id IN (?) AND name = ?`,
    [...vals, groupIds, p.data.oldName]
  );
  res.json({ ok: true, updated: r.affectedRows });
});

// ---------- Reviews / Testimonials ----------
const reviewSchema = z.object({
  name: z.string().min(1).max(160),
  role: z.string().max(160).optional().default(""),
  quote: z.string().min(1).max(2000),
  avatar_url: z.string().max(500).optional().default(""),
  rating: z.number().int().min(1).max(5).optional().default(5),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});

adminRouter.get("/reviews", async (_req, res) => {
  const [rows] = await pool.query(`SELECT * FROM reviews ORDER BY sort_order ASC, id ASC`);
  res.json(rows.map((r) => ({ ...r, is_active: !!r.is_active })));
});
adminRouter.post("/reviews", async (req, res) => {
  const p = reviewSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const d = p.data;
  const [r] = await pool.query(
    `INSERT INTO reviews (name, role, quote, avatar_url, rating, is_active, sort_order) VALUES (?,?,?,?,?,?,?)`,
    [d.name, d.role, d.quote, d.avatar_url, d.rating, d.is_active ? 1 : 0, d.sort_order]
  );
  res.status(201).json({ id: r.insertId });
});
adminRouter.patch("/reviews/:id", async (req, res) => {
  const p = reviewSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const data = { ...p.data };
  if (typeof data.is_active === "boolean") data.is_active = data.is_active ? 1 : 0;
  const entries = Object.entries(data);
  if (entries.length === 0) return res.json({ ok: true });
  await pool.query(
    `UPDATE reviews SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
    [...entries.map(([, v]) => v), req.params.id]
  );
  res.json({ ok: true });
});
adminRouter.delete("/reviews/:id", async (req, res) => {
  await pool.query(`DELETE FROM reviews WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});


