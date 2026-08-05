// Frontend API client. In Lovable preview VITE_API_URL is undefined → mocks.
// On cPanel set VITE_API_URL=https://api.flamesgourmet.ca (or /api).
import { categories, products, type Category, type Product } from "./mock-data";

const ENV_BASE = import.meta.env.VITE_API_URL as string | undefined;
const HOST = typeof window !== "undefined" ? window.location.hostname : "";
const IS_LOVABLE_HOST = HOST.endsWith(".lovable.app") || HOST === "lovable.app";
const BASE = ENV_BASE || (IS_LOVABLE_HOST ? undefined : "/api");

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error("MOCK_ONLY");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) };
  const token = localStorage.getItem("fg_auth_token") || localStorage.getItem("admin_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...init, headers });
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") msg = body.error;
    } catch {
      // ignore — keep generic message
    }
    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("fg_auth_token");
      if (typeof window !== "undefined") window.dispatchEvent(new Event("auth:invalid"));
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchMyOrders(): Promise<AdminOrder[]> {
  if (!BASE) return [];
  return request<AdminOrder[]>("/auth/orders/mine");
}

export async function fetchCategories(): Promise<Category[]> {
  if (!BASE) return categories;
  return request<Category[]>("/categories");
}

export async function fetchProductsByCategory(slug: string): Promise<Product[]> {
  if (!BASE) return products.filter((p) => p.categorySlug === slug);
  return request<Product[]>(`/categories/${slug}/products?_=${Date.now()}`, { cache: "no-store" });
}

export async function fetchProduct(slug: string): Promise<Product | undefined> {
  if (!BASE) return products.find((p) => p.slug === slug);
  return request<Product>(`/products/${slug}?_=${Date.now()}`, { cache: "no-store" });
}

export async function fetchAllProducts(opts?: { fresh?: boolean }): Promise<Product[]> {
  if (!BASE) return products;
  const suffix = opts?.fresh ? `?_=${Date.now()}` : "";
  return request<Product[]>(`/products${suffix}`, opts?.fresh ? { cache: "no-store" } : undefined);
}

export type OrderItemInput = { productSlug: string; quantity: number; name?: string; unitPrice?: number };
export type DiningOption = "to_go" | "to_stay" | "delivery";
export type PlaceOrderInput = {
  customerName: string;
  customerPhone: string;
  pickupTime?: string;
  notes?: string;
  paid?: boolean;
  paymentMethod?: "cash" | "debit" | "credit" | null;
  cashReceived?: number;
  diningOption?: DiningOption;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  deliveryFee?: number;
  couponCode?: string;
  isPreorder?: boolean;
  preorderAt?: string | null;
  items: OrderItemInput[];
};
export type Order = {
  orderNumber: string;
  status: string;
  subtotal: number;
  discount?: number;
  couponCode?: string | null;
  createdAt: string;
};

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (!BASE) {
    const subtotal = input.items.reduce((s, it) => {
      const p = products.find((x) => x.slug === it.productSlug);
      return s + (it.unitPrice ?? p?.price ?? 0) * it.quantity;
    }, 0);
    return {
      orderNumber: "FG-" + Math.floor(100000 + Math.random() * 900000),
      status: "new",
      subtotal: Math.round(subtotal * 100) / 100,
      discount: 0,
      couponCode: null,
      createdAt: new Date().toISOString(),
    };
  }
  return request<Order>("/orders", { method: "POST", body: JSON.stringify(input) });
}

// ---------- Delivery ----------
export type DeliveryQuote = {
  ok: true;
  quote_id: string;
  fee_cents: number;
  currency: string;
  eta?: string;
  distance_km?: number;
};
export async function quoteDelivery(input: { address: string; phone?: string; name?: string; orderValue?: number; lat?: number; lng?: number }): Promise<DeliveryQuote> {
  // orderValue is the cart total in dollars; convert to integer cents for Uber.
  const order_value = Number.isFinite(input.orderValue as number)
    ? Math.max(0, Math.round(Number(input.orderValue) * 100))
    : undefined;
  const { orderValue: _drop, ...rest } = input;
  return request<DeliveryQuote>("/delivery/quote", {
    method: "POST",
    body: JSON.stringify({ ...rest, order_value }),
  });
}

// ---------- Coupons ----------
export type CouponApplyResult = {
  ok: true;
  code: string;
  type: "percent" | "fixed" | "free_item";
  description?: string;
  discount: number;
  freeItem: { id: number; slug: string; name: string; value: number } | null;
};
export async function applyCoupon(input: { code: string; subtotal: number; customerPhone?: string }): Promise<CouponApplyResult> {
  if (!BASE) throw new Error("Coupons require a live backend");
  return request<CouponApplyResult>("/coupons/apply", { method: "POST", body: JSON.stringify(input) });
}

