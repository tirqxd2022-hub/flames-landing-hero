// Thin wrapper around the Uber Direct REST API.
// Reads credentials from `site_settings` so the operator can configure
// everything from the admin UI without restarting the server.
//
// API reference: https://developer.uber.com/docs/deliveries

import crypto from "node:crypto";
import { pool } from "../db.js";

const AUTH_URL = "https://login.uber.com/oauth/v2/token";
const API_BASE = "https://api.uber.com/v1/customers";

// Sandbox uses the same hostnames but separate (test-mode) credentials issued
// by Uber. We expose a "mode" toggle for clarity / future-proofing.

const SETTING_KEYS = [
  "delivery_enabled",
  "delivery_provider",
  "delivery_mode",
  // Legacy (single-mode) credentials — still read as a fallback.
  "uber_customer_id",
  "uber_client_id",
  "uber_client_secret",
  "uber_webhook_signing_key",
  // Per-mode credentials so operators can keep sandbox and live saved
  // simultaneously and just flip a toggle.
  "uber_customer_id_sandbox", "uber_client_id_sandbox", "uber_client_secret_sandbox", "uber_webhook_signing_key_sandbox",
  "uber_customer_id_live", "uber_client_id_live", "uber_client_secret_live", "uber_webhook_signing_key_live",
  "delivery_pickup_name",
  "delivery_pickup_phone",
  "delivery_pickup_address",
  "delivery_pickup_notes",
  "delivery_max_radius_km",
  "delivery_default_tip_cents",
  "delivery_undeliverable_action",
];

let _settingsCache = null;
let _settingsCacheAt = 0;
const SETTINGS_TTL_MS = 30_000;

export async function getDeliverySettings({ force = false } = {}) {
  if (!force && _settingsCache && Date.now() - _settingsCacheAt < SETTINGS_TTL_MS) {
    return _settingsCache;
  }
  const [rows] = await pool.query(
    `SELECT k, v FROM site_settings WHERE k IN (${SETTING_KEYS.map(() => "?").join(",")})`,
    SETTING_KEYS,
  );
  const out = {};
  for (const k of SETTING_KEYS) out[k] = "";
  for (const r of rows) out[r.k] = r.v || "";
  // Resolve active credentials from the per-mode saved values so callers
  // (createQuote, dispatch, webhook verification) keep using the flat keys.
  const mode = out.delivery_mode === "live" ? "live" : "sandbox";
  for (const base of ["uber_customer_id", "uber_client_id", "uber_client_secret", "uber_webhook_signing_key"]) {
    const scoped = out[`${base}_${mode}`];
    if (scoped) out[base] = scoped;
  }
  _settingsCache = out;
  _settingsCacheAt = Date.now();
  return out;
}

export function invalidateDeliverySettingsCache() {
  _settingsCache = null;
  _settingsCacheAt = 0;
}

export function isDeliveryEnabled(s) {
  return s.delivery_enabled === "1" || s.delivery_enabled === "true";
}

export function assertDeliveryConfigured(s) {
  if (!isDeliveryEnabled(s)) {
    const e = new Error("Delivery is disabled. Enable it from Admin → Settings → Delivery.");
    e.status = 503; e.code = "delivery_disabled"; throw e;
  }
  const missing = ["uber_customer_id", "uber_client_id", "uber_client_secret"].filter((k) => !s[k]);
  if (missing.length) {
    const e = new Error(`Uber Direct is not configured. Missing: ${missing.join(", ")}.`);
    e.status = 503; e.code = "delivery_not_configured"; throw e;
  }
}

// ---------------------- OAuth ----------------------
let _token = null; // { access_token, expires_at }

async function getAccessToken(s) {
  if (_token && _token.expires_at - 60_000 > Date.now()) return _token.access_token;
  const mode = s.delivery_mode === "live" ? "live" : "sandbox";
  const missing = ["uber_customer_id", "uber_client_id", "uber_client_secret"].filter((k) => !s[k]);
  if (missing.length) {
    const e = new Error(`Uber Direct ${mode} credentials are missing: ${missing.map((k) => k.replace(/^uber_/, "")).join(", ")}. Save them in Admin → Settings → Delivery.`);
    e.status = 400; throw e;
  }
  const body = new URLSearchParams({
    client_id: s.uber_client_id,
    client_secret: s.uber_client_secret,
    grant_type: "client_credentials",
    scope: "eats.deliveries",
  });
  const r = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await r.text();
  if (!r.ok) {
    let detail = text;
    try { const j = JSON.parse(text); detail = j.error_description || j.error || text; } catch { /* keep raw */ }
    const e = new Error(`Uber Direct ${mode} auth failed (${r.status}): ${detail}`);
    e.status = 400; throw e;
  }
  const data = JSON.parse(text);
  _token = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 2592000) * 1000,
  };
  return _token.access_token;
}

