// Delivery (Uber Direct) routes.
//   - Admin-scoped: quote / dispatch / cancel / status for a given order.
//   - Public:       webhook receiver from Uber.
//
// All endpoints are no-ops with a clear error until the operator fills in
// the credentials at Admin → Settings → Delivery.

import { Router } from "express";
import express from "express";
import { z } from "zod";
import { pool } from "../db.js";
import {
  getDeliverySettings,
  isDeliveryEnabled,
  assertDeliveryConfigured,
  createQuote,
  
  getDelivery,
  cancelDelivery,
  verifyWebhookSignature,
  geocodeAddress,
  normalizeDeliveryAddress,
  haversineKm,
  dispatchOrderToCourier,
} from "../lib/uber-direct.js";

// ---------------------- Admin router ----------------------
export const deliveryAdminRouter = Router();

deliveryAdminRouter.get("/delivery/status", async (_req, res, next) => {
  try {
    const s = await getDeliverySettings();
    res.json({
      enabled: isDeliveryEnabled(s),
      provider: s.delivery_provider || "uber_direct",
      mode: s.delivery_mode || "sandbox",
      configured: !!(s.uber_customer_id && s.uber_client_id && s.uber_client_secret),
      max_radius_km: Number(s.delivery_max_radius_km || 1),
    });
  } catch (e) { next(e); }
});

async function loadOrder(orderNumber) {
  const [rows] = await pool.query(
    `SELECT id, order_number, customer_name, customer_phone, notes,
            COALESCE(delivery_address, '') AS delivery_address
       FROM orders WHERE order_number = ? LIMIT 1`,
    [orderNumber],
  ).catch(async () => pool.query(
    // Fallback when delivery_address column doesn't exist yet.
    `SELECT id, order_number, customer_name, customer_phone, notes
       FROM orders WHERE order_number = ? LIMIT 1`,
    [orderNumber],
  ));
  return rows[0] || null;
}

