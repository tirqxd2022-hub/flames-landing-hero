/**
 * Admin Users management with RBAC.
 *
 * Access is governed by the "users" page permission configured on the Users
 * page itself. Any role that has been granted that permission can manage
 * admin users and role permissions. The Super Admin always passes.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../auth.js";
import {
  ROLES, PAGE_KEYS, PAGE_LABELS,
  parsePermissions, defaultPermissionsForRole,
  getRolePermissions, setRolePermissions,
  effectivePermissionsAsync,
} from "../lib/roles.js";

async function requireUsersPerm(req, res, next) {
  try {
    if (req.admin?.is_super) return next();
    const [rows] = await pool.query(
      "SELECT id, is_super, role, permissions FROM admin_users WHERE id = ? LIMIT 1",
      [req.admin?.sub],
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    const perms = await effectivePermissionsAsync(pool, u);
    if (!perms.includes("users")) return res.status(403).json({ error: "Not authorized" });
    next();
  } catch (e) { next(e); }
}

export const usersRouter = Router();
usersRouter.use(requireAdmin, requireUsersPerm);

function sanitizePermissions(input) {
  if (input == null) return null;
  if (!Array.isArray(input)) return null;
  const set = new Set(input.filter((k) => PAGE_KEYS.includes(k)));
  return Array.from(set);
}


function rowToUser(r) {
  const permissions = parsePermissions(r.permissions);
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role || "admin",
    permissions: permissions ?? defaultPermissionsForRole(r.role || "admin"),
    permissionsCustom: permissions !== null,
    created_at: r.created_at,
    last_login_at: r.last_login_at || null,
  };
}

usersRouter.get("/users", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, email, role, permissions, created_at, last_login_at FROM admin_users WHERE is_super = 0 ORDER BY id DESC",
    );
    res.json({ items: rows.map(rowToUser) });
  } catch (e) { next(e); }
});

const createSchema = z.object({
  username: z.string().trim().min(2).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Username may contain letters, numbers, dot, dash, underscore."),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES).default("admin"),
  permissions: z.array(z.string()).optional(),
});
usersRouter.post("/users", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const [exists] = await pool.query("SELECT id FROM admin_users WHERE username = ?", [parsed.data.username]);
    if (exists.length) return res.status(409).json({ error: "Username already exists." });
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const perms = sanitizePermissions(parsed.data.permissions);
    const [r] = await pool.query(
      "INSERT INTO admin_users (username, email, password_hash, is_super, role, permissions) VALUES (?, ?, ?, 0, ?, ?)",
      [parsed.data.username, parsed.data.email, hash, parsed.data.role, perms ? JSON.stringify(perms) : null],
    );
    res.json({ id: r.insertId });
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  email: z.string().trim().email().max(255).optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(ROLES).optional(),
  permissions: z.array(z.string()).nullable().optional(),
});
usersRouter.put("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT id, is_super, role FROM admin_users WHERE id = ?", [id]);
    const row = rows[0];
    if (!row || row.is_super) return res.status(404).json({ error: "User not found." });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    if (parsed.data.email) await pool.query("UPDATE admin_users SET email = ? WHERE id = ?", [parsed.data.email, id]);
    if (parsed.data.password) {
      const hash = await bcrypt.hash(parsed.data.password, 12);
      await pool.query("UPDATE admin_users SET password_hash = ? WHERE id = ?", [hash, id]);
    }
    if (parsed.data.role) {
      await pool.query("UPDATE admin_users SET role = ? WHERE id = ?", [parsed.data.role, id]);
    }
    if (parsed.data.permissions !== undefined) {
      const perms = parsed.data.permissions === null ? null : sanitizePermissions(parsed.data.permissions);
      await pool.query(
        "UPDATE admin_users SET permissions = ? WHERE id = ?",
        [perms === null ? null : JSON.stringify(perms), id],
      );
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

usersRouter.delete("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (req.admin?.sub === id) return res.status(400).json({ error: "You cannot delete your own account." });
    const [rows] = await pool.query("SELECT id, is_super, role FROM admin_users WHERE id = ?", [id]);
    const row = rows[0];
    if (!row || row.is_super) return res.status(404).json({ error: "User not found." });
    await pool.query("DELETE FROM admin_users WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Role-level page permissions ----
const MANAGEABLE_ROLES = ROLES.slice();

export const rolePermissionsRouter = Router();
rolePermissionsRouter.use(requireAdmin, requireUsersPerm);


rolePermissionsRouter.get("/role-permissions", async (_req, res, next) => {
  try {
    const items = {};
    for (const role of MANAGEABLE_ROLES) {
      const override = await getRolePermissions(pool, role);
      items[role] = {
        permissions: override ?? defaultPermissionsForRole(role),
        custom: override !== null,
        defaults: defaultPermissionsForRole(role),
      };
    }
    const pages = PAGE_KEYS.map((key) => ({ key, label: PAGE_LABELS[key] || key }));
    res.json({ items, pages });
  } catch (e) { next(e); }
});

const rolePermsSchema = z.object({
  role: z.enum(MANAGEABLE_ROLES),
  permissions: z.array(z.string()).nullable(),
});
rolePermissionsRouter.put("/role-permissions", async (req, res, next) => {
  try {
    const parsed = rolePermsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const perms = parsed.data.permissions === null
      ? null
      : Array.from(new Set(parsed.data.permissions.filter((k) => PAGE_KEYS.includes(k))));
    await setRolePermissions(pool, parsed.data.role, perms);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Admin sidebar nav order (Super Admin only) ----
const navOrderSchema = z.object({ order: z.array(z.string().min(1).max(64)).max(64) });
rolePermissionsRouter.put("/nav-order", async (req, res, next) => {
  try {
    const parsed = navOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const v = JSON.stringify(parsed.data.order);
    await pool.query(
      "INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
      ["admin_nav_order", v],
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