export function clearUberTokenCache() { _token = null; }

// ---------------------- Core call ----------------------
async function uberFetch(s, pathSuffix, init = {}) {
  const token = await getAccessToken(s);
  const url = `${API_BASE}/${encodeURIComponent(s.uber_customer_id)}${pathSuffix}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let parsed; try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  if (!r.ok) {
    const err = new Error(parsed?.message || parsed?.code || `Uber request failed (${r.status})`);
    err.status = r.status; err.details = parsed;
    throw err;
  }
  return parsed;
}

// ---------------------- API helpers ----------------------
function pickupPayload(s) {
  return {
    pickup_name: s.delivery_pickup_name || "Store",
    pickup_phone_number: s.delivery_pickup_phone || "",
    pickup_address: s.delivery_pickup_address || "",
    pickup_notes: s.delivery_pickup_notes || "",
  };
}

export async function createQuote(s, { dropoff_address, dropoff_phone_number, dropoff_name, order_value }) {
  // Uber Direct expects `manifest_total_value` in the local currency's minor
  // units (integer cents), e.g. a $25.00 cart => 2500.
  const cents = normalizeOrderValueCents(order_value);
  return uberFetch(s, "/delivery_quotes", {
    method: "POST",
    body: JSON.stringify({
      ...pickupPayload(s),
      dropoff_address: normalizeDeliveryAddress(dropoff_address),
      dropoff_phone_number,
      dropoff_name,
      ...(cents != null ? { manifest_total_value: cents } : {}),
      is_draft: true,
    }),
  });
}

// Callers must pass an integer number of cents. Anything else is rejected.
function normalizeOrderValueCents(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export async function createDelivery(s, { quote_id, order, items }) {
  const tipCents = Number(s.delivery_default_tip_cents || 0) || 0;
  const manifestItems = (items || []).map((it) => ({
    name: String(it.product_name || "Item").slice(0, 60),
    quantity: Number(it.quantity) || 1,
    price: Math.max(0, Math.round(Number(it.unit_price || 0) * 100)),
    size: "small",
  }));
  // Uber requires a non-empty manifest_items array.
  if (!manifestItems.length) manifestItems.push({ name: "Order", quantity: 1, price: 0, size: "small" });

  const body = {
    ...pickupPayload(s),
    dropoff_name: order.customer_name || "Customer",
    dropoff_phone_number: order.customer_phone || "",
    dropoff_address: normalizeDeliveryAddress(order.delivery_address),
    dropoff_notes: (order.delivery_instructions || order.notes || "").slice(0, 280),
    quote_id,
    tip: tipCents || undefined,
    undeliverable_action: s.delivery_undeliverable_action || "return",
    manifest_reference: order.order_number,
    manifest_items: manifestItems,
    external_id: order.order_number,
  };
  return uberFetch(s, "/deliveries", { method: "POST", body: JSON.stringify(body) });
}

export async function getDelivery(s, deliveryId) {
  return uberFetch(s, `/deliveries/${encodeURIComponent(deliveryId)}`);
}

export async function cancelDelivery(s, deliveryId) {
  return uberFetch(s, `/deliveries/${encodeURIComponent(deliveryId)}/cancel`, { method: "POST" });
}

// ---------------------- Webhook verification ----------------------
export function verifyWebhookSignature(rawBody, signature, signingKey) {
  if (!signingKey || !signature) return false;
  const expected = crypto.createHmac("sha256", signingKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

// ---------------------- Dispatch orchestrator ----------------------
// Single entry point used by the admin "Dispatch" button AND by the
// post-payment hook for online delivery orders. Idempotent per order:
// returns the existing live delivery instead of creating a duplicate.
export async function dispatchOrderToCourier(pool, orderId) {
  const s = await getDeliverySettings();
  assertDeliveryConfigured(s);

  const [orows] = await pool.query(
    `SELECT id, order_number, customer_name, customer_phone, notes,
            delivery_address, delivery_instructions
       FROM orders WHERE id = ? LIMIT 1`,
    [orderId],
  );
  const order = orows[0];
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (!order.delivery_address) throw new Error(`Order ${order.order_number} has no delivery address`);

  // Idempotency: if there's already an active dispatch, return it.
  const [existing] = await pool.query(
    `SELECT delivery_id, tracking_url, status FROM deliveries
      WHERE order_id = ? AND delivery_id IS NOT NULL
        AND status NOT IN ('canceled','failed','returned')
      ORDER BY id DESC LIMIT 1`,
    [orderId],
  );
  if (existing[0]?.delivery_id) return { reused: true, delivery: existing[0] };

  // Always quote first — Uber requires a valid quote_id.
  const quote = await createQuote(s, {
    dropoff_address: order.delivery_address,
    dropoff_phone_number: order.customer_phone || "",
    dropoff_name: order.customer_name || "Customer",
  });

  const [items] = await pool.query(
    `SELECT product_name, unit_price, quantity FROM order_items WHERE order_id = ?`,
    [orderId],
  );

  const delivery = await createDelivery(s, { quote_id: quote.id, order, items });

  await pool.query(
    `INSERT INTO deliveries
      (order_id, provider, status, quote_id, delivery_id, fee_cents, currency,
       tracking_url, courier_name, courier_phone, pickup_eta, dropoff_eta, raw_delivery_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      s.delivery_provider || "uber_direct",
      delivery.status || "pending",
      quote.id || null,
      delivery.id || null,
      delivery.fee ?? null,
      delivery.currency || "CAD",
      delivery.tracking_url || null,
      delivery.courier?.name || null,
      delivery.courier?.phone_number || null,
      delivery.pickup_eta ? new Date(delivery.pickup_eta) : null,
      delivery.dropoff_eta ? new Date(delivery.dropoff_eta) : null,
      JSON.stringify(delivery),
    ],
  );
  return { reused: false, delivery };
}

