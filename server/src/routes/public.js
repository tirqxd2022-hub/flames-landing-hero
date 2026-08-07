import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { pool } from "../db.js";
import { publicSettingsRouter } from "./settings.js";
import { verifyAnyToken } from "../lib/jwt-user.js";
import { resolveImageUrl } from "../lib/uploads.js";
import { sendEmail } from "../lib/email.js";
import { publicCouponsRouter, getCouponByCode, evaluateCoupon } from "./coupons.js";
import { publicOffersRouter } from "./offers.js";
import { publicPromotionsRouter } from "./promotions.js";
import { publicPageImagesRouter } from "./page-images.js";
import { deliveryPublicRouter } from "./delivery.js";
import { dispatchOrderToCourier } from "../lib/uber-direct.js";

async function getSetting(k) {
  try {
    const [rows] = await pool.query(`SELECT v FROM site_settings WHERE k = ? LIMIT 1`, [k]);
    return rows[0]?.v || "";
  } catch { return ""; }
}
async function notifyTo() {
  return process.env.SMTP_NOTIFY_TO || (await getSetting("contact_email")) || process.env.SMTP_USER || "";
}
/**
 * Collect every address that should receive a new contact-form notification:
 *  - SMTP_NOTIFY_TO env value
 *  - contact_email site setting
 *  - every admin_users.email (so newly-added admins automatically receive future submissions)
 * De-duplicates case-insensitively and returns plain lowercase emails.
 */
async function contactRecipients() {
  const set = new Map();
  const add = (v) => {
    if (!v) return;
    String(v).split(/[,;]\s*/).forEach((raw) => {
      const e = raw.trim();
      if (!e) return;
      const k = e.toLowerCase();
      if (!set.has(k)) set.set(k, e);
    });
  };
  add(process.env.SMTP_NOTIFY_TO);
  add(await getSetting("contact_email"));
  try {
    const [rows] = await pool.query(
      "SELECT email FROM admin_users WHERE email IS NOT NULL AND email <> ''",
    );
    rows.forEach((r) => add(r.email));
  } catch { /* table may not exist yet */ }
  if (set.size === 0) add(process.env.SMTP_USER);
  return [...set.values()];
}
function absoluteUrl(maybePath) {
  if (!maybePath) return "";
  if (/^https?:\/\//i.test(maybePath)) return maybePath;
  const base = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (!base) return maybePath;
  return `${base}${maybePath.startsWith("/") ? "" : "/"}${maybePath}`;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const withImg = (r) => ({ ...r, image: resolveImageUrl(r.image) });
const withAvatar = (r) => ({ ...r, avatarUrl: resolveImageUrl(r.avatarUrl) });

export const publicRouter = Router();
publicRouter.use(publicSettingsRouter);
publicRouter.use(publicCouponsRouter);
publicRouter.use(publicPromotionsRouter);
publicRouter.use(publicPageImagesRouter);
publicRouter.use(publicOffersRouter);
publicRouter.use(deliveryPublicRouter);


publicRouter.get("/categories", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT c.slug, c.name, c.description, c.image_url AS image, c.is_featured AS isFeatured,
            c.availability,
            sc.slug AS sideCategorySlug,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS itemCount
     FROM categories c
     LEFT JOIN categories sc ON sc.id = c.side_category_id
     ORDER BY c.sort_order ASC, c.name ASC`
  );
  res.json(rows.map((r) => withImg({ ...r, isFeatured: !!r.isFeatured })));
});

publicRouter.get("/categories/:slug/subcategories", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.slug, s.name, s.sort_order
     FROM subcategories s JOIN categories c ON c.id = s.category_id
     WHERE c.slug = ? ORDER BY s.sort_order ASC, s.name ASC`,
    [req.params.slug]
  );
  res.json(rows);
});

async function attachPublicVariants(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r._id).filter(Boolean);
  if (!ids.length) return rows;
  const [vrows] = await pool.query(
    `SELECT id, product_id, name, price, is_base, sort_order
       FROM product_variants WHERE product_id IN (?) ORDER BY product_id, sort_order, id`,
    [ids],
  );
  const map = new Map();
  for (const v of vrows) {
    const arr = map.get(v.product_id) || [];
    arr.push({ id: v.id, name: v.name, price: Number(v.price), isBase: !!v.is_base });
    map.set(v.product_id, arr);
  }
  for (const r of rows) {
    const vs = map.get(r._id) || [];
    if (r.productType === "variable" && vs.length) {
      const base = vs.find((x) => x.isBase) || vs[0];
      r.price = base.price;
      r.variants = vs;
    }
    delete r._id;
  }
  return rows;
}