// ---------- Offers ----------
export type OfferType = "cart_percent" | "cart_amount" | "bogo" | "buy_x_get_y";
export type Offer = {
  id: number;
  slug: string;
  type: OfferType;
  name: string;
  description: string;
  image_url: string;
  config: Record<string, unknown>;
  is_active?: boolean;
  priority?: number;
  stackable?: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  days_of_week?: number;
  time_from?: string | null;
  time_to?: string | null;
  dining_option?: "any" | "dine_in" | "takeout" | "delivery";
  max_uses_per_order?: number | null;
  sort_order?: number;
};
export type OfferAdjustment = {
  offerId: number;
  name: string;
  type: OfferType;
  amount: number;
  note?: string;
  pending?: boolean;
  freeItems?: Array<{ slug: string; name: string; qty: number }>;
};
export type EvaluateOffersInput = {
  items: Array<{ slug: string; name?: string; unitPrice?: number; qty: number; variantId?: number | null }>;
  diningOption?: string;
};
export type EvaluateOffersResult = {
  adjustments: OfferAdjustment[];
  hints: OfferAdjustment[];
  totalDiscount: number;
};
export async function fetchActiveOffers(): Promise<Offer[]> {
  if (!BASE) return [];
  const r = await request<{ items: Offer[] }>("/offers/active").catch(() => ({ items: [] as Offer[] }));
  return r.items || [];
}
export async function evaluateOffers(input: EvaluateOffersInput): Promise<EvaluateOffersResult> {
  if (!BASE) return { adjustments: [], hints: [], totalDiscount: 0 };
  return request<EvaluateOffersResult>("/offers/evaluate", { method: "POST", body: JSON.stringify(input) });
}

// ---------- Feedback (Help page) ----------
export async function sendFeedback(input: { html: string; text?: string; fromName?: string; fromEmail?: string; pageUrl?: string }): Promise<{ ok: true }> {
  if (!BASE) return { ok: true };
  return request<{ ok: true }>("/feedback", { method: "POST", body: JSON.stringify(input) });
}

// Admin
// Preview-only placeholder credentials. These do NOT match any real account
// and only unlock the in-browser mock UI when no backend is configured.
const PREVIEW_EMAIL = "preview@example.invalid";
const PREVIEW_PASSWORD = "preview-demo";

