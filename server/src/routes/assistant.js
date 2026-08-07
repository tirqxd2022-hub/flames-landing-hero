/**
 * Admin AI Assistant — chat + tool calling via configured AI providers.
 *
 * - Read tools execute immediately on the server.
 * - Write tools return a "pending approval" payload. The frontend renders an
 *   approval card; on Approve it POSTs to /admin/assistant/execute which runs
 *   the real mutation. No delete tools exist.
 */
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../auth.js";

export const assistantRouter = Router();

let aiSdkPromise = null;
async function loadAiSdk() {
  aiSdkPromise ||= (async () => {
    const ai = await import("ai");
    let createGoogleGenerativeAI = null;
    let createOpenAICompatible = null;
    try {
      ({ createGoogleGenerativeAI } = await import("@ai-sdk/google"));
    } catch (e) {
      console.warn("[assistant] @ai-sdk/google not installed — Gemini disabled:", e?.message);
    }
    try {
      ({ createOpenAICompatible } = await import("@ai-sdk/openai-compatible"));
    } catch (e) {
      console.warn("[assistant] @ai-sdk/openai-compatible not installed — OpenAI/Groq/DeepSeek disabled:", e?.message);
    }
    return {
      generateText: ai.generateText,
      tool: ai.tool,
      stepCountIs: ai.stepCountIs,
      createGoogleGenerativeAI,
      createOpenAICompatible,
    };
  })();
  return aiSdkPromise;
}


function gate(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: "Unauthorized" });
  if (!(req.admin.is_super || req.admin.role === "admin")) {
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
}

const PROVIDER_DEFAULTS = {
  gemini:   { model: "gemini-2.5-flash" },
  openai:   { baseURL: "https://api.openai.com/v1/",                                model: "gpt-4o-mini" },
  groq:     { baseURL: "https://api.groq.com/openai/v1/",                           model: "llama-3.3-70b-versatile" },
  deepseek: { baseURL: "https://api.deepseek.com/v1/",                              model: "deepseek-chat" },
};

async function loadAiConfig() {
  // Per-provider keys + models, plus a fallback order. DB overrides env.
  const cfg = {
    order: String(process.env.AI_FALLBACK_ORDER || "groq,gemini,openai,deepseek")
      .split(",").map((s) => s.trim().toLowerCase()).filter((s) => s in PROVIDER_DEFAULTS),
    providers: {},
  };
  for (const p of Object.keys(PROVIDER_DEFAULTS)) {
    cfg.providers[p] = {
      apiKey: process.env[`AI_${p.toUpperCase()}_KEY`] || "",
      model: process.env[`AI_${p.toUpperCase()}_MODEL`] || PROVIDER_DEFAULTS[p].model,
    };
  }
  // Legacy single-provider env fallback (gemini).
  if (!cfg.providers.gemini.apiKey && process.env.GEMINI_API_KEY) {
    cfg.providers.gemini.apiKey = process.env.GEMINI_API_KEY;
  }
  if (process.env.GEMINI_MODEL) cfg.providers.gemini.model = process.env.GEMINI_MODEL;

  try {
    const [rows] = await pool.query(
      "SELECT k, v FROM site_settings WHERE k LIKE 'ai\\_%' ESCAPE '\\\\'",
    );
    for (const r of rows) {
      const v = (r.v || "").trim();
      if (!v) continue;
      if (r.k === "ai_fallback_order") {
        const order = v.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s in PROVIDER_DEFAULTS);
        if (order.length) cfg.order = order;
      } else {
        const m = r.k.match(/^ai_(gemini|openai|groq|deepseek)_(key|model)$/);
        if (m) {
          const [, prov, field] = m;
          cfg.providers[prov][field === "key" ? "apiKey" : "model"] = v;
        }
      }
    }
  } catch { /* ignore — table may not exist yet */ }
  // Safety: Groq's small-context models (e.g. openai/gpt-oss-20b, llama-3.1-8b-instant)
  // routinely 413 on Xpert's tool-heavy system prompt. Force a large-context model.
  const groqModel = (cfg.providers.groq.model || "").toLowerCase();
  if (/gpt-oss|8b-instant|llama-3\.1-8b/.test(groqModel)) {
    cfg.providers.groq.model = "llama-3.3-70b-versatile";
  }
  return cfg;
}