publicRouter.get("/products", async (_req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  const [rows] = await pool.query(
    `SELECT p.id AS _id, p.slug, p.name, c.slug AS categorySlug, s.slug AS subcategorySlug,
            p.description, p.long_description AS longDescription,
            p.price, p.image_url AS image, p.is_veg AS isVeg, p.is_featured AS isFeatured, p.rating,
            p.product_type AS productType
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN subcategories s ON s.id = p.subcategory_id
     WHERE p.is_active = 1
     ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC`
  );
  await attachPublicVariants(rows);
  res.json(rows.map((r) => withImg({ ...r, isVeg: !!r.isVeg, isFeatured: !!r.isFeatured })));
});

publicRouter.get("/categories/:slug/products", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  const [rows] = await pool.query(
    `SELECT p.id AS _id, p.slug, p.name, c.slug AS categorySlug, s.slug AS subcategorySlug,
            p.description, p.long_description AS longDescription,
            p.price, p.image_url AS image, p.is_veg AS isVeg, p.rating,
            p.product_type AS productType
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN subcategories s ON s.id = p.subcategory_id
     WHERE c.slug = ? AND p.is_active = 1
     ORDER BY p.sort_order ASC, p.name ASC`,
    [req.params.slug]
  );
  await attachPublicVariants(rows);
  res.json(rows.map((r) => withImg({ ...r, isVeg: !!r.isVeg })));
});

publicRouter.get("/products/:slug", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  const [rows] = await pool.query(
    `SELECT p.id, p.slug, p.name, c.slug AS categorySlug, s.slug AS subcategorySlug,
            p.description, p.long_description AS longDescription, p.nutrition_json AS nutritionJson,
            p.price, p.image_url AS image, p.is_veg AS isVeg, p.rating,
            p.product_type AS productType
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN subcategories s ON s.id = p.subcategory_id
     WHERE p.slug = ? LIMIT 1`,
    [req.params.slug]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });
  let nutrition = null;
  if (rows[0].nutritionJson) {
    try { nutrition = JSON.parse(rows[0].nutritionJson); } catch { nutrition = null; }
  }
  const product = { ...rows[0], image: resolveImageUrl(rows[0].image), isVeg: !!rows[0].is_veg, nutrition };
  delete product.nutritionJson;

  if (product.productType === "variable") {
    const [vrows] = await pool.query(
      `SELECT id, name, price, is_base FROM product_variants
        WHERE product_id = ? ORDER BY sort_order, id`,
      [product.id],
    );
    product.variants = vrows.map((v) => ({ id: v.id, name: v.name, price: Number(v.price), isBase: !!v.is_base }));
    const base = product.variants.find((v) => v.isBase) || product.variants[0];
    if (base) product.price = base.price;
  }
  const [groups] = await pool.query(
    `SELECT id, name, selection_type AS type, is_required AS required, is_sized AS sized, sort_order
     FROM addon_groups WHERE product_id = ? ORDER BY sort_order`,
    [product.id]
  );

  // Addon "buckets" group addon_groups across products by (name, type, sized).
  // The admin manages options at the bucket level, but each product still owns
  // its own addon_groups rows whose option lists can drift. To keep the
  // storefront in sync with the bucket, we union options across every group in
  // the same bucket and dedupe by option name (preferring rows that belong to
  // this product's group so its own IDs/prices win).
  product.addons = [];
  for (const g of groups) {
    const [opts] = await pool.query(
      `SELECT o.id, o.group_id, o.name, o.price, o.sort_order
         FROM addon_options o
         JOIN addon_groups g2 ON g2.id = o.group_id
        WHERE g2.name = ? AND g2.selection_type = ? AND g2.is_sized = ?
        ORDER BY (o.group_id = ?) DESC, o.sort_order, o.id`,
      [g.name, g.type, g.sized ? 1 : 0, g.id]
    );
    const seen = new Map(); // name -> option row (first wins, ours first)
    for (const o of opts) {
      const key = o.name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, o);
    }
    const chosen = [...seen.values()];
    const optionIds = chosen.map((o) => o.id);
    let sizesByOpt = new Map();
    if (optionIds.length) {
      const [sizes] = await pool.query(
        `SELECT option_id, slug, name, price, sort_order
           FROM addon_option_sizes WHERE option_id IN (?) ORDER BY sort_order`,
        [optionIds]
      );
      for (const sz of sizes) {
        const arr = sizesByOpt.get(sz.option_id) || [];
        arr.push({ id: sz.slug, name: sz.name, price: Number(sz.price) });
        sizesByOpt.set(sz.option_id, arr);
      }
    }
    product.addons.push({
      id: String(g.id),
      name: g.name,
      type: g.type,
      required: !!g.required,
      sized: !!g.sized,
      options: chosen.map((o) => {
        const oSizes = sizesByOpt.get(o.id) || [];
        return {
          id: String(o.id),
          name: o.name,
          price: Number(o.price),
          ...(oSizes.length ? { sizes: oSizes } : {}),
        };
      }),
    });
  }

  delete product.id;
  res.json(product);
});