deliveryAdminRouter.post("/delivery/:orderNumber/quote", async (req, res, next) => {
  try {
    const s = await getDeliverySettings();
    assertDeliveryConfigured(s);
    const order = await loadOrder(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const dropoff = String(req.body?.dropoff_address || order.delivery_address || "").trim();
    if (!dropoff) return res.status(400).json({ error: "Missing dropoff_address" });

    const quote = await createQuote(s, {
      dropoff_address: dropoff,
      dropoff_phone_number: order.customer_phone,
      dropoff_name: order.customer_name,
    });

    await pool.query(
      `INSERT INTO deliveries (order_id, provider, status, quote_id, fee_cents, currency, dropoff_eta, raw_quote_json)
       VALUES (?, ?, 'quoted', ?, ?, ?, ?, ?)`,
      [
        order.id,
        s.delivery_provider || "uber_direct",
        quote.id || null,
        quote.fee ?? null,
        quote.currency || "CAD",
        quote.dropoff_eta ? new Date(quote.dropoff_eta) : null,
        JSON.stringify(quote),
      ],
    );
    res.json({ ok: true, quote });
  } catch (e) { next(e); }
});

const dispatchSchema = z.object({ quote_id: z.string().optional() });

deliveryAdminRouter.post("/delivery/:orderNumber/dispatch", async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const result = await dispatchOrderToCourier(pool, order.id);
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

deliveryAdminRouter.post("/delivery/:orderNumber/cancel", async (req, res, next) => {
  try {
    const s = await getDeliverySettings();
    assertDeliveryConfigured(s);
    const order = await loadOrder(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const [rows] = await pool.query(
      `SELECT delivery_id FROM deliveries WHERE order_id = ? AND delivery_id IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
      [order.id],
    );
    const did = rows[0]?.delivery_id;
    if (!did) return res.status(400).json({ error: "No active delivery for this order" });
    const result = await cancelDelivery(s, did);
    await pool.query(`UPDATE deliveries SET status = 'canceled' WHERE order_id = ? AND delivery_id = ?`, [order.id, did]);
    res.json({ ok: true, result });
  } catch (e) { next(e); }
});

deliveryAdminRouter.get("/delivery/:orderNumber", async (req, res, next) => {
  try {
    const s = await getDeliverySettings();
    const order = await loadOrder(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const [rows] = await pool.query(
      `SELECT id, status, quote_id, delivery_id, fee_cents, currency, tracking_url,
              courier_name, courier_phone, pickup_eta, dropoff_eta, updated_at
         FROM deliveries WHERE order_id = ? ORDER BY id DESC`,
      [order.id],
    );
    const latest = rows[0] || null;
    let live = null;
    if (latest?.delivery_id && isDeliveryEnabled(s)) {
      try { live = await getDelivery(s, latest.delivery_id); } catch { /* ignore */ }
    }
    res.json({ deliveries: rows, latest, live });
  } catch (e) { next(e); }
});

// ---------------------- Public router (quote + webhook + live) ----------------------
export const deliveryPublicRouter = Router();

// Public live-tracking feed for the order status page. Returns the data needed
// to render an in-app map (pickup, dropoff, current courier location).
// Geocoded coordinates are cached in-memory for 10 minutes per address.
const _geoCache = new Map(); // key -> { at, value }
async function cachedGeocode(addr) {
  if (!addr) return null;
  const hit = _geoCache.get(addr);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const v = await geocodeAddress(addr).catch(() => null);
  _geoCache.set(addr, { at: Date.now(), value: v });
  return v;
}

deliveryPublicRouter.get("/delivery/:orderNumber/live", async (req, res, next) => {
  try {
    const num = String(req.params.orderNumber || "").trim().slice(0, 64);
    const s = await getDeliverySettings();
    const order = await loadOrder(num);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Pull customer-side geo + delivery_lat/lng (best-effort: tolerate missing
    // columns on legacy installs that haven't run migration 046).
    let extras = { customer_lat: null, customer_lng: null, customer_loc_at: null, delivery_lat: null, delivery_lng: null };
    try {
      const [orows] = await pool.query(
        `SELECT customer_lat, customer_lng, customer_loc_at, delivery_lat, delivery_lng
           FROM orders WHERE id = ? LIMIT 1`,
        [order.id],
      );
      if (orows[0]) extras = orows[0];
    } catch { /* columns missing */ }

    const [rows] = await pool.query(
      `SELECT id, status, tracking_url, delivery_id, courier_name, courier_phone,
              pickup_eta, dropoff_eta
         FROM deliveries WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [order.id],
    );
    const latest = rows[0] || null;

    let courier = null;
    if (latest?.delivery_id && isDeliveryEnabled(s)) {
      try {
        const live = await getDelivery(s, latest.delivery_id);
        const loc = live?.courier?.location || live?.courier?.current_location;
        if (loc && (loc.lat ?? loc.latitude) != null) {
          courier = { lat: Number(loc.lat ?? loc.latitude), lng: Number(loc.lng ?? loc.longitude) };
          // Persist last-known courier location for telemetry / replay.
          await pool.query(
            `UPDATE deliveries SET courier_location_json = ?, updated_at = NOW() WHERE id = ?`,
            [JSON.stringify({ ...courier, at: new Date().toISOString() }), latest.id],
          ).catch(() => {});
        }
      } catch { /* ignore */ }
    }

    // Dropoff: prefer the customer's live device fix, then their submitted
    // lat/lng, then geocoded address. Pickup is always geocoded (static).
    let dropoff = null;
    if (extras.customer_lat != null && extras.customer_lng != null) {
      dropoff = { lat: Number(extras.customer_lat), lng: Number(extras.customer_lng) };
    } else if (extras.delivery_lat != null && extras.delivery_lng != null) {
      dropoff = { lat: Number(extras.delivery_lat), lng: Number(extras.delivery_lng) };
    } else {
      dropoff = await cachedGeocode(order.delivery_address);
    }
    const pickup = await cachedGeocode(s.delivery_pickup_address);

    res.json({
      status: latest?.status || null,
      trackingUrl: latest?.tracking_url || null,
      courierName: latest?.courier_name || null,
      courierPhone: latest?.courier_phone || null,
      dropoffEta: latest?.dropoff_eta || null,
      pickup,
      dropoff,
      courier,
      customer: (extras.customer_lat != null && extras.customer_lng != null)
        ? { lat: Number(extras.customer_lat), lng: Number(extras.customer_lng), at: extras.customer_loc_at }
        : null,
    });
  } catch (e) { next(e); }
});

// Customer device pushes its live GPS fix here while the order is in flight.
// We accept anonymous posts so guests can stream their location, but require
// the order to be active (not finished/cancelled) to avoid stale writes.
const locSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10000).optional(),
});
deliveryPublicRouter.post("/delivery/:orderNumber/location", express.json(), async (req, res, next) => {
  try {
    const num = String(req.params.orderNumber || "").trim().slice(0, 64);
    const parsed = locSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid coordinates" });
    const [rows] = await pool.query(
      `SELECT id, status FROM orders WHERE order_number = ? LIMIT 1`,
      [num],
    );
    const o = rows[0];
    if (!o) return res.status(404).json({ error: "Order not found" });
    if (["picked_up", "cancelled", "delivered"].includes(String(o.status))) {
      return res.json({ ok: true, ignored: true });
    }
    await pool.query(
      `UPDATE orders SET customer_lat = ?, customer_lng = ?, customer_loc_at = NOW() WHERE id = ?`,
      [parsed.data.lat, parsed.data.lng, o.id],
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});





// Customer-side quote before checkout. Refuses outside the radius without
// spending an Uber API call (geocode + Haversine first).
deliveryPublicRouter.post("/delivery/quote", express.json(), async (req, res, next) => {
  try {
    const s = await getDeliverySettings();
    if (!isDeliveryEnabled(s)) return res.status(503).json({ error: "Delivery is currently unavailable." });
    assertDeliveryConfigured(s);

    const dropoff = normalizeDeliveryAddress(req.body?.address || "");
    if (!dropoff) return res.status(400).json({ error: "Missing address" });

    const maxKm = Number(s.delivery_max_radius_km || 1);
    // Prefer client-supplied coordinates (from Photon autocomplete) to skip
    // the geocoding step entirely — faster and immune to Nominatim quirks.
    const clientLat = Number(req.body?.lat);
    const clientLng = Number(req.body?.lng);
    const hasClientGeo = Number.isFinite(clientLat) && Number.isFinite(clientLng);
    const [pickupGeo, dropoffGeo] = await Promise.all([
      geocodeAddress(s.delivery_pickup_address),
      hasClientGeo ? Promise.resolve({ lat: clientLat, lng: clientLng }) : geocodeAddress(dropoff),
    ]);
    if (!dropoffGeo) return res.status(400).json({ error: "Could not locate that address." });
    if (!pickupGeo) {
      return res.status(500).json({
        error: "Store pickup address is missing or could not be located. Ask admin to set it in Settings → Delivery.",
        code: "pickup_not_configured",
      });
    }
    const distanceKm = haversineKm(pickupGeo, dropoffGeo);
    if (Number.isFinite(distanceKm) && distanceKm > maxKm) {
      return res.status(400).json({
        error: `Sorry, we only deliver within ${maxKm} km. Your address is ~${distanceKm.toFixed(2)} km away.`,
        code: "out_of_radius",
        distance_km: distanceKm,
      });
    }

    const quote = await createQuote(s, {
      dropoff_address: dropoff,
      dropoff_phone_number: String(req.body?.phone || ""),
      dropoff_name: String(req.body?.name || "Customer"),
      order_value: req.body?.order_value,
    });
    res.json({
      ok: true,
      quote_id: quote.id,
      fee_cents: quote.fee,
      currency: quote.currency || "CAD",
      eta: quote.dropoff_eta,
      distance_km: distanceKm,
    });
  } catch (e) { next(e); }
});

// Simple GET responder so Uber's dashboard URL-validation check (and manual
// browser checks) get a 200 instead of Express's default "Cannot GET" 404.
deliveryPublicRouter.get("/delivery/webhook", (_req, res) => {
  res.json({ ok: true, message: "Uber Direct webhook endpoint. POST only." });
});

// Uber → us. Needs the raw body for signature verification.
deliveryPublicRouter.post(
  "/delivery/webhook",
  async (req, res) => {
    try {
      const s = await getDeliverySettings();
      const sig = req.header("X-Uber-Signature") || req.header("x-uber-signature") || "";
      // Prefer the raw bytes captured by the global json parser's verify hook.
      // Fall back to re-serializing the parsed body so verification still has
      // something to hash if the upstream middleware order ever changes.
      const raw = req.rawBody instanceof Buffer
        ? req.rawBody
        : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
      if (s.uber_webhook_signing_key) {
        if (!verifyWebhookSignature(raw, sig, s.uber_webhook_signing_key)) {
          return res.status(401).json({ error: "Invalid signature" });
        }
      }
      let payload; try { payload = JSON.parse(raw.toString("utf8")); } catch { payload = {}; }
      const did = payload?.data?.id || payload?.delivery_id || payload?.id;
      const status = payload?.data?.status || payload?.status || null;
      if (did) {
        await pool.query(
          `UPDATE deliveries SET status = COALESCE(?, status), last_event_json = ?, updated_at = NOW()
             WHERE delivery_id = ?`,
          [status, JSON.stringify(payload), did],
        );
        // Mirror final states onto the order so the kitchen UI shows them.
        if (status === "delivered" || status === "canceled" || status === "returned") {
          const [drows] = await pool.query(`SELECT order_id FROM deliveries WHERE delivery_id = ? LIMIT 1`, [did]);
          const oid = drows[0]?.order_id;
          if (oid) {
            const mapped = status === "delivered" ? "picked_up" : "cancelled";
            await pool.query(`UPDATE orders SET status = ? WHERE id = ?`, [mapped, oid]);
          }
        }
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[delivery webhook]", e);
      res.status(200).json({ ok: false }); // swallow so Uber doesn't retry-storm
    }
  },
);