function buildModel(ai, providerName, providerCfg) {
  const def = PROVIDER_DEFAULTS[providerName];
  if (providerName === "gemini") {
    if (!ai.createGoogleGenerativeAI) {
      throw new Error("@ai-sdk/google not installed on server — run `npm install` in the server directory");
    }
    const google = ai.createGoogleGenerativeAI({ apiKey: providerCfg.apiKey });
    return google(providerCfg.model || def.model);
  }
  if (!ai.createOpenAICompatible) {
    throw new Error("@ai-sdk/openai-compatible not installed on server — run `npm install` in the server directory");
  }
  const p = ai.createOpenAICompatible({
    name: providerName,
    baseURL: def.baseURL,
    headers: { Authorization: `Bearer ${providerCfg.apiKey}` },
  });
  return p(providerCfg.model || def.model);
}



function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// ---------- Read tool implementations ----------

async function readListCategories() {
  const [rows] = await pool.query(
    "SELECT id, slug, name, availability, sort_order, is_featured FROM categories ORDER BY sort_order, name",
  );
  return rows;
}

async function readListProducts({ categoryId, subcategoryId, search, limit = 50 }) {
  const where = [];
  const params = [];
  if (categoryId) { where.push("p.category_id = ?"); params.push(categoryId); }
  if (subcategoryId) { where.push("p.subcategory_id = ?"); params.push(subcategoryId); }
  if (search) { where.push("(p.name LIKE ? OR p.slug LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  const sql = `SELECT p.id, p.slug, p.name, p.price, p.is_active, p.is_veg,
                      p.category_id, p.subcategory_id, c.name AS category_name,
                      s.name AS subcategory_name, LEFT(p.description, 140) AS description_preview
                 FROM products p
                 LEFT JOIN categories c ON c.id = p.category_id
                 LEFT JOIN subcategories s ON s.id = p.subcategory_id
                 ${where.length ? "WHERE " + where.join(" AND ") : ""}
                 ORDER BY p.name LIMIT ?`;
  params.push(Math.min(Number(limit) || 50, 200));
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function readGetProduct({ id, slug }) {
  const key = id ? "p.id = ?" : "p.slug = ?";
  const [[product]] = await pool.query(
    `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE ${key} LIMIT 1`,
    [id ?? slug],
  );
  if (!product) return { error: "Product not found" };
  const [variants] = await pool.query(
    "SELECT id, name, price, is_base, sort_order FROM product_variants WHERE product_id = ? ORDER BY sort_order, id",
    [product.id],
  );
  return { product, variants };
}

async function readListSubcategories({ categoryId } = {}) {
  const where = categoryId ? "WHERE category_id = ?" : "";
  const [rows] = await pool.query(
    `SELECT id, slug, name, category_id, sort_order FROM subcategories ${where} ORDER BY sort_order, name`,
    categoryId ? [categoryId] : [],
  );
  return rows;
}

async function readListCoupons() {
  const [rows] = await pool.query(
    "SELECT id, code, type, value, is_active, expires_at, usage_limit, used_count FROM coupons ORDER BY created_at DESC LIMIT 100",
  );
  return rows;
}

async function readListOffers() {
  const [rows] = await pool.query(
    "SELECT id, slug, type, name, is_active, priority FROM offers ORDER BY priority DESC, id DESC LIMIT 100",
  );
  return rows;
}

async function readListAddonGroups({ productId }) {
  const [groups] = await pool.query(
    "SELECT id, product_id, name, selection_type, is_required, is_sized, sort_order FROM addon_groups WHERE product_id = ? ORDER BY sort_order, id",
    [productId],
  );
  if (!groups.length) return [];
  const ids = groups.map((g) => g.id);
  const [opts] = await pool.query(
    `SELECT id, group_id, name, price, sort_order FROM addon_options WHERE group_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order, id`,
    ids,
  );
  return groups.map((g) => ({ ...g, options: opts.filter((o) => o.group_id === g.id) }));
}

async function readListVariants({ productId }) {
  const [rows] = await pool.query(
    "SELECT id, product_id, name, price, is_base, sort_order FROM product_variants WHERE product_id = ? ORDER BY sort_order, id",
    [productId],
  );
  return rows;
}



async function readSalesReport({ from, to }) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal),0) AS subtotal
       FROM orders
      WHERE status NOT IN ('cancelled')
        AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [from, to],
  );
  return { from, to, orders: Number(row.orders), subtotal: Number(row.subtotal) };
}

async function readTopProducts({ from, to, limit = 10 }) {
  const [rows] = await pool.query(
    `SELECT oi.product_name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('cancelled')
        AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY oi.product_name
      ORDER BY qty DESC LIMIT ?`,
    [from, to, Math.min(Number(limit) || 10, 50)],
  );
  return rows.map((r) => ({ ...r, qty: Number(r.qty), revenue: Number(r.revenue) }));
}

// ---------- Write tool executors (called after approval) ----------

const writeExecutors = {
  async create_category(args) {
    const slug = args.slug || slugify(args.name);
    const [r] = await pool.query(
      `INSERT INTO categories (slug, name, description, image_url, sort_order, is_featured, availability)
       VALUES (?,?,?,?,?,?,?)`,
      [slug, args.name, args.description || "", args.image_url || "", args.sort_order || 0,
        args.is_featured ? 1 : 0, args.availability || "available"],
    );
    return { id: r.insertId, slug };
  },
  async update_category(args) {
    const fields = {};
    for (const k of ["name", "description", "image_url", "sort_order", "is_featured", "availability"]) {
      if (args[k] !== undefined) fields[k] = k === "is_featured" ? (args[k] ? 1 : 0) : args[k];
    }
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    await pool.query(
      `UPDATE categories SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },
  async create_product(args) {
    const slug = args.slug || slugify(args.name);
    const [r] = await pool.query(
      `INSERT INTO products (slug, category_id, subcategory_id, name, description, long_description, price, image_url, is_veg, is_active, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [slug, args.category_id, args.subcategory_id ?? null, args.name,
        args.description || "", args.long_description || "", args.price,
        args.image_url || "", args.is_veg !== false ? 1 : 0, args.is_active !== false ? 1 : 0,
        args.sort_order || 0],
    );
    return { id: r.insertId, slug };
  },
  async update_product(args) {
    const fields = {};
    for (const k of ["name", "description", "long_description", "price", "image_url", "is_active", "is_veg", "category_id", "subcategory_id", "sort_order"]) {
      if (args[k] !== undefined) fields[k] = (k === "is_active" || k === "is_veg") ? (args[k] ? 1 : 0) : args[k];
    }
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    await pool.query(
      `UPDATE products SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },
  async create_coupon(args) {
    const [r] = await pool.query(
      `INSERT INTO coupons (code, description, type, value, max_discount, min_subtotal,
        starts_at, expires_at, usage_limit, per_customer_limit, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [args.code.toUpperCase(), args.description || "", args.type, args.value,
        args.max_discount ?? null, args.min_subtotal ?? 0,
        args.starts_at || null, args.expires_at || null,
        args.usage_limit ?? null, args.per_customer_limit ?? null,
        args.is_active !== false ? 1 : 0],
    );
    return { id: r.insertId, code: args.code.toUpperCase() };
  },
  async update_coupon(args) {
    const fields = {};
    for (const k of ["description", "value", "max_discount", "min_subtotal", "expires_at", "usage_limit", "is_active"]) {
      if (args[k] !== undefined) fields[k] = k === "is_active" ? (args[k] ? 1 : 0) : args[k];
    }
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    await pool.query(
      `UPDATE coupons SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },
  async create_offer(args) {
    const slug = args.slug || slugify(args.name);
    const [r] = await pool.query(
      `INSERT INTO offers (slug, type, name, description, image_url, config, is_active,
        priority, stackable, starts_at, expires_at, days_of_week, time_from, time_to,
        dining_option, max_uses_per_order, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [slug, args.type, args.name, args.description || "", args.image_url || "",
        JSON.stringify(args.config || {}), args.is_active !== false ? 1 : 0,
        args.priority ?? 0, args.stackable ? 1 : 0,
        args.starts_at || null, args.expires_at || null,
        args.days_of_week ?? 127, args.time_from || null, args.time_to || null,
        args.dining_option || "any", args.max_uses_per_order ?? null,
        args.sort_order ?? 0],
    );
    return { id: r.insertId, slug };
  },

  async create_subcategory(args) {
    const slug = args.slug || slugify(args.name);
    const [r] = await pool.query(
      "INSERT INTO subcategories (category_id, slug, name, sort_order) VALUES (?,?,?,?)",
      [args.category_id, slug, args.name, args.sort_order || 0],
    );
    return { id: r.insertId, slug };
  },
  async update_subcategory(args) {
    const fields = {};
    for (const k of ["name", "category_id", "sort_order"]) {
      if (args[k] !== undefined) fields[k] = args[k];
    }
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    await pool.query(
      `UPDATE subcategories SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },

  async create_addon_group(args) {
    const [r] = await pool.query(
      "INSERT INTO addon_groups (product_id, name, selection_type, is_required, is_sized, sort_order) VALUES (?,?,?,?,?,?)",
      [args.product_id, args.name, args.selection_type || "single",
        args.is_required ? 1 : 0, args.is_sized ? 1 : 0, args.sort_order || 0],
    );
    return { id: r.insertId };
  },
  async update_addon_group(args) {
    const fields = {};
    for (const k of ["name", "selection_type", "is_required", "is_sized", "sort_order"]) {
      if (args[k] !== undefined) fields[k] = (k === "is_required" || k === "is_sized") ? (args[k] ? 1 : 0) : args[k];
    }
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    await pool.query(
      `UPDATE addon_groups SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },
  async create_addon_option(args) {
    const [r] = await pool.query(
      "INSERT INTO addon_options (group_id, name, price, sort_order) VALUES (?,?,?,?)",
      [args.group_id, args.name, args.price ?? 0, args.sort_order || 0],
    );
    return { id: r.insertId };
  },
  async update_addon_option(args) {
    const fields = {};
    for (const k of ["name", "price", "sort_order"]) {
      if (args[k] !== undefined) fields[k] = args[k];
    }
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    await pool.query(
      `UPDATE addon_options SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },

  async create_variant(args) {
    if (args.is_base) {
      await pool.query("UPDATE product_variants SET is_base = 0 WHERE product_id = ?", [args.product_id]);
    }
    const [r] = await pool.query(
      "INSERT INTO product_variants (product_id, name, price, is_base, sort_order) VALUES (?,?,?,?,?)",
      [args.product_id, args.name, args.price, args.is_base ? 1 : 0, args.sort_order || 0],
    );
    await pool.query("UPDATE products SET product_type = 'variable' WHERE id = ?", [args.product_id]);
    return { id: r.insertId };
  },
  async update_variant(args) {
    const fields = {};
    for (const k of ["name", "price", "is_base", "sort_order"]) {
      if (args[k] !== undefined) fields[k] = k === "is_base" ? (args[k] ? 1 : 0) : args[k];
    }
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    if (fields.is_base === 1) {
      const [[v]] = await pool.query("SELECT product_id FROM product_variants WHERE id = ?", [args.id]);
      if (v) await pool.query("UPDATE product_variants SET is_base = 0 WHERE product_id = ? AND id <> ?", [v.product_id, args.id]);
    }
    await pool.query(
      `UPDATE product_variants SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },
  async update_offer(args) {
    const fields = {};
    for (const k of ["name", "description", "image_url", "is_active", "priority", "stackable",
      "starts_at", "expires_at", "days_of_week", "time_from", "time_to", "dining_option",
      "max_uses_per_order", "sort_order"]) {
      if (args[k] !== undefined) fields[k] = (k === "is_active" || k === "stackable") ? (args[k] ? 1 : 0) : args[k];
    }
    if (args.config !== undefined) fields.config = JSON.stringify(args.config);
    const entries = Object.entries(fields);
    if (!entries.length) return { ok: true, noop: true };
    await pool.query(
      `UPDATE offers SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...entries.map(([, v]) => v), args.id],
    );
    return { ok: true, id: args.id };
  },
};

// ---------- Zod schemas (also used to validate /execute payloads) ----------

const writeSchemas = {
  create_category: z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    description: z.string().optional(),
    image_url: z.string().optional(),
    sort_order: z.number().int().optional(),
    is_featured: z.boolean().optional(),
    availability: z.enum(["available", "unavailable", "upcoming"]).optional(),
  }),
  update_category: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    description: z.string().optional(),
    image_url: z.string().optional(),
    sort_order: z.number().int().optional(),
    is_featured: z.boolean().optional(),
    availability: z.enum(["available", "unavailable", "upcoming"]).optional(),
  }),
  create_product: z.object({
    name: z.string().min(1),
    category_id: z.number().int().positive(),
    subcategory_id: z.number().int().positive().nullable().optional(),
    price: z.number().nonnegative(),
    slug: z.string().optional(),
    description: z.string().max(500).optional(),
    long_description: z.string().max(2000).optional(),
    image_url: z.string().optional(),
    is_veg: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
  update_product: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    description: z.string().max(500).optional(),
    long_description: z.string().max(2000).optional(),
    price: z.number().nonnegative().optional(),
    image_url: z.string().optional(),
    is_active: z.boolean().optional(),
    is_veg: z.boolean().optional(),
    category_id: z.number().int().positive().optional(),
    subcategory_id: z.number().int().positive().nullable().optional(),
    sort_order: z.number().int().optional(),
  }),
  create_coupon: z.object({
    code: z.string().min(2),
    type: z.enum(["percent", "fixed"]),
    value: z.number().nonnegative(),
    description: z.string().optional(),
    max_discount: z.number().nonnegative().nullable().optional(),
    min_subtotal: z.number().nonnegative().optional(),
    starts_at: z.string().optional(),
    expires_at: z.string().optional(),
    usage_limit: z.number().int().nonnegative().nullable().optional(),
    per_customer_limit: z.number().int().nonnegative().nullable().optional(),
    is_active: z.boolean().optional(),
  }),
  update_coupon: z.object({
    id: z.number().int().positive(),
    description: z.string().optional(),
    value: z.number().nonnegative().optional(),
    max_discount: z.number().nonnegative().nullable().optional(),
    min_subtotal: z.number().nonnegative().optional(),
    expires_at: z.string().optional(),
    usage_limit: z.number().int().nonnegative().nullable().optional(),
    is_active: z.boolean().optional(),
  }),
  create_offer: z.object({
    name: z.string().min(1),
    type: z.enum(["cart_percent", "cart_amount", "bogo", "buy_x_get_y"]),
    config: z.record(z.any()).describe("Type-specific rules. cart_percent: {percent:number, min_subtotal?:number}. cart_amount: {amount:number, min_subtotal?:number}. bogo: {trigger_product_ids:number[], reward_product_ids:number[]}. buy_x_get_y: {trigger:{product_ids?:number[],category_ids?:number[],qty:number,min_subtotal?:number}, reward:{product_ids?:number[],category_ids?:number[],qty:number,discount_type:'free'|'percent'|'fixed',discount_value?:number}}"),
    slug: z.string().optional(),
    description: z.string().max(500).optional(),
    image_url: z.string().optional(),
    is_active: z.boolean().optional(),
    priority: z.number().int().optional(),
    stackable: z.boolean().optional(),
    starts_at: z.string().optional(),
    expires_at: z.string().optional(),
    days_of_week: z.number().int().min(0).max(127).optional(),
    time_from: z.string().optional(),
    time_to: z.string().optional(),
    dining_option: z.enum(["any", "dine_in", "takeout", "delivery"]).optional(),
    max_uses_per_order: z.number().int().nonnegative().nullable().optional(),
    sort_order: z.number().int().optional(),
  }),
  update_offer: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    description: z.string().max(500).optional(),
    image_url: z.string().optional(),
    config: z.record(z.any()).optional(),
    is_active: z.boolean().optional(),
    priority: z.number().int().optional(),
    stackable: z.boolean().optional(),
    starts_at: z.string().optional(),
    expires_at: z.string().optional(),
    days_of_week: z.number().int().min(0).max(127).optional(),
    time_from: z.string().optional(),
    time_to: z.string().optional(),
    dining_option: z.enum(["any", "dine_in", "takeout", "delivery"]).optional(),
    max_uses_per_order: z.number().int().nonnegative().nullable().optional(),
    sort_order: z.number().int().optional(),
  }),

  create_subcategory: z.object({
    category_id: z.number().int().positive(),
    name: z.string().min(1),
    slug: z.string().optional(),
    sort_order: z.number().int().optional(),
  }),
  update_subcategory: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    category_id: z.number().int().positive().optional(),
    sort_order: z.number().int().optional(),
  }),
  create_addon_group: z.object({
    product_id: z.number().int().positive(),
    name: z.string().min(1),
    selection_type: z.enum(["single", "multi"]).optional(),
    is_required: z.boolean().optional(),
    is_sized: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
  update_addon_group: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    selection_type: z.enum(["single", "multi"]).optional(),
    is_required: z.boolean().optional(),
    is_sized: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
  create_addon_option: z.object({
    group_id: z.number().int().positive(),
    name: z.string().min(1),
    price: z.number().nonnegative().optional(),
    sort_order: z.number().int().optional(),
  }),
  update_addon_option: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    price: z.number().nonnegative().optional(),
    sort_order: z.number().int().optional(),
  }),
  create_variant: z.object({
    product_id: z.number().int().positive(),
    name: z.string().min(1),
    price: z.number().nonnegative(),
    is_base: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
  update_variant: z.object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    price: z.number().nonnegative().optional(),
    is_base: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
};

// ---------- AI SDK tools (passed to generateText) ----------

// Xpert is now an advisor only — no tools, no writes. Keeping the function
// stub so the call site keeps working; returning {} means a tiny prompt and
// no function-calling quota usage on Gemini/Groq/OpenAI.
function makeTools(_toolFn) { return {}; }


const SYSTEM_PROMPT = `You are "Xpert", a warm, friendly System Expert for
the Flames Gourmet admin panel (flamesgourmet.ca — a Toronto restaurant and
packaged-food brand). You were appointed by Prithwish (prith001@gmail.com).
Introduce yourself as Xpert on the first greeting and keep a cheerful,
conversational tone — like a helpful colleague, not a manual.

You're happy to chat about anything — small talk, jokes, brainstorming,
general questions about food, business, tech, life. Engage naturally; you
don't have to steer every conversation back to the admin panel.

When the user does need help with the system, your role is ADVISORY ONLY.
You guide admins, managers and kitchen staff — you do NOT make changes
yourself (no creating, editing or deleting anything). If asked to perform an
action, gently say you'll walk them through it instead, then guide them.

For multi-step tasks — especially creating an order, generating a coupon, or
building an offer — guide the user STEP BY STEP:
- Ask ONE question at a time, wait for the answer, then move to the next step.
- Confirm each choice in plain English before moving on.
- Name the exact admin page and button to click at each step
  (e.g. "Admin → Coupons → click 'New Coupon'").
- At the end, give a short recap of what they should now see on screen.

What you can help with:
- How to use any page in /admin (Menu, Orders, Coupons, Offers, Promotions,
  Reports, Customers, Newsletter, Media, Page Images, SEO, Settings, RBAC).
- How storefront features work: pre-orders (visible to kitchen 30 min before
  scheduled time), online-payment-only checkout, 1 km delivery radius,
  unpaid-order auto-cancel after 30 min, offers/coupons, hero video, etc.
- Delivery: Uber Direct dispatch is triggered automatically when a delivery
  order is marked Paid. The checkout has a Pickup/Delivery toggle with
  Photon address autocomplete and a live delivery quote. The quoted fee is
  persisted on the order so it stays consistent everywhere. A configurable
  delivery packaging fee is added on top. Uber Direct has separate Sandbox
  and Live keys in Settings → Delivery, and live tests run with is_draft.
- Tracking: customers can look up any order at /track (linked from footer)
  by number, name, phone or address, and open a live Leaflet map via the
  "Open live tracking" button. Delivery ID is visible in all order views.
- Payments: Create Order shows a Cash Received field with real-time Change
  calculation; both values are saved and printed on receipts. COD is
  disabled for online orders but works at the counter.
- Order Type column: Counter orders show "To Stay"/"To Go", online orders
  show "Pickup"/"Delivery". "Punched by" is hidden for online orders.
- Editing: the pencil icon on any order (admin or customer /orders) opens
  the shared Edit Order dialog; typing in the new item name shows matching
  menu items with their prices.
- Create Order has a "Virtual Keyboard" checkbox next to the Order heading
  — when on, all inputs open a touch keyboard / numeric pad; the setting
  is remembered per browser.
- All dates/times are displayed in America/Toronto with clear Date/Time
  labels. Settings is a tabbed layout with Save buttons at top and bottom.
- Step-by-step "how do I…" answers, troubleshooting, and best-practice tips
  (e.g. when to use a BOGO vs a percentage discount).
- Casual conversation, greetings, brainstorming — go ahead and chat.


Style: warm, brief, plain English. Use short markdown lists when steps help.
No emojis, no JSON, no code blocks, no internal field names, no tables.
If something is genuinely a new feature request, say once: "That's something
Prithwish would need to build — you can send him a note using the Feedback
button at the top." Don't repeat that line.`;



// Some weaker models (Groq llama-3.1-8b, etc.) leak fake tool-call syntax into
// the text reply instead of using the real tool interface. Strip those so the
// user never sees raw <function:...>{...}</function> blocks.
function stripLeakedToolSyntax(s) {
  if (!s) return s;
  let out = s;
  out = out.replace(/<function[:=][^>]*>[\s\S]*?<\/function>/gi, "");
  out = out.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
  out = out.replace(/<\|python_tag\|>[\s\S]*?(?=<\||$)/gi, "");
  return out.trim();
}

// ---------- Rate limit (very lightweight, in-memory) ----------
const hits = new Map();
function rateLimit(key, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now); hits.set(key, arr); return true;
}