const orderSchema = z.object({
  customerName: z.string().trim().max(80).optional().default(""),
  customerPhone: z.string().trim().max(20).optional().default(""),
  pickupTime: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(["cash", "debit", "credit"]).nullable().optional(),
  cashReceived: z.number().nonnegative().max(1000000).optional(),
  diningOption: z.enum(["to_go", "to_stay", "delivery"]).optional(),
  // Delivery-only fields
  deliveryAddress: z.string().trim().max(500).optional(),
  deliveryInstructions: z.string().trim().max(500).optional(),
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  // Quoted delivery fee (in dollars) shown to the customer at checkout.
  deliveryFee: z.number().nonnegative().max(10000).optional(),
  paid: z.boolean().optional(),
  couponCode: z.string().trim().max(40).optional(),
  isPreorder: z.boolean().optional(),
  // ISO datetime when the customer wants the pre-order ready.
  preorderAt: z.string().datetime({ offset: true }).optional().nullable(),
  items: z.array(z.object({
    productSlug: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(50),
    name: z.string().max(200).optional(),
    unitPrice: z.number().nonnegative().max(99999).optional(),
    selections: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.record(z.string(), z.string())])).optional(),
  })).min(1).max(50),
});

publicRouter.post("/orders", verifyAnyToken, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Look up only real product slugs (no "::" composite/variant slugs)
    const realSlugs = [...new Set(
      data.items.map((i) => i.productSlug).filter((s) => !s.includes("::"))
    )];
    let productMap = new Map();
    if (realSlugs.length) {
      const [products] = await conn.query(
        `SELECT id, slug, name, price FROM products WHERE slug IN (?) AND is_active = 1`,
        [realSlugs]
      );
      productMap = new Map(products.map((p) => [p.slug, p]));
    }

    // For variant slugs in the form "<baseSlug>::v<variantId>", fetch the
    // variant + base product so we can trust the server-side price/name.
    const variantRefs = data.items
      .map((i) => {
        const m = /^([a-z0-9-]+)::v(\d+)$/i.exec(i.productSlug);
        return m ? { slug: i.productSlug, baseSlug: m[1], variantId: Number(m[2]) } : null;
      })
      .filter(Boolean);
    const variantMap = new Map();
    if (variantRefs.length) {
      const ids = [...new Set(variantRefs.map((v) => v.variantId))];
      const [vrows] = await conn.query(
        `SELECT v.id, v.name AS variantName, v.price, v.product_id, p.slug AS baseSlug, p.name AS baseName, p.is_active
           FROM product_variants v JOIN products p ON p.id = v.product_id
          WHERE v.id IN (?)`,
        [ids]
      );
      for (const v of vrows) {
        if (v.is_active) variantMap.set(`${v.baseSlug}::v${v.id}`, v);
      }
    }

    let subtotal = 0;
    const lines = [];
    for (const it of data.items) {
      const variantHit = variantMap.get(it.productSlug);
      let productId, productName, unit;
      if (variantHit) {
        productId = variantHit.product_id;
        productName = `${variantHit.baseName} — ${variantHit.variantName}`;
        unit = Number(variantHit.price);
      } else {
        const isVariant = it.productSlug.includes("::");
        const baseSlug = isVariant ? it.productSlug.split("::")[1] || it.productSlug.split("::")[0] : it.productSlug;
        const base = productMap.get(isVariant ? baseSlug : it.productSlug);
        productId = base?.id ?? null;
        productName = it.name || base?.name;
        unit = typeof it.unitPrice === "number" ? it.unitPrice : (base ? Number(base.price) : NaN);
      }
      if (!productName || !Number.isFinite(unit)) {
        await conn.rollback();
        return res.status(400).json({ error: `Item unavailable: ${it.productSlug}` });
      }
      const line = unit * it.quantity;
      subtotal += line;
      lines.push({
        product_id: productId,
        product_name: productName,
        unit_price: unit,
        quantity: it.quantity,
        line_total: line,
        selections_json: it.selections ? JSON.stringify(it.selections) : null,
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;

    // ---- Coupon (applied to subtotal, before tax) ----
    let coupon = null;
    let discount = 0;
    let couponCode = null;
    let freeItem = null;
    if (data.couponCode) {
      coupon = await getCouponByCode(data.couponCode);
      const evalRes = await evaluateCoupon(coupon, subtotal, { customerPhone: data.customerPhone });
      if (evalRes.error) {
        await conn.rollback();
        return res.status(400).json({ error: evalRes.error });
      }
      discount = Math.round((evalRes.discount || 0) * 100) / 100;
      freeItem = evalRes.freeItem;
      couponCode = coupon.code;
      if (freeItem) {
        lines.push({
          product_id: freeItem.id,
          product_name: `${freeItem.name} (FREE – ${couponCode})`,
          unit_price: 0,
          quantity: 1,
          line_total: 0,
          selections_json: null,
        });
      }
    }

    // Order number: <YYYYMMDD>-<N>, daily reset, Canada/Eastern timezone.
    const datePrefix = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date()).replace(/-/g, "");
    const [[seqRow]] = await conn.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(order_number, '-', -1) AS UNSIGNED)), 0) AS maxSeq
         FROM orders WHERE order_number LIKE ?`,
      [`${datePrefix}-%`]
    );
    const orderNumber = `${datePrefix}-${(Number(seqRow.maxSeq) || 0) + 1}`;
    const customerId = req.auth?.kind === "customer" ? req.auth.sub : null;
    const createdBy = req.auth?.kind === "admin" ? req.auth.sub : null;
    let staffUsername = null;
    if (createdBy) {
      const [[urow]] = await conn.query("SELECT username FROM admin_users WHERE id = ? LIMIT 1", [createdBy]);
      staffUsername = urow?.username || null;
    }
    const paid = !!data.paid;
    const paymentMethod = paid ? (data.paymentMethod || "cash") : (data.paymentMethod ?? null);
    const diningOption = data.diningOption || "to_go";
    if (diningOption === "delivery" && !(data.deliveryAddress && data.deliveryAddress.trim())) {
      await conn.rollback();
      return res.status(400).json({ error: "Delivery address is required for delivery orders." });
    }
    const isPreorder = !!(data.isPreorder && data.preorderAt);
    const preorderAt = isPreorder ? new Date(data.preorderAt) : null;
    const cashReceived = paid && paymentMethod === "cash" && typeof data.cashReceived === "number" ? data.cashReceived : null;
    const deliveryFeeCents = diningOption === "delivery" && typeof data.deliveryFee === "number"
      ? Math.max(0, Math.round(data.deliveryFee * 100))
      : null;
    const [result] = await conn.query(
      `INSERT INTO orders (order_number, customer_name, customer_phone, pickup_time, notes, subtotal, discount, coupon_code, coupon_id, status, payment_method, cash_received, paid_at, dining_option, customer_id, created_by_admin_id, staff_username, is_preorder, preorder_at, delivery_address, delivery_instructions, delivery_lat, delivery_lng, delivery_fee_cents)
       VALUES (?,?,?,?,?,?,?,?,?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, data.customerName, data.customerPhone, data.pickupTime ?? null, data.notes ?? null, subtotal, discount, couponCode, coupon?.id ?? null, paymentMethod, cashReceived, paid ? new Date() : null, diningOption, customerId, createdBy, staffUsername, isPreorder ? 1 : 0, preorderAt, data.deliveryAddress ?? null, data.deliveryInstructions ?? null, data.deliveryLat ?? null, data.deliveryLng ?? null, deliveryFeeCents],
    );

    const orderId = result.insertId;

    await conn.query(
      `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total, selections_json) VALUES ?`,
      [lines.map((l) => [orderId, l.product_id, l.product_name, l.unit_price, l.quantity, l.line_total, l.selections_json])]
    );

    if (coupon) {
      await conn.query(
        `INSERT INTO coupon_redemptions (coupon_id, order_id, customer_phone, discount) VALUES (?,?,?,?)`,
        [coupon.id, orderId, data.customerPhone, discount],
      );
      await conn.query(`UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`, [coupon.id]);
    }


    await conn.commit();

    // Fire-and-forget owner notification via native SMTP.
    (async () => {
      try {
        const to = await notifyTo();
        if (!to) return;
        const itemsHtml = lines.map((l) => `<tr><td>${escapeHtml(l.product_name)}</td><td style="text-align:center">${l.quantity}</td><td style="text-align:right">$${Number(l.line_total).toFixed(2)}</td></tr>`).join("");
        const itemsText = lines.map((l) => `${l.quantity}× ${l.product_name} — $${Number(l.line_total).toFixed(2)}`).join("\n");
        const siteTitle = (await getSetting("site_title")) || "Flames Gourmet";
        const pkgFee = diningOption === "delivery" ? (parseFloat(await getSetting("delivery_packaging_fee") || "0") || 0) : 0;
        const delFee = deliveryFeeCents != null ? deliveryFeeCents / 100 : 0;
        const feeLinesText = `${delFee > 0 ? `Delivery: $${delFee.toFixed(2)}\n` : ""}${pkgFee > 0 ? `Packaging: $${pkgFee.toFixed(2)}\n` : ""}`;
        const feeLinesHtml = `${delFee > 0 ? `<p><strong>Delivery:</strong> $${delFee.toFixed(2)}</p>` : ""}${pkgFee > 0 ? `<p><strong>Packaging:</strong> $${pkgFee.toFixed(2)}</p>` : ""}`;
        const grandTotalDel = subtotal + pkgFee + delFee;
        const grandText = diningOption === "delivery" ? `Order Total: $${grandTotalDel.toFixed(2)}\n` : "";
        const grandHtml = diningOption === "delivery" ? `<p><strong>Order Total:</strong> $${grandTotalDel.toFixed(2)}</p>` : "";
        const preorderLine = isPreorder ? `Pre-order for: ${preorderAt.toLocaleString("en-CA", { timeZone: "America/Toronto" })}\n` : "";
        const preorderHtml = isPreorder ? `<p style="background:#fff3cd;padding:8px;border-radius:4px"><strong>PRE-ORDER</strong> · Scheduled for ${escapeHtml(preorderAt.toLocaleString("en-CA", { timeZone: "America/Toronto" }))}</p>` : "";
        const subjectTag = isPreorder ? "New PRE-ORDER" : "New order";
        const isDel = diningOption === "delivery";
        const whereText = isDel
          ? `Order Type: Delivery\nDeliver to: ${data.deliveryAddress || "—"}${data.deliveryInstructions ? `\nInstructions: ${data.deliveryInstructions}` : ""}\n`
          : `Pickup: ${data.pickupTime || "—"}\n`;
        const whereHtml = isDel
          ? `<p><strong>Order Type:</strong> Delivery<br/><strong>Deliver to:</strong> ${escapeHtml(data.deliveryAddress || "—")}${data.deliveryInstructions ? `<br/><em>${escapeHtml(data.deliveryInstructions)}</em>` : ""}</p>`
          : `<br/><strong>Pickup:</strong> ${escapeHtml(data.pickupTime || "—")}`;
        await sendEmail({
          to,
          subject: `[${siteTitle}] ${subjectTag} ${orderNumber} — $${(subtotal + pkgFee + delFee).toFixed(2)}`,
          text: `${subjectTag} ${orderNumber}\n${preorderLine}Customer: ${data.customerName} (${data.customerPhone})\n${whereText}Payment: ${paid ? (paymentMethod || "paid") : "unpaid"}\n\n${itemsText}\n\nSubtotal: $${subtotal.toFixed(2)}\n${feeLinesText}${grandText}${data.notes ? `Notes: ${data.notes}\n` : ""}`,
          html: `<h2>${escapeHtml(subjectTag)} ${escapeHtml(orderNumber)}</h2>${preorderHtml}<p><strong>Customer:</strong> ${escapeHtml(data.customerName)} (${escapeHtml(data.customerPhone)})${isDel ? "" : whereHtml}<br/><strong>Payment:</strong> ${paid ? escapeHtml(paymentMethod || "paid") : "unpaid"}</p>${isDel ? whereHtml : ""}<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;width:100%"><thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><p><strong>Subtotal: $${subtotal.toFixed(2)}</strong></p>${feeLinesHtml}${grandHtml}${data.notes ? `<p><em>Notes:</em> ${escapeHtml(data.notes)}</p>` : ""}`,
        });
      } catch (e) { console.error("[order email] failed:", e?.message); }
    })();

    // Auto-dispatch to Uber Direct for paid delivery orders. For pre-orders we
    // defer until ~45 min before preorder time (kitchen ops will trigger then).
    if (diningOption === "delivery" && paid && !isPreorder) {
      (async () => {
        try {
          await dispatchOrderToCourier(pool, orderId);
        } catch (e) {
          console.error(`[uber dispatch] order ${orderNumber} failed:`, e?.message || e);
        }
      })();
    }

    res.status(201).json({ orderNumber, status: "new", subtotal, discount, couponCode, isPreorder, preorderAt: preorderAt?.toISOString() ?? null, createdAt: new Date().toISOString() });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not place order" });
  } finally {
    conn.release();
  }
});