export async function adminLogin(email: string, password: string): Promise<{ token: string }> {
  if (!BASE) {
    if (email === PREVIEW_EMAIL && password === PREVIEW_PASSWORD) {
      return { token: "preview-mock-token" };
    }
    throw new Error("Invalid credentials");
  }
  return request<{ token: string }>("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export type PaymentMethod = "cash" | "debit" | "credit";
export type AdminOrderItem = { productName: string; quantity: number; unitPrice: number; lineTotal: number; image?: string | null };
export type AdminOrder = Order & {
  customerName: string;
  customerPhone: string;
  pickupTime?: string;
  notes?: string;
  paymentMethod?: PaymentMethod | null;
  cashReceived?: number | string | null;
  paidAt?: string | null;
  readyAt?: string | null;
  diningOption?: DiningOption;
  discount?: number;
  couponCode?: string | null;
  isPreorder?: boolean | number;
  preorderAt?: string | null;
  staffUsername?: string | null;
  deliveryAddress?: string | null;
  deliveryInstructions?: string | null;
  deliveryFee?: number | null;
  deliveryId?: string | null;
  trackingUrl?: string | null;
  deliveryStatus?: string | null;
  items: AdminOrderItem[];

};

const mockOrders: AdminOrder[] = [
  {
    orderNumber: "FG-203481",
    status: "new",
    subtotal: 28.49,
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    customerName: "Aisha Patel",
    customerPhone: "+1 (416) 555-0144",
    pickupTime: "12:30 PM",
    paymentMethod: null, paidAt: null,
    items: [
      { productName: "Butter Chicken", quantity: 1, unitPrice: 18.99, lineTotal: 18.99 },
      { productName: "Garlic Naan", quantity: 2, unitPrice: 3.5, lineTotal: 7.0 },
      { productName: "Gulab Jamun (3 pc)", quantity: 1, unitPrice: 4.5, lineTotal: 4.5 },
    ],
  },
  {
    orderNumber: "FG-203472",
    status: "preparing",
    subtotal: 22.5,
    createdAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    customerName: "Marcus Tan",
    customerPhone: "+1 (647) 555-0173",
    paymentMethod: "cash", paidAt: new Date().toISOString(),
    items: [
      { productName: "Hyderabadi Chicken Biryani", quantity: 1, unitPrice: 16.5, lineTotal: 16.5 },
      { productName: "Vegetable Samosa (2 pc)", quantity: 1, unitPrice: 5.5, lineTotal: 5.5 },
    ],
  },
];

export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  if (!BASE) return mockOrders;
  return request<AdminOrder[]>("/admin/orders");
}

export async function updateOrderStatus(orderNumber: string, status: string): Promise<void> {
  if (!BASE) {
    const o = mockOrders.find((x) => x.orderNumber === orderNumber);
    if (o) o.status = status;
    return;
  }
  await request(`/admin/orders/${orderNumber}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export type AdminOrderPatch = {
  status?: string;
  customerName?: string;
  customerPhone?: string;
  pickupTime?: string;
  notes?: string;
  paymentMethod?: PaymentMethod | null;
  diningOption?: DiningOption;
  paid?: boolean;
  items?: AdminOrderItem[];
};

export type AdminOrderUpdateResult = { order?: AdminOrder; dispatchError?: string | null };

export async function updateAdminOrder(orderNumber: string, patch: AdminOrderPatch): Promise<AdminOrderUpdateResult> {
  if (!BASE) {
    const o = mockOrders.find((x) => x.orderNumber === orderNumber);
    if (!o) return {};
    Object.assign(o, patch);
    if (patch.paid === true && !o.paidAt) o.paidAt = new Date().toISOString();
    if (patch.paid === false) o.paidAt = null;
    if (patch.items) o.subtotal = Math.round(patch.items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
    return { order: o };
  }
  const result = await request<{ ok: true; order?: AdminOrder; dispatchError?: string | null }>(`/admin/orders/${orderNumber}`, { method: "PATCH", body: JSON.stringify(patch) });
  return { order: result.order, dispatchError: result.dispatchError };
}

export async function deleteAdminOrder(orderNumber: string): Promise<void> {
  if (!BASE) {
    const i = mockOrders.findIndex((x) => x.orderNumber === orderNumber);
    if (i >= 0) mockOrders.splice(i, 1);
    return;
  }
  await request(`/admin/orders/${orderNumber}`, { method: "DELETE" });
}

// ============================================================
// Media library / Settings / Users — admin endpoints
// ============================================================

export type AdminRole = "admin" | "kitchen_manager" | "counter_sales" | "store_manager" | "seo_manager" | "super";
export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  kitchen_manager: "Kitchen Manager",
  counter_sales: "Counter Sales",
  store_manager: "Store Manager",
  seo_manager: "SEO Manager",
  super: "Super Admin",
  customer: "Customer",
};
export const ADMIN_PAGE_OPTIONS: { key: string; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "menu", label: "Menu" },
  { key: "inventory", label: "Inventory" },
  { key: "reports", label: "Reports" },
  { key: "media", label: "Media" },
  { key: "newsletter", label: "Newsletter" },
  { key: "reviews", label: "Reviews" },
  { key: "submissions", label: "Submissions" },
  { key: "coupons", label: "Coupons" },
  { key: "seo", label: "SEO Tools" },
  { key: "settings", label: "Settings" },
  { key: "users", label: "Users" },
];


export type AdminUserRow = {
  id: number; username: string; email: string;
  role: AdminRole; permissions: string[]; permissionsCustom: boolean;
  created_at: string; last_login_at: string | null;
};
export type AdminMe = { id: number; username: string; email: string; full_name?: string | null; is_super: boolean; role: AdminRole; permissions: string[]; navOrder?: string[] | null };

export type ImageFolder = "page" | "products";
export type ImageUsage = { type: string; label: string; page: string | null };
export type ImageItem = {
  filename: string; folder: ImageFolder; url: string; size: number; mtime: number;
  optimized: boolean; alt: string; usedCount: number; usages: ImageUsage[];
};

export type VideoItem = {
  filename: string; url: string; size: number; mtime: number; mime: string; ext: string;
};



export type SiteSettings = Record<string, string>;

// Raster extensions the server's image-fallback middleware can transparently
// resolve to a sibling on disk. We request .avif by default so the storefront
// loads the optimized version when it has been generated, and the server
// falls back to the original (.jpg/.png/…) automatically when it hasn't.
const RASTER_TO_AVIF = /\.(jpe?g|png|webp|bmp|tiff?|gif)(\?.*)?$/i;
function preferAvif(url: string): string {
  if (!RASTER_TO_AVIF.test(url)) return url;
  return url.replace(RASTER_TO_AVIF, (_m, _ext, qs = "") => `.avif${qs || ""}`);
}

export function resolveAssetUrl(url: string, opts?: { w?: number; h?: number; fit?: "cover" | "contain" }): string {
  if (!url) return url;
  if (/^(https?:|data:|blob:|\/__l5e\/)/i.test(url)) return url;
  if (url.startsWith("/uploads/") || url.startsWith("/products/")) {
    // When a target width/height is provided AND we have a real API base,
    // route through the on-the-fly resizer so PageSpeed sees properly sized
    // images. Originals on disk are never modified.
    if (BASE && (opts?.w || opts?.h)) {
      const params = new URLSearchParams();
      params.set("src", url);
      if (opts.w) params.set("w", String(Math.round(opts.w)));
      if (opts.h) params.set("h", String(Math.round(opts.h)));
      if (opts.fit) params.set("fit", opts.fit);
      const rel = `/img?${params.toString()}`;
      return BASE + rel;
    }
    const avif = preferAvif(url);
    if (BASE) {
      try { return new URL(avif, BASE.startsWith("/") ? window.location.origin : BASE).toString(); } catch { return avif; }
    }
    return avif;
  }
  return url;
}

/** Build a sized image URL + srcset string for responsive rendering. */
export function sizedImage(
  url: string,
  width: number,
  opts?: { h?: number; fit?: "cover" | "contain"; widths?: number[] },
): { src: string; srcSet: string } {
  const ratio = opts?.h ? opts.h / width : undefined;
  const ws = (opts?.widths ?? [width, width * 2])
    .map((w) => Math.round(w))
    .sort((a, b) => a - b);
  const src = resolveAssetUrl(url, { w: width, h: opts?.h, fit: opts?.fit });
  const srcSet = ws
    .map((w) => `${resolveAssetUrl(url, { w, h: ratio ? Math.round(w * ratio) : undefined, fit: opts?.fit })} ${w}w`)
    .join(", ");
  return { src, srcSet };
}

export const adminApi = {
  me: () => request<{ user: AdminMe }>("/admin/me"),
  listImages: (folder?: ImageFolder) =>
    request<{ items: ImageItem[] }>(`/admin/images${folder ? `?folder=${folder}` : ""}`),
  imageUsage: (filename: string, folder: ImageFolder = "page") =>
    request<{ filename: string; folder: ImageFolder; usages: ImageUsage[] }>(
      `/admin/images/usage?filename=${encodeURIComponent(filename)}&folder=${folder}`,
    ),
  setImageAlt: (filename: string, alt: string, folder: ImageFolder = "page") =>
    request<{ ok: true }>("/admin/images/alt", { method: "PUT", body: JSON.stringify({ filename, alt, folder }) }),
  deleteImage: (filename: string, folder: ImageFolder = "page") =>
    request<{ ok: true }>(`/admin/images/${encodeURIComponent(filename)}?folder=${folder}`, { method: "DELETE" }),
  optimizeImage: (filename: string, folder: ImageFolder = "page") =>
    request<{ filename: string; oldFilename?: string; changed: boolean; optimized: boolean }>(
      "/admin/images/optimize", { method: "POST", body: JSON.stringify({ filename, folder }) },
    ),
  optimizeAllImages: (folder?: ImageFolder) =>
    request<{ total: number; optimized: number; failed: number }>(
      "/admin/images/optimize-all", { method: "POST", body: JSON.stringify({ folder }) },
    ),
  scanDuplicateImages: (folder?: ImageFolder) =>
    request<{ scanned: number; removed: number; items: Array<{ deleted: string; kept: string }> }>(
      "/admin/images/duplicates/scan", { method: "POST", body: JSON.stringify({ folder }) },
    ),
  editImage: (input: { filename: string; folder?: ImageFolder; crop?: { x: number; y: number; width: number; height: number } | null; width?: number }) =>
    request<{ ok: true; filename: string; url: string }>(
      "/admin/images/edit", { method: "POST", body: JSON.stringify({ folder: "page", ...input }) },
    ),
  replaceImage: (filename: string, newUrl: string, folder: ImageFolder = "page") =>
    request<{ ok: true; filename: string; url: string }>(
      "/admin/images/replace", { method: "POST", body: JSON.stringify({ filename, newUrl, folder }) },
    ),
  renameImage: (filename: string, newName: string, folder: ImageFolder = "page") =>
    request<{ ok: true; filename: string; url: string }>(
      "/admin/images/rename", { method: "POST", body: JSON.stringify({ filename, newName, folder }) },
    ),
  upload: async (file: File, folder: ImageFolder = "page") => {
    if (!BASE) throw new Error("Upload requires a live backend (set VITE_API_URL).");
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${BASE}/admin/upload?folder=${folder}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data as { url: string; filename: string; folder: ImageFolder; size: number; mime: string };
  },
  getSettings: () => request<{ settings: SiteSettings }>("/admin/settings"),
  saveSettings: (input: SiteSettings) =>
    request<{ ok: true }>("/admin/settings", { method: "PUT", body: JSON.stringify(input) }),
  generateAttendanceSyncKey: () =>
    request<{ key: string }>("/admin/attendance/sync-key/generate", { method: "POST" }),
  listUsers: () => request<{ items: AdminUserRow[] }>("/admin/users"),
  createUser: (input: { username: string; email: string; password: string; role: AdminRole; permissions?: string[] }) =>
    request<{ id: number }>("/admin/users", { method: "POST", body: JSON.stringify(input) }),
  updateUser: (id: number, input: { email?: string; password?: string; role?: AdminRole; permissions?: string[] | null }) =>
    request<{ ok: true }>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteUser: (id: number) =>
    request<{ ok: true }>(`/admin/users/${id}`, { method: "DELETE" }),
  getRolePermissions: () => request<{
    items: Record<string, { permissions: string[]; custom: boolean; defaults: string[] }>;
    pages: { key: string; label: string }[];
  }>("/admin/role-permissions"),
  updateRolePermissions: (role: AdminRole, permissions: string[] | null) =>
    request<{ ok: true }>("/admin/role-permissions", { method: "PUT", body: JSON.stringify({ role, permissions }) }),
  updateNavOrder: (order: string[]) =>
    request<{ ok: true }>("/admin/nav-order", { method: "PUT", body: JSON.stringify({ order }) }),

  // ---------- Videos ----------
  listVideos: () => request<{ items: VideoItem[] }>("/admin/videos"),
  uploadVideo: async (file: File) => {
    if (!BASE) throw new Error("Upload requires a live backend (set VITE_API_URL).");
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${BASE}/admin/videos/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data as { url: string; filename: string; size: number; mime: string };
  },
  replaceVideo: async (filename: string, file: File) => {
    if (!BASE) throw new Error("Replace requires a live backend (set VITE_API_URL).");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("filename", filename);
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${BASE}/admin/videos/replace`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Replace failed (${res.status})`);
    return data as { ok: true; filename: string; url: string; size: number };
  },
  deleteVideo: (filename: string) =>
    request<{ ok: true }>(`/admin/videos/${encodeURIComponent(filename)}`, { method: "DELETE" }),

  // ---------- SEO Tools ----------
  listSeoPages: () =>
    request<{ items: SeoPageRow[] }>("/admin/seo/pages"),
  scanSeoPages: (paths: string[]) =>
    request<{ ok: true; added: number }>("/admin/seo/pages/scan", {
      method: "POST", body: JSON.stringify({ paths }),
    }),
  saveSeoPage: (input: {
    path: string;
    title: string | null;
    description: string | null;
    focusKeyword: string | null;
    ogImage: string | null;
    jsonLd: string | null;
  }) =>
    request<{ ok: true; id: number }>("/admin/seo/pages", {
      method: "POST", body: JSON.stringify(input),
    }),
  getSitemap: () =>
    request<{ urls: { loc: string; lastmod: string }[]; xml: string }>("/admin/seo/sitemap"),
  generateSitemap: () =>
    request<{ ok: true; urls: number; xml: string; written: { written: boolean; path?: string; reason?: string } }>(
      "/admin/seo/sitemap/generate", { method: "POST" },
    ),
  generateRobots: () =>
    request<{ ok: true; txt: string; written: { written: boolean; path?: string; reason?: string } }>(
      "/admin/seo/robots/generate", { method: "POST" },
    ),
  getSeoSettings: () =>
    request<{ settings: Record<string, string> }>("/admin/seo/settings"),
  saveSeoSettings: (input: Record<string, string>) =>
    request<{ ok: true }>("/admin/seo/settings", { method: "PUT", body: JSON.stringify(input) }),
  purgeCloudflare: (input?: { files?: string[]; zoneId?: string; apiToken?: string }) =>
    request<{ ok: true; scope: "all" | "files"; result: unknown }>(
      "/admin/seo/cloudflare/purge", { method: "POST", body: JSON.stringify(input || {}) },
    ),
  listOffers: () => request<{ items: Offer[] }>("/admin/offers"),
  createOffer: (input: Partial<Offer> & { slug: string; type: OfferType; name: string; config: Record<string, unknown> }) =>
    request<{ id: number }>("/admin/offers", { method: "POST", body: JSON.stringify(input) }),
  updateOffer: (id: number, input: Partial<Offer>) =>
    request<{ ok: true }>(`/admin/offers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteOffer: (id: number) =>
    request<{ ok: true }>(`/admin/offers/${id}`, { method: "DELETE" }),
};

export type SeoPageRow = {
  id: number;
  path: string;
  title: string | null;
  description: string | null;
  focus_keyword: string | null;
  og_image: string | null;
  json_ld: string | null;
};

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!BASE) return { gst_rate_percent: "13" };
  try { return await request<SiteSettings>("/site-settings"); }
  catch { return {}; }
}