// ============= Routes =============

assistantRouter.post("/assistant/chat", requireAdmin, gate, async (req, res, next) => {
  try {
    if (!rateLimit(`u:${req.admin.sub}`)) return res.status(429).json({ error: "Too many requests" });
    const body = z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })).min(1).max(80),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid messages" });

    // Live snapshot: refreshed on every request so the model always sees the
    // current catalog shape without needing a tool call for trivial questions.
    let snapshot = "";
    try {
      const [cats, subs, [{ n: productCount } = { n: 0 }]] = await Promise.all([
        readListCategories(),
        readListSubcategories(),
        pool.query("SELECT COUNT(*) AS n FROM products WHERE is_active = 1").then(([r]) => r),
      ]);
      const catLines = cats.map((c) => {
        const kids = subs.filter((s) => s.category_id === c.id).map((s) => `${s.name} (#${s.id})`).join(", ");
        return `  - #${c.id} ${c.name} [${c.availability}]${kids ? ` -> ${kids}` : ""}`;
      }).join("\n");
      snapshot = `# Live catalog snapshot (refreshed now)
Active products: ${productCount}
Categories and subcategories (use these ids for write tools):
${catLines}`;
    } catch (e) {
      console.warn("[assistant] snapshot failed", e?.message);
    }

    const ai = await loadAiSdk();
    const cfg = await loadAiConfig();
    const candidates = cfg.order
      .map((name) => ({ name, ...cfg.providers[name] }))
      .filter((c) => c.apiKey);
    if (!candidates.length) {
      return res.status(500).json({ error: "No AI provider keys configured. Add one in Settings → AI Providers (super admin)." });
    }

    function extractUpstream(e) {
      const rb = e?.responseBody || e?.data || e?.cause?.responseBody;
      if (!rb) return "";
      try {
        const p = typeof rb === "string" ? JSON.parse(rb) : rb;
        return p?.error?.message || p?.error?.code || p?.error || (typeof rb === "string" ? rb : JSON.stringify(rb));
      } catch { return typeof rb === "string" ? rb : ""; }
    }
    function isQuotaLike(status, upstreamMsg) {
      const m = String(upstreamMsg || "").toLowerCase();
      return status === 429 || status === 402
        || m.includes("insufficient_quota") || m.includes("quota") || m.includes("rate limit")
        || m.includes("billing") || m.includes("credits") || m.includes("prepayment");
    }

    let result = null;
    let lastErr = null;
    const attempts = [];
    for (const c of candidates) {
      try {
        result = await ai.generateText({
          model: buildModel(ai, c.name, c),
          system: snapshot ? `${SYSTEM_PROMPT}\n\n${snapshot}` : SYSTEM_PROMPT,
          messages: body.data.messages,
          // Xpert is advisory only — no tools bound, keeps payload tiny.

          maxOutputTokens: 4096,
          maxRetries: 0,

        });
        attempts.push({ provider: c.name, model: c.model, ok: true });
        break;
      } catch (e) {
        lastErr = e;
        const status = e?.statusCode || e?.status || e?.response?.status;
        const upstream = extractUpstream(e);
        attempts.push({ provider: c.name, model: c.model, status, error: e?.message, upstream: String(upstream).slice(0, 200) });
        console.warn(`[assistant] provider ${c.name} failed (${status || "?"})`, e?.message, upstream);
        // Fall back on auth / rate-limit / quota / 5xx / network errors. Schema/tool validation = stop.
        const transient = status === 401 || status === 403
          || (status >= 500 && status <= 599) || !status
          || isQuotaLike(status, upstream);
        if (!transient) break;
      }
    }

    if (!result) {
      const e = lastErr || new Error("All providers failed");
      const status = e?.statusCode || e?.status || e?.response?.status;
      const upstream = extractUpstream(e);
      const tried = attempts.map((a) => `${a.provider}(${a.status || "err"}${a.upstream ? `: ${a.upstream.slice(0,80)}` : ""})`).join("  →  ");
      const allQuota = attempts.length > 0 && attempts.every((a) => isQuotaLike(a.status, a.upstream));
      const hint = allQuota
        ? "\n\nAll configured providers returned a quota/billing error. OpenAI has no free tier (a brand-new key still needs billing/credits). Gemini fails the same way once a project is on Tier-1 Prepay with no balance. The only truly free option here is Groq — create a key at https://console.groq.com/keys and paste it into Settings → AI Providers → Groq API key."
        : "";
      const msg = `${e?.message || "Assistant failed"}${upstream ? `: ${String(upstream).slice(0, 400)}` : ""}\n\nTried: ${tried}${hint}`;
      return res.status(status && status >= 400 && status < 600 ? status : 500).json({ error: msg });
    }

    const pendingApprovals = [];


    let text = stripLeakedToolSyntax(result.text || "");
    if (!text && !pendingApprovals.length) {
      // Some models (e.g. Groq llama-3.1-8b-instant) occasionally return an
      // empty final message when tools are bound. Give the user something
      // useful instead of a silent bubble.
      const usedProvider = attempts.find((a) => a.ok)?.provider || "the model";
      text = `_(${usedProvider} returned an empty response. Try rephrasing your question, or switch to a stronger model in Settings → AI Providers — e.g. Groq \`llama-3.3-70b-versatile\`.)_`;
    }
    res.json({ text, pendingApprovals, attempts });
  } catch (e) {
    console.error("[assistant/chat]", e);
    res.status(500).json({ error: e?.message || "Assistant failed" });
  }
});



// Xpert is advisory-only — write/execute is permanently disabled.
assistantRouter.post("/assistant/execute", requireAdmin, gate, async (_req, res) => {
  res.status(410).json({ error: "Xpert is advisory only and cannot make changes. Please use the relevant admin page." });
});