// Public read-only order lookup (used by the QR code on receipts).
publicRouter.post("/orders/lookup", async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim().slice(0, 120);
    const phone = String(body.phone || "").trim().slice(0, 40);
    const address = String(body.address || "").trim().slice(0, 200);
    const orderNumber = String(body.orderNumber || "").trim().slice(0, 64);
    if (!name && !phone && !address && !orderNumber) {
      return res.status(400).json({ error: "Enter at least one detail to search" });
    }
    // Normalize phone to digits for a loose match.
    const phoneDigits = phone.replace(/\D+/g, "");
    const wheres = [];
    const params = [];
    if (orderNumber) { wheres.push("order_number = ?"); params.push(orderNumber); }
    if (phoneDigits) { wheres.push("REPLACE(REPLACE(REPLACE(REPLACE(customer_phone,' ',''),'-',''),'(',''),')','') LIKE ?"); params.push(`%${phoneDigits}%`); }
    if (name) { wheres.push("LOWER(customer_name) LIKE ?"); params.push(`%${name.toLowerCase()}%`); }
    if (address) { wheres.push("LOWER(delivery_address) LIKE ?"); params.push(`%${address.toLowerCase()}%`); }
    // Prefer undelivered (not picked_up/cancelled) most-recent match.
    const scoreParts = wheres.map((w) => `(CASE WHEN ${w} THEN 1 ELSE 0 END)`).join(" + ");
    const sql = `
      SELECT order_number AS orderNumber, status,
             (${scoreParts}) AS score
        FROM orders
       WHERE (${wheres.join(" OR ")})
       ORDER BY (status NOT IN ('picked_up','cancelled')) DESC,
                score DESC,
                created_at DESC
       LIMIT 1
    `;
    // Params are used twice: once in SELECT score, once in WHERE.
    let rows;
    try {
      [rows] = await pool.query(sql, [...params, ...params]);
    } catch {
      // Fall back if delivery_address column is absent on legacy DBs.
      const wheres2 = wheres.filter((w) => !w.includes("delivery_address"));
      const params2 = [];
      if (orderNumber) params2.push(orderNumber);
      if (phoneDigits) params2.push(`%${phoneDigits}%`);
      if (name) params2.push(`%${name.toLowerCase()}%`);
      if (!wheres2.length) return res.status(404).json({ error: "No matching order found" });
      const scoreParts2 = wheres2.map((w) => `(CASE WHEN ${w} THEN 1 ELSE 0 END)`).join(" + ");
      const sql2 = `SELECT order_number AS orderNumber, status, (${scoreParts2}) AS score
                      FROM orders WHERE (${wheres2.join(" OR ")})
                      ORDER BY (status NOT IN ('picked_up','cancelled')) DESC, score DESC, created_at DESC LIMIT 1`;
      [rows] = await pool.query(sql2, [...params2, ...params2]);
    }
    if (!rows.length) return res.status(404).json({ error: "No matching order found" });
    res.json({ orderNumber: rows[0].orderNumber, status: rows[0].status });
  } catch (e) { next(e); }
});

