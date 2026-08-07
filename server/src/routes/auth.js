/**
 * Unified login/register: tries admin_users, then customers.
 * Customer self-registration endpoint is preserved for future use,
 * but the frontend currently hides it.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { hasUserJwtSecret, signToken, requireUser } from "../lib/jwt-user.js";
import { effectivePermissionsAsync } from "../lib/roles.js";
import { autoCancelStaleUnpaidOrders } from "../lib/auto-cancel.js";
import { resolveImageUrl } from "../lib/uploads.js";
import { openAttendance, closeAttendance } from "./attendance.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(200),
  check_in: z.boolean().optional().default(false),
});

function adminUserPayload(u, perms) {
  return {
    id: u.id, email: u.email, name: u.full_name || u.username,
    username: u.username, full_name: u.full_name || null,
    phone: u.phone || null, avatar_url: u.avatar_url || null,
    role: u.role || "admin", is_super: !!u.is_super, permissions: perms,
  };
}
function customerPayload(c) {
  return {
    id: c.id, email: c.email, name: c.name, full_name: c.name,
    phone: c.phone || null, avatar_url: c.avatar_url || null,
    role: "customer",
  };
}

authRouter.post("/login", async (req, res, next) => {
  try {
    if (!hasUserJwtSecret()) return res.status(503).json({ error: "JWT_SECRET environment variable is required" });
    const p = loginSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid input" });
    const { email, password, check_in } = p.data;

    const [aRows] = await pool.query(
      `SELECT id, username, email, password_hash, is_super, role, permissions,
              full_name, phone, avatar_url
         FROM admin_users WHERE email = ? OR username = ? LIMIT 1`,
      [email, email],
    );
    if (aRows.length) {
      const u = aRows[0];
      if (await bcrypt.compare(password, u.password_hash)) {
        await pool.query("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?", [u.id]);
        const perms = await effectivePermissionsAsync(pool, u);
        const token = signToken({
          sub: u.id, kind: "admin", email: u.email, username: u.username,
          is_super: !!u.is_super, role: u.role || "admin",
        });
        let attendance = null;
        if (check_in && u.role !== "guest" && !u.is_super) {
          try { attendance = await openAttendance({ userId: u.id, username: u.username, isSuper: !!u.is_super, req }); }
          catch (e) { console.warn("[auth] openAttendance failed:", e.message); }
        }
        return res.json({ token, kind: "admin", user: adminUserPayload(u, perms), attendance });
      }
    }

    const [cRows] = await pool.query(
      "SELECT id, email, name, phone, password_hash, avatar_url FROM customers WHERE email = ? LIMIT 1",
      [email],
    );
    if (cRows.length) {
      const c = cRows[0];
      if (await bcrypt.compare(password, c.password_hash)) {
        await pool.query("UPDATE customers SET last_login_at = NOW() WHERE id = ?", [c.id]);
        const token = signToken({ sub: c.id, kind: "customer", email: c.email });
        return res.json({ token, kind: "customer", user: customerPayload(c) });
      }
    }

    res.status(401).json({ error: "Invalid email or password" });
  } catch (e) { next(e); }
});

const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().default(""),
  password: z.string().min(6).max(200),
  subscribe: z.boolean().optional().default(true),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    if (!hasUserJwtSecret()) return res.status(503).json({ error: "JWT_SECRET environment variable is required" });
    const p = registerSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    const { email, name, phone, password, subscribe } = p.data;
    const emailLower = email.toLowerCase();
    const [dup] = await pool.query("SELECT id FROM customers WHERE email = ?", [emailLower]);
    if (dup.length) return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 12);
    const [r] = await pool.query(
      "INSERT INTO customers (email, name, phone, password_hash, subscribed) VALUES (?,?,?,?,?)",
      [emailLower, name, phone || null, hash, subscribe ? 1 : 0],
    );
    // Mirror into the newsletter mailing list (best-effort; ignore dup).
    if (subscribe) {
      try {
        await pool.query(
          "INSERT IGNORE INTO newsletter_subscribers (email, name, source) VALUES (?, ?, 'signup')",
          [emailLower, name],
        );
      } catch { /* ignore */ }
    }
    const token = signToken({ sub: r.insertId, kind: "customer", email });
    res.status(201).json({
      token, kind: "customer",
      user: customerPayload({ id: r.insertId, email, name, phone, avatar_url: null }),
    });
  } catch (e) { next(e); }
});