export type ContactChallenge = { question: string; token: string; expiresAt: number };
export async function fetchContactChallenge(): Promise<ContactChallenge> {
  if (!BASE) {
    return { question: "2 + 3", token: "preview", expiresAt: Date.now() + 600_000 };
  }
  return request<ContactChallenge>("/contact/challenge");
}

export type ContactInput = {
  name: string; email: string; phone?: string; message: string;
  website?: string;          // honeypot
  mathToken?: string;
  mathAnswer?: string | number;
};
export async function submitContact(input: ContactInput): Promise<{ ok: true }> {
  if (!BASE) {
    // Preview / no backend — pretend success so the UI flow still works.
    return { ok: true };
  }
  return request<{ ok: true }>("/contact", { method: "POST", body: JSON.stringify(input) });
}

export type ContactSubmission = {
  id: number; name: string; email: string; phone: string; message: string;
  isSpam: boolean; spamReason: string; ip: string; userAgent: string;
  sentTo?: string; createdAt: string;
};
export const submissionsApi = {
  list: (opts: { page?: number; limit?: number; q?: string; filter?: "all" | "spam" | "ham" } = {}) => {
    const qs = new URLSearchParams();
    if (opts.page) qs.set("page", String(opts.page));
    if (opts.limit) qs.set("limit", String(opts.limit));
    if (opts.q) qs.set("q", opts.q);
    if (opts.filter) qs.set("filter", opts.filter);
    return request<{ items: ContactSubmission[]; total: number; page: number; limit: number }>(
      `/admin/submissions${qs.toString() ? `?${qs}` : ""}`,
    );
  },
  setSpam: (id: number, isSpam: boolean) =>
    request<{ ok: true }>(`/admin/submissions/${id}`, { method: "PATCH", body: JSON.stringify({ isSpam }) }),
  remove: (id: number) =>
    request<{ ok: true }>(`/admin/submissions/${id}`, { method: "DELETE" }),
};
export type PublicOrderItem = AdminOrderItem & { image?: string | null };
export type PublicOrderDelivery = {
  status: string;
  deliveryId?: string | null;
  trackingUrl?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  feeCents?: number | null;
  currency?: string | null;
  pickupEta?: string | null;
  dropoffEta?: string | null;
  updatedAt?: string | null;
};
export type PublicOrder = Omit<AdminOrder, "items"> & {
  items: PublicOrderItem[];
  delivery?: PublicOrderDelivery | null;
};