publicRouter.get("/orders/:orderNumber", async (req, res, next) => {
  try {
    const num = String(req.params.orderNumber || "").trim().slice(0, 64);
    if (!num) return res.status(400).json({ error: "Missing order number" });
    const [orders] = await pool.query(
      `SELECT id AS _id, order_number AS orderNumber, status, subtotal,
              discount, coupon_code AS couponCode,
              customer_name AS customerName, customer_phone AS customerPhone,
              pickup_time AS pickupTime, notes,
              payment_method AS paymentMethod, paid_at AS paidAt,
              dining_option AS diningOption,
              delivery_address AS deliveryAddress,
              delivery_fee_cents AS deliveryFeeCents,
              ready_at AS readyAt, created_at AS createdAt, staff_username AS staffUsername
         FROM orders WHERE order_number = ? LIMIT 1`,
      [num],
    );
    if (!orders.length) return res.status(404).json({ error: "Order not found" });
    const order = orders[0];
    const [items] = await pool.query(
      `SELECT oi.product_name AS productName, oi.unit_price AS unitPrice,
              oi.quantity, oi.line_total AS lineTotal, p.image_url AS image
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE o.order_number = ?`,
      [num],
    );
    let delivery = null;
    if (order.diningOption === "delivery") {
      try {
        const [drows] = await pool.query(
          `SELECT status, delivery_id AS deliveryId, tracking_url AS trackingUrl,
                  courier_name AS courierName, courier_phone AS courierPhone,
                  fee_cents AS feeCents, currency,
                  pickup_eta AS pickupEta, dropoff_eta AS dropoffEta, updated_at AS updatedAt
             FROM deliveries WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
          [order._id],
        );
        if (drows.length) delivery = drows[0];
      } catch { /* deliveries table may not exist yet */ }
      // Ensure the quoted fee stored on the order is always available to the
      // client, even before an Uber Direct dispatch row exists.
      if (order.deliveryFeeCents != null) {
        if (!delivery) delivery = { status: "pending", feeCents: Number(order.deliveryFeeCents) };
        else if (delivery.feeCents == null) delivery.feeCents = Number(order.deliveryFeeCents);
      }
    }
    const deliveryFee = order.deliveryFeeCents != null ? Number(order.deliveryFeeCents) / 100 : null;
    delete order._id;
    delete order.deliveryFeeCents;
    res.json({ ...order, deliveryFee, items: items.map(withImg), delivery });
  } catch (e) { next(e); }
});

publicRouter.get("/reviews", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, role, quote, avatar_url AS avatarUrl, rating
       FROM reviews WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
  );
  res.json(rows.map(withAvatar));
});

// ---------- Contact form: honeypot + math challenge + DB storage ----------
const CHALLENGE_TTL_MS = 10 * 60_000;
const challengeSecret = () => process.env.JWT_SECRET || "dev-secret-change-me";
function signChallenge(answer, exp) {
  const payload = `${answer}.${exp}`;
  const sig = crypto.createHmac("sha256", challengeSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifyChallenge(token, answer) {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [a, exp, sig] = parts;
  if (Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac("sha256", challengeSecret()).update(`${a}.${exp}`).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch { return false; }
  return Number(a) === Number(answer);
}

publicRouter.get("/contact/challenge", (_req, res) => {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const op = Math.random() < 0.5 ? "+" : "−";
  const answer = op === "+" ? a + b : a + b; // both display options resolve to a+b
  // Force addition for simplicity (humans rarely fail single-digit addition).
  const exp = Date.now() + CHALLENGE_TTL_MS;
  res.json({ question: `${a} + ${b}`, token: signChallenge(a + b, exp), expiresAt: exp });
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(2000),
  website: z.string().max(200).optional(),       // honeypot
  mathToken: z.string().max(300).optional(),
  mathAnswer: z.union([z.string(), z.number()]).optional(),
});
const contactLimitMap = new Map(); // ip -> [timestamps]

publicRouter.post("/contact", async (req, res, next) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    // Soft rate limit: 5 / 10 minutes / IP.
    const ip = String(req.ip || req.headers["x-forwarded-for"] || "anon").slice(0, 60);
    const now = Date.now();
    const arr = (contactLimitMap.get(ip) || []).filter((t) => now - t < 10 * 60_000);
    if (arr.length >= 5) return res.status(429).json({ error: "Too many messages, please try again later." });
    arr.push(now); contactLimitMap.set(ip, arr);

    const { name, email, phone, message, website, mathToken, mathAnswer } = parsed.data;
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 250);

    // Spam decisions — honeypot wins, then math.
    let isSpam = false;
    let spamReason = "";
    if (website && website.trim().length > 0) {
      isSpam = true; spamReason = "honeypot";
    } else if (!mathToken || mathAnswer === undefined || !verifyChallenge(mathToken, mathAnswer)) {
      isSpam = true; spamReason = "math";
    }

    const [ins] = await pool.query(
      `INSERT INTO contact_submissions (name, email, phone, message, is_spam, spam_reason, ip, user_agent, sent_to)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [name, email, phone || "", message, isSpam ? 1 : 0, spamReason, ip, userAgent, ""],
    );
    const submissionId = ins.insertId;

    if (isSpam) return res.json({ ok: true });

    const recipients = await contactRecipients();
    if (recipients.length === 0) return res.status(503).json({ error: "Contact email is not configured." });
    const siteTitle = (await getSetting("site_title")) || "Flames Gourmet";
    const logoUrl = absoluteUrl(await getSetting("logo_url"));
    const siteUrl = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    const contactPhone = await getSetting("contact_phone");
    const contactAddr = await getSetting("contact_address");

    // 1) Notify every collected admin / configured address.
    const notifyResult = await sendEmail({
      to: recipients.join(", "),
      subject: `[${siteTitle}] Contact form — ${name}`,
      text: `From: ${name} <${email}>\nPhone: ${phone || "—"}\n\n${message}`,
      html: `<h2>New contact message</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br/>
        <strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });

    // 2) Confirmation back to the sender, with brand-logo signature.
    const signatureHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:1px solid #eee;padding-top:16px;font-family:Arial,Helvetica,sans-serif;color:#555">
        <tr>
          ${logoUrl ? `<td style="vertical-align:middle;padding-right:14px"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(siteTitle)}" width="72" style="display:block;border:0;outline:none;max-width:72px;height:auto"/></td>` : ""}
          <td style="vertical-align:middle;font-size:13px;line-height:1.5">
            <div style="font-weight:700;color:#222;font-size:15px">${escapeHtml(siteTitle)}</div>
            ${contactAddr ? `<div>${escapeHtml(contactAddr)}</div>` : ""}
            ${contactPhone ? `<div>📞 <a href="tel:${escapeHtml(contactPhone.replace(/[^\d+]/g, ""))}" style="color:#555;text-decoration:none">${escapeHtml(contactPhone)}</a></div>` : ""}
            ${siteUrl ? `<div>🌐 <a href="${escapeHtml(siteUrl)}" style="color:#c0392b;text-decoration:none">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a></div>` : ""}
          </td>
        </tr>
      </table>`;
    await sendEmail({
      to: email,
      subject: `Thanks for contacting ${siteTitle}, ${name.split(/\s+/)[0]}!`,
      text:
        `Hi ${name},\n\nThank you for reaching out to ${siteTitle}. We've received your message and a member of our team will get back to you within 1 business day.\n\n` +
        `Here's a copy of what you sent us:\n----------------------------------------\n${message}\n----------------------------------------\n\n` +
        `If your enquiry is urgent, feel free to call us${contactPhone ? ` at ${contactPhone}` : ""}.\n\nWarm regards,\nThe ${siteTitle} Team`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#333;max-width:560px;margin:auto;padding:8px 4px">
          <p style="font-size:15px">Hi ${escapeHtml(name)},</p>
          <p style="font-size:14px;line-height:1.55">
            Thank you for reaching out to <strong>${escapeHtml(siteTitle)}</strong>. We've received your message and a member of our team will get back to you within <strong>1 business day</strong>.
          </p>
          <p style="font-size:14px;line-height:1.55;margin-bottom:6px"><em>Here's a copy of what you sent us:</em></p>
          <blockquote style="margin:0;padding:12px 16px;background:#f7f4ef;border-left:3px solid #c0392b;border-radius:4px;white-space:pre-wrap;font-size:13px;color:#444">${escapeHtml(message)}</blockquote>
          <p style="font-size:14px;line-height:1.55;margin-top:18px">
            If your enquiry is urgent, feel free to call us${contactPhone ? ` at <strong>${escapeHtml(contactPhone)}</strong>` : ""}.
          </p>
          <p style="font-size:14px;margin-top:18px">Warm regards,<br/>The ${escapeHtml(siteTitle)} Team</p>
          ${signatureHtml}
        </div>`,
    });

    // Record delivery status in sent_to so the admin UI surfaces failures
    // instead of silently showing "not sent". When SMTP is misconfigured or
    // the mail server rejects the message, write the reason prefixed with
    // "FAILED:" so it's obvious in the Submissions list.
    if (notifyResult && notifyResult.ok) {
      await pool.query(
        "UPDATE contact_submissions SET sent_to = ? WHERE id = ?",
        [recipients.join(", "), submissionId],
      );
    } else {
      const reason = notifyResult?.skipped
        ? `SKIPPED: ${notifyResult?.error || "SMTP not configured"}`
        : `FAILED: ${notifyResult?.error || "unknown error"}`;
      console.warn(`[contact] notification not delivered for submission ${submissionId}: ${reason}`);
      await pool.query(
        "UPDATE contact_submissions SET sent_to = ? WHERE id = ?",
        [reason.slice(0, 1000), submissionId],
      );
    }

    res.json({ ok: true, delivered: !!notifyResult?.ok, deliveryError: notifyResult?.ok ? undefined : (notifyResult?.error || "unknown") });
  } catch (e) { next(e); }
});

// -----------------------------------------------------------------------------
// Feedback (Help page) — sends to the developer. Lightly rate-limited by IP.
// Accepts HTML (with inline base64 images from paste/upload) plus optional
// sender info. Recipient is hard-coded to the developer's address.
// -----------------------------------------------------------------------------
const FEEDBACK_TO = "prith001@gmail.com";
const feedbackSchema = z.object({
  html: z.string().min(1).max(2_000_000),
  text: z.string().max(200_000).optional(),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  pageUrl: z.string().max(500).optional(),
});
const feedbackLimitMap = new Map();
publicRouter.post("/feedback", async (req, res, next) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const ip = String(req.ip || req.headers["x-forwarded-for"] || "anon").slice(0, 60);
    const now = Date.now();
    const arr = (feedbackLimitMap.get(ip) || []).filter((t) => now - t < 10 * 60_000);
    if (arr.length >= 8) return res.status(429).json({ error: "Too many feedback submissions, please try again later." });
    arr.push(now); feedbackLimitMap.set(ip, arr);

    const { html, text, fromName, fromEmail, pageUrl } = parsed.data;
    const siteTitle = (await getSetting("site_title")) || "Flames Gourmet";
    const meta = `
      <table style="margin-bottom:14px;font:13px Arial,Helvetica,sans-serif;color:#555">
        <tr><td><strong>Site:</strong></td><td>${escapeHtml(siteTitle)}</td></tr>
        ${fromName ? `<tr><td><strong>From:</strong></td><td>${escapeHtml(fromName)}${fromEmail ? ` &lt;${escapeHtml(fromEmail)}&gt;` : ""}</td></tr>` : ""}
        ${pageUrl ? `<tr><td><strong>Page:</strong></td><td>${escapeHtml(pageUrl)}</td></tr>` : ""}
        <tr><td><strong>Sent:</strong></td><td>${new Date().toISOString()}</td></tr>
      </table><hr/>`;
    const result = await sendEmail({
      to: FEEDBACK_TO,
      subject: `[${siteTitle}] Feedback${fromName ? ` from ${fromName}` : ""}`,
      text: text || "(see HTML version)",
      html: `<div style="font:14px Arial,Helvetica,sans-serif;color:#222;max-width:720px">${meta}${html}</div>`,
    });
    if (!result?.ok) return res.status(502).json({ error: result?.error || "Could not send feedback" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