// POST /auth/logout — optionally records a check-out. The JWT lives on the
// client, so this endpoint's only server-side effect is closing the shift.
authRouter.post("/logout", requireUser, async (req, res, next) => {
  try {
    const wantCheckOut = req.body?.check_out === true;
    if (wantCheckOut && req.auth.kind === "admin" && !req.auth.is_super) {
      const closed = await closeAttendance({ userId: req.auth.sub, req });
      return res.json({ ok: true, attendance: closed });
    }
    res.json({ ok: true, attendance: null });
  } catch (e) { next(e); }
});

authRouter.get("/me", requireUser, async (req, res, next) => {
  try {
    if (req.auth.kind === "admin") {
      const [rows] = await pool.query(
        `SELECT id, username, email, is_super, role, permissions, full_name, phone, avatar_url
           FROM admin_users WHERE id = ? LIMIT 1`,
        [req.auth.sub],
      );
      const u = rows[0];
      if (!u) return res.status(401).json({ error: "Unknown user" });
      const perms = await effectivePermissionsAsync(pool, u);
      return res.json({ kind: "admin", user: adminUserPayload(u, perms) });
    }
    const [rows] = await pool.query(
      "SELECT id, email, name, phone, avatar_url FROM customers WHERE id = ? LIMIT 1",
      [req.auth.sub],
    );
    const c = rows[0];
    if (!c) return res.status(401).json({ error: "Unknown user" });
    res.json({ kind: "customer", user: customerPayload(c) });
  } catch (e) { next(e); }
});

// ---------- Profile self-update (works for both admin and customer) ----------
const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  avatar_url: z.string().trim().max(500).optional().nullable(),
  email: z.string().trim().email().max(255).optional(),
  current_password: z.string().min(1).max(200).optional(),
  new_password: z.string().min(6).max(200).optional(),
});

authRouter.patch("/profile", requireUser, async (req, res, next) => {
  try {
    const p = profileSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Invalid input" });
    const d = p.data;

    const table = req.auth.kind === "admin" ? "admin_users" : "customers";
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [req.auth.sub]);
    const u = rows[0];
    if (!u) return res.status(404).json({ error: "Account not found" });

    const sets = [];
    const vals = [];

    if (d.full_name !== undefined) {
      if (table === "admin_users") { sets.push("full_name = ?"); vals.push(d.full_name); }
      else { sets.push("name = ?"); vals.push(d.full_name); }
    }
    if (d.phone !== undefined) { sets.push("phone = ?"); vals.push(d.phone || null); }
    if (d.avatar_url !== undefined) { sets.push("avatar_url = ?"); vals.push(d.avatar_url || null); }

    if (d.email && d.email !== u.email) {
      // Uniqueness checks
      const [dup1] = await pool.query("SELECT id FROM admin_users WHERE email = ? AND id <> ?", [d.email, table === "admin_users" ? u.id : 0]);
      const [dup2] = await pool.query("SELECT id FROM customers WHERE email = ? AND id <> ?", [d.email, table === "customers" ? u.id : 0]);
      if (dup1.length || dup2.length) return res.status(409).json({ error: "Email already in use" });
      sets.push("email = ?"); vals.push(d.email);
    }

    if (d.new_password) {
      if (!d.current_password) return res.status(400).json({ error: "Current password required to set a new password" });
      const ok = await bcrypt.compare(d.current_password, u.password_hash);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
      const hash = await bcrypt.hash(d.new_password, 12);
      sets.push("password_hash = ?"); vals.push(hash);
    }

    if (!sets.length) return res.json({ ok: true });
    vals.push(u.id);
    await pool.query(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Customer's own orders.
authRouter.get("/orders/mine", requireUser, async (req, res, next) => {
  try {
    if (req.auth.kind !== "customer") return res.status(403).json({ error: "Customers only" });
    await autoCancelStaleUnpaidOrders(true);
    // IMPORTANT: this SELECT must stay in sync with `GET /admin/orders`
    // (server/src/routes/admin.js) — both endpoints feed into the same
    // shared view-order modal + printed receipt templates on the client,
    // so any column one side needs, the other must return too.
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
         FROM orders o WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT 200`,
      [req.auth.sub],
    );
    const nums = orders.map((o) => o.orderNumber);
    let items = [];
    if (nums.length) {
      const [rows] = await pool.query(
        `SELECT o.order_number AS orderNumber, oi.product_name AS productName,
                oi.unit_price AS unitPrice, oi.quantity, oi.line_total AS lineTotal,
                p.image_url AS image
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE o.order_number IN (?)`,
        [nums],
      );
      items = rows.map((i) => ({ ...i, image: resolveImageUrl(i.image) }));
    }
    res.json(orders.map((o) => ({
      ...o,
      deliveryFee: o.deliveryFeeCents != null ? Number(o.deliveryFeeCents) / 100 : null,
      items: items.filter((i) => i.orderNumber === o.orderNumber),
    })));
  } catch (e) { next(e); }
});