export async function fetchPublicOrder(orderNumber: string): Promise<PublicOrder> {
  if (!BASE) throw new Error("Backend not configured");
  return request<PublicOrder>(`/orders/${encodeURIComponent(orderNumber)}`);
}

export async function lookupOrder(input: { name?: string; phone?: string; address?: string; orderNumber?: string }): Promise<{ orderNumber: string; status: string }> {
  if (!BASE) throw new Error("Backend not configured");
  return request<{ orderNumber: string; status: string }>(`/orders/lookup`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ============================================================
// Menu admin — categories, products, à-la-carte add-ons
// ============================================================
export type AdminCategory = { id: number; slug: string; name: string; description: string; image_url: string; sort_order: number; is_featured?: boolean; side_category_id?: number | null; side_category_slug?: string | null; availability?: "available" | "unavailable" | "upcoming" };
export type AdminSubcategory = { id: number; category_id: number; category_slug?: string; slug: string; name: string; sort_order: number };
export type AdminProductVariant = { id?: number; name: string; price: number; is_base: boolean; sort_order?: number };
export type AdminProduct = {
  id: number; slug: string; category_id: number; category_slug?: string;
  subcategory_id?: number | null;
  name: string; description: string; long_description: string;
  nutrition_json?: string | null;
  price: number; image_url: string; is_veg: 0 | 1 | boolean; is_active: 0 | 1 | boolean;
  is_featured?: 0 | 1 | boolean;
  rating: number; sort_order: number;
  product_type?: "simple" | "variable";
  variants?: AdminProductVariant[];
};
export type AdminAddonOptionSize = { id: number; slug: string; name: string; price: number; sort_order: number };
export type AdminAddonOption = { id: number; group_id: number; name: string; price: number; sort_order: number; sizes: AdminAddonOptionSize[] };
export type AdminAddonGroup = {
  id: number; product_id: number; product_name: string; product_slug: string;
  category_slug: string; name: string; type: "single" | "multi"; is_required: boolean; sized: boolean;
  sort_order: number; options: AdminAddonOption[];
};

export const menuApi = {
  // Categories
  listCategories: () => request<AdminCategory[]>("/admin/categories"),
  createCategory: (input: Partial<AdminCategory>) => request<{ id: number }>("/admin/categories", { method: "POST", body: JSON.stringify(input) }),
  updateCategory: (id: number, input: Partial<AdminCategory>) => request<{ ok: true }>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteCategory: (id: number) => request<{ ok: true }>(`/admin/categories/${id}`, { method: "DELETE" }),
  // Subcategories
  listSubcategories: () => request<AdminSubcategory[]>("/admin/subcategories"),
  createSubcategory: (input: { category_id: number; slug: string; name: string; sort_order?: number }) =>
    request<{ id: number }>("/admin/subcategories", { method: "POST", body: JSON.stringify(input) }),
  updateSubcategory: (id: number, input: Partial<AdminSubcategory>) =>
    request<{ ok: true }>(`/admin/subcategories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteSubcategory: (id: number) => request<{ ok: true }>(`/admin/subcategories/${id}`, { method: "DELETE" }),
  // Products
  listProducts: () => request<AdminProduct[]>("/admin/products"),
  createProduct: (input: Partial<AdminProduct>) => request<{ id: number }>("/admin/products", { method: "POST", body: JSON.stringify(input) }),
  updateProduct: (id: number, input: Partial<AdminProduct>) => request<{ ok: true }>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteProduct: (id: number) => request<{ ok: true }>(`/admin/products/${id}`, { method: "DELETE" }),
  // Addons
  listAddons: () => request<AdminAddonGroup[]>("/admin/addons"),
  updateAddonOption: (id: number, input: { name?: string; price?: number }) =>
    request<{ ok: true }>(`/admin/addon-options/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteAddonOption: (id: number) => request<{ ok: true }>(`/admin/addon-options/${id}`, { method: "DELETE" }),
  createAddonOption: (input: { group_id: number; name: string; price: number }) =>
    request<{ id: number }>("/admin/addon-options", { method: "POST", body: JSON.stringify(input) }),
  updateAddonOptionSize: (id: number, input: { name?: string; price?: number }) =>
    request<{ ok: true }>(`/admin/addon-option-sizes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteAddonGroup: (id: number) => request<{ ok: true }>(`/admin/addon-groups/${id}`, { method: "DELETE" }),

  // Hierarchical scope multiselect for an addon "bucket" (groups sharing name|type|sized)
  getAddonBucketScope: (bucketKey: string) =>
    request<{ categoryIds: number[]; subcategoryIds: number[] }>(
      `/admin/addon-buckets/${encodeURIComponent(bucketKey)}/scope`
    ),
  syncAddonBucket: (input: { templateGroupId: number; categoryIds: number[]; subcategoryIds: number[] }) =>
    request<{ ok: true; created: number; removed: number }>(`/admin/addon-buckets/sync`, {
      method: "PUT", body: JSON.stringify(input),
    }),

  // Create a brand-new addon bucket across selected scope.
  createAddonBucket: (input: {
    name: string;
    selection_type: "single" | "multi";
    is_required?: boolean;
    sized: boolean;
    categoryIds: number[];
    subcategoryIds: number[];
    options: Array<{ name: string; price: number; sizes?: Array<{ slug: string; name: string; price: number }> }>;
  }) =>
    request<{ ok: true; created: number }>(`/admin/addon-buckets`, {
      method: "POST", body: JSON.stringify(input),
    }),

  // Add an option (with optional size tiers) to every group in a bucket.
  addAddonBucketOption: (bucketKey: string, input: {
    name: string;
    price: number;
    sizes?: Array<{ slug: string; name: string; price: number }>;
  }) =>
    request<{ ok: true; added: number }>(`/admin/addon-buckets/${encodeURIComponent(bucketKey)}/options`, {
      method: "POST", body: JSON.stringify(input),
    }),

  // Rename / reprice an option by current name across every group in a bucket.
  updateAddonBucketOption: (bucketKey: string, input: { oldName: string; newName?: string; price?: number }) =>
    request<{ ok: true; updated: number }>(`/admin/addon-buckets/${encodeURIComponent(bucketKey)}/options`, {
      method: "PATCH", body: JSON.stringify(input),
    }),

  // CSV import / export
  exportProductsCsv: async (): Promise<void> => {
    if (!BASE) throw new Error("CSV export requires a live backend (set VITE_API_URL).");
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${BASE}/admin/products/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `products-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  importProductsCsv: async (file: File) => {
    if (!BASE) throw new Error("CSV import requires a live backend (set VITE_API_URL).");
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${BASE}/admin/products/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
    return data as { ok: true; created: number; updated: number; skipped: number; errors: string[] };
  },
};

// ============================================================
// Newsletter — subscribers (mailing list), templates, campaigns
// ============================================================
export type NewsletterSubscriber = {
  id: number; email: string; name: string | null; source: string; status: string; created_at: string;
};
export type NewsletterTemplate = { id: number; name: string; subject: string; html: string; updated_at: string };
export type NewsletterCampaign = {
  id: number; subject: string; audience: string; sent_count: number; failed_count: number; sent_by: string | null; created_at: string;
};

export const newsletterApi = {
  listSubscribers: (opts: { page?: number; limit?: number; q?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.q) params.set("q", opts.q);
    const qs = params.toString();
    return request<{ items: NewsletterSubscriber[]; total: number; page: number; limit: number }>(
      `/admin/newsletter/subscribers${qs ? `?${qs}` : ""}`,
    );
  },
  addSubscriber: (email: string, name?: string) =>
    request<{ id: number }>("/admin/newsletter/subscribers", { method: "POST", body: JSON.stringify({ email, name }) }),
  updateSubscriber: (id: number, input: { email?: string; name?: string | null }) =>
    request<{ ok: true }>(`/admin/newsletter/subscribers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteSubscriber: (id: number) =>
    request<{ ok: true }>(`/admin/newsletter/subscribers/${id}`, { method: "DELETE" }),
  importSubscribers: (items: Array<{ email: string; name?: string }>) =>
    request<{ added: number; skipped: number; total: number }>(
      "/admin/newsletter/subscribers/import", { method: "POST", body: JSON.stringify({ items }) },
    ),
  importCustomers: () =>
    request<{ added: number; skipped: number; total: number }>(
      "/admin/newsletter/subscribers/import-customers", { method: "POST" },
    ),
  audienceStats: () => request<{ subscribers: number }>("/admin/newsletter/audience-stats"),
  listCampaigns: () => request<{ items: NewsletterCampaign[] }>("/admin/newsletter/campaigns"),
  send: (input: { subject: string; html: string; audience?: "subscribers" }) =>
    request<{ ok: true; sent: number; failed: number; total: number }>(
      "/admin/newsletter/send", { method: "POST", body: JSON.stringify({ audience: "subscribers", ...input }) },
    ),
  listTemplates: () => request<{ items: NewsletterTemplate[] }>("/admin/newsletter/templates"),
  createTemplate: (input: { name: string; subject?: string; html: string }) =>
    request<{ id: number }>("/admin/newsletter/templates", { method: "POST", body: JSON.stringify(input) }),
  updateTemplate: (id: number, input: { name: string; subject?: string; html: string }) =>
    request<{ ok: true }>(`/admin/newsletter/templates/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteTemplate: (id: number) =>
    request<{ ok: true }>(`/admin/newsletter/templates/${id}`, { method: "DELETE" }),
};

// ============================================================
// Customers (admin)
// ============================================================
export type AdminCustomer = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  subscribed: number | boolean;
  created_at: string;
  last_login_at: string | null;
  orders_count: number;
};
export const customersApi = {
  list: (opts: { page?: number; limit?: number; q?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.q) params.set("q", opts.q);
    const qs = params.toString();
    return request<{ items: AdminCustomer[]; total: number; page: number; limit: number }>(
      `/admin/customers${qs ? `?${qs}` : ""}`,
    );
  },
  update: (id: number, input: { name?: string; phone?: string | null; subscribed?: boolean }) =>
    request<{ ok: true }>(`/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: number) =>
    request<{ ok: true }>(`/admin/customers/${id}`, { method: "DELETE" }),
};

// ============================================================
// Reviews / testimonials
// ============================================================
export type PublicReview = { id: number; name: string; role: string; quote: string; avatarUrl: string; rating: number };
export type AdminReview = {
  id: number; name: string; role: string; quote: string;
  avatar_url: string; rating: number; is_active: boolean; sort_order: number; created_at?: string;
};

export async function fetchReviews(): Promise<PublicReview[]> {
  if (!BASE) return [];
  try { return await request<PublicReview[]>("/reviews"); }
  catch { return []; }
}

export const reviewsApi = {
  list: () => request<AdminReview[]>("/admin/reviews"),
  create: (input: Partial<AdminReview>) =>
    request<{ id: number }>("/admin/reviews", { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, input: Partial<AdminReview>) =>
    request<{ ok: true }>(`/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: number) => request<{ ok: true }>(`/admin/reviews/${id}`, { method: "DELETE" }),
};

// ============================================================
// Coupons
// ============================================================
export type AdminCoupon = {
  id: number;
  code: string;
  description: string;
  type: "percent" | "fixed" | "free_item";
  value: number;
  max_discount: number | null;
  min_subtotal: number;
  free_product_id: number | null;
  free_product_name?: string | null;
  free_product_slug?: string | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
};

export type CouponInput = Partial<Omit<AdminCoupon, "id" | "used_count" | "created_at" | "free_product_name" | "free_product_slug">>;

export const couponsApi = {
  list: () => request<{ items: AdminCoupon[] }>("/admin/coupons"),
  create: (input: CouponInput) =>
    request<{ id: number }>("/admin/coupons", { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, input: CouponInput) =>
    request<{ ok: true }>(`/admin/coupons/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: number) =>
    request<{ ok: true }>(`/admin/coupons/${id}`, { method: "DELETE" }),
};


// ============================================================
// Promotions
// ============================================================
export type PromotionSlide = { id?: number; imageUrl: string; sortOrder?: number };
export type Promotion = {
  id: number;
  name: string;
  isActive: boolean;
  daysOfWeek: number[];
  dateStart: string | null;
  dateEnd: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  slideDurationMs: number;
  sortOrder: number;
  createdAt?: string;
  slides: PromotionSlide[];
};
export type PromotionInput = {
  name: string;
  isActive?: boolean;
  daysOfWeek?: number[];
  dateStart?: string | null;
  dateEnd?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  slideDurationMs?: number;
  sortOrder?: number;
  slides?: PromotionSlide[];
};

export async function fetchActivePromotions(): Promise<Promotion[]> {
  if (!BASE) return [];
  try {
    const r = await request<{ items: Promotion[] }>("/promotions/active");
    return r.items;
  } catch { return []; }
}

export const promotionsApi = {
  list: () => request<{ items: Promotion[] }>("/admin/promotions"),
  create: (input: PromotionInput) =>
    request<{ id: number }>("/admin/promotions", { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, input: Partial<PromotionInput>) =>
    request<{ ok: true }>(`/admin/promotions/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: number) =>
    request<{ ok: true }>(`/admin/promotions/${id}`, { method: "DELETE" }),
};