// ---------------------- Distance helper ----------------------
export function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat); const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function nominatimLookup(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": "FlamesGourmet/1.0 (delivery)" } });
  if (!r.ok) return null;
  const arr = await r.json().catch(() => null);
  if (!Array.isArray(arr) || !arr.length) return null;
  return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
}

const POSTAL_DIGIT_FIX = { O: "0", I: "1", L: "1" };

function digitLikePostalChar(ch) {
  return POSTAL_DIGIT_FIX[String(ch).toUpperCase()] || ch;
}

function normalizeCanadianPostalCodes(value) {
  return String(value || "").replace(
    /\b([A-Z])([0-9OIL])([A-Z])\s*([0-9OIL])([A-Z])([0-9OIL])\b/gi,
    (_, a, b, c, d, e, f) => `${a.toUpperCase()}${digitLikePostalChar(b)}${c.toUpperCase()} ${digitLikePostalChar(d)}${e.toUpperCase()}${digitLikePostalChar(f)}`,
  );
}

export function normalizeDeliveryAddress(address) {
  return normalizeCanadianPostalCodes(address)
    .replace(/[.,;]+/g, " ")
    .replace(/\bontario\b/gi, "ON")
    .replace(/^\s*(?:put|enter|address|addr)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Best-effort geocoder. Free-form user input often contains typos ("MIE"
// instead of "M1E") or leading noise words, so we try a few progressively
// looser variants before giving up.
export async function geocodeAddress(address) {
  if (!address) return null;
  const raw = String(address).trim();
  const fixed = normalizeDeliveryAddress(raw);
  const postal = (fixed.match(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i) || [])[0];
  const withoutFirstWord = fixed.replace(/^\S+\s+/, "");
  const withoutUnit = fixed.replace(/^\s*(?:unit|apt|apartment|suite|ste|#)\s*\S+\s+/i, "");

  // Build a "street + city + postal" variant by keeping only the leading
  // "<num> <name...> <street-type>" from the first comma-segment and dropping
  // any unit/junk that follows it. Handles inputs like
  //   "88 Grangeway Ave 1101 88, Scarborough, ON M1H 0A2, Canada"
  // where the middle "1101 88" (unit) confuses Nominatim.
  const STREET_TYPE = /^(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|cres|crescent|ct|court|pl|place|way|ln|lane|ter|terrace|pkwy|parkway|hwy|highway|trail|circle|cir)$/i;
  const segments = raw.split(",").map((x) => x.trim()).filter(Boolean);
  let trimmedStreet = null;
  if (segments.length >= 2) {
    const tokens = segments[0].split(/\s+/);
    const idx = tokens.findIndex((t) => STREET_TYPE.test(t.replace(/\.$/, "")));
    if (idx > 0) {
      const street = tokens.slice(0, idx + 1).join(" ");
      trimmedStreet = normalizeDeliveryAddress([street, ...segments.slice(1)].join(", "));
    }
  }

  const attempts = [fixed, withoutUnit, trimmedStreet, withoutFirstWord, postal].filter(Boolean);
  const seen = new Set();
  for (const q of attempts) {
    if (seen.has(q)) continue;
    seen.add(q);
    const hit = await nominatimLookup(q);
    if (hit) return hit;
  }
  return null;
}
