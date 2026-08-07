/**
 * Admin RBAC: roles and per-page permissions.
 *
 * Roles: super (is_super=1), admin, kitchen_manager, counter_sales
 *
 * SUPER_ONLY_PAGES (users) can only be granted to the super admin.
 */

export const ROLES = ["admin", "kitchen_manager", "counter_sales", "store_manager", "seo_manager", "guest"];

export const ROLE_LABELS = {
  admin: "Admin",
  kitchen_manager: "Kitchen Manager",
  counter_sales: "Counter Sales",
  store_manager: "Store Manager",
  seo_manager: "SEO Manager",
  guest: "Guest (Read-only)",
  super: "Super Admin",
};

// Roles that are restricted to read-only operations across the admin API.
// Enforced globally by a middleware that rejects non-GET requests.
export const READ_ONLY_ROLES = new Set(["guest"]);

export function isReadOnlyRole(role) {
  return READ_ONLY_ROLES.has(role);
}

/**
 * Single source of truth for RBAC-controlled admin pages.
 * To expose a new admin page in the Users / Role Permissions UI,
 * just append one entry here — PAGE_KEYS and PAGE_LABELS are derived.
 */
export const ADMIN_PAGES = [
  { key: "orders", label: "Orders" },
  { key: "menu", label: "Menu" },
  { key: "inventory", label: "Inventory" },
  { key: "reports", label: "Reports" },
  { key: "media", label: "Media" },
  { key: "newsletter", label: "Newsletter" },
  { key: "customers", label: "Customers" },
  { key: "reviews", label: "Reviews" },
  { key: "submissions", label: "Submissions" },
  { key: "coupons", label: "Coupons" },
  { key: "promotions", label: "Promotions" },
  { key: "offers", label: "Offers" },
  { key: "seo", label: "SEO Tools" },
  { key: "page-images", label: "Page Images" },
  { key: "settings", label: "Settings" },
  { key: "users", label: "Users" },
  { key: "attendance", label: "Staff Attendance" },
];

export const PAGE_KEYS = ADMIN_PAGES.map((p) => p.key);
export const PAGE_LABELS = Object.fromEntries(ADMIN_PAGES.map((p) => [p.key, p.label]));

// Kept for backward-compat with older imports; nothing is super-only anymore.
export const SUPER_ONLY_PAGES = [];


const ROLE_DEFAULTS = {
  admin: PAGE_KEYS.slice(),
  kitchen_manager: ["orders", "menu", "inventory"],
  counter_sales: ["orders", "reports", "coupons", "offers"],
  store_manager: ["orders", "menu", "inventory", "reports", "media", "newsletter", "reviews", "submissions", "coupons", "offers", "attendance"],
  seo_manager: ["media", "newsletter", "reviews", "submissions", "seo", "settings"],
  // Guest mirrors Admin's page list but the API enforces read-only.
  guest: PAGE_KEYS.slice(),
};

export function defaultPermissionsForRole(role) {
  return (ROLE_DEFAULTS[role] || []).slice();
}

export function parsePermissions(raw) {
  if (!raw) return null;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(v)) return v.filter((k) => PAGE_KEYS.includes(k));
    return null;
  } catch { return null; }
}

export function roleSettingKey(role) {
  return `role_perms:${role}`;
}

export async function getRolePermissions(pool, role) {
  if (role === "super") return null;
  try {
    const [rows] = await pool.query("SELECT v FROM site_settings WHERE k = ?", [roleSettingKey(role)]);
    return parsePermissions(rows[0]?.v);
  } catch { return null; }
}

export async function setRolePermissions(pool, role, perms) {
  const k = roleSettingKey(role);
  const v = perms === null ? null : JSON.stringify(perms);
  if (v === null) {
    await pool.query("DELETE FROM site_settings WHERE k = ?", [k]);
    return;
  }
  await pool.query(
    "INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
    [k, v],
  );
}

export function effectivePermissions(user) {
  if (!user) return [];
  if (user.is_super) return [...PAGE_KEYS, ...SUPER_ONLY_PAGES];
  const stored = parsePermissions(user.permissions);
  return stored ?? defaultPermissionsForRole(user.role || "admin");
}

export async function effectivePermissionsAsync(pool, user) {
  if (!user) return [];
  if (user.is_super) return [...PAGE_KEYS, ...SUPER_ONLY_PAGES];
  const role = user.role || "admin";
  const perUser = parsePermissions(user.permissions);
  if (perUser) return perUser;
  const roleOverride = await getRolePermissions(pool, role);
  return roleOverride ?? defaultPermissionsForRole(role);
}
