import { Router } from "express";
import { pool } from "../db.js";
import { resolveImageUrl } from "../lib/uploads.js";
import { invalidateDeliverySettingsCache, clearUberTokenCache } from "../lib/uber-direct.js";

const IMAGE_SETTING_KEYS = new Set(["logo_url", "favicon_url", "hero_url"]);

export const settingsRouter = Router();

const KEYS = [
  // Site
  "site_title", "site_tagline", "logo_url", "favicon_url", "announcement_text", "announcement_speed",
  // Contact
  "contact_email", "contact_phone", "contact_whatsapp", "contact_address",
  // Business / Tax
  "business_legal_name", "gst_number", "gst_rate_percent", "hsn_code",
  // Shipping (distance-based provisions — not yet active)
  "store_zip_code", "shipping_distance_enabled",
  // Social
  "social_instagram", "social_facebook", "social_pinterest", "social_youtube",
  // Payments
  "payments_enabled", "payments_provider", "payments_mode",
  "payments_public_key", "payments_secret_key", "payments_webhook_secret",
  "payments_merchant_id", "payments_account_id", "payments_notes",
  // AI Assistant (super-admin only via UI gate; stored here for runtime override of env)
  "ai_fallback_order",
  // Notifications (sound rules JSON)
  "notification_rules",
  "ai_gemini_key", "ai_gemini_model",
  "ai_openai_key", "ai_openai_model",
  "ai_groq_key", "ai_groq_model",
  "ai_deepseek_key", "ai_deepseek_model",
  // Delivery (Uber Direct)
  "delivery_enabled", "delivery_provider", "delivery_mode",
  "uber_customer_id", "uber_client_id", "uber_client_secret", "uber_webhook_signing_key",
  "uber_customer_id_sandbox", "uber_client_id_sandbox", "uber_client_secret_sandbox", "uber_webhook_signing_key_sandbox",
  "uber_customer_id_live", "uber_client_id_live", "uber_client_secret_live", "uber_webhook_signing_key_live",
  "delivery_pickup_name", "delivery_pickup_phone", "delivery_pickup_address", "delivery_pickup_notes",
  "delivery_max_radius_km", "delivery_default_tip_cents", "delivery_undeliverable_action",
  "delivery_packaging_fee",
  // Attendance sync (super-admin)
  "attendance_sync_api_key", "attendance_webhook_url",
];

const AI_SECRET_KEYS = new Set([
  "ai_gemini_key", "ai_openai_key", "ai_groq_key", "ai_deepseek_key",
  "uber_client_secret", "uber_webhook_signing_key",
  "uber_client_secret_sandbox", "uber_webhook_signing_key_sandbox",
  "uber_client_secret_live", "uber_webhook_signing_key_live",
  "attendance_sync_api_key",
]);
const SUPER_ONLY_KEYS = new Set([
  "ai_fallback_order",
  "ai_gemini_key", "ai_gemini_model",
  "ai_openai_key", "ai_openai_model",
  "ai_groq_key", "ai_groq_model",
  "ai_deepseek_key", "ai_deepseek_model",
  "delivery_enabled", "delivery_provider", "delivery_mode",
  "uber_customer_id", "uber_client_id", "uber_client_secret", "uber_webhook_signing_key",
  "uber_customer_id_sandbox", "uber_client_id_sandbox", "uber_client_secret_sandbox", "uber_webhook_signing_key_sandbox",
  "uber_customer_id_live", "uber_client_id_live", "uber_client_secret_live", "uber_webhook_signing_key_live",
  "delivery_pickup_name", "delivery_pickup_phone", "delivery_pickup_address", "delivery_pickup_notes",
  "delivery_max_radius_km", "delivery_default_tip_cents", "delivery_undeliverable_action",
  "delivery_packaging_fee",
  "attendance_sync_api_key", "attendance_webhook_url",
]);


settingsRouter.get("/settings", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT k, v FROM site_settings WHERE k IN (${KEYS.map(() => "?").join(",")})`,
      KEYS,
    );
    const isSuper = !!req.admin?.is_super;
    const out = {};
    for (const k of KEYS) out[k] = "";
    for (const r of rows) {
      let v = r.v || "";
      if (!isSuper && AI_SECRET_KEYS.has(r.k) && v) v = "********";
      out[r.k] = v;
    }
    res.json({ settings: out });
  } catch (e) { next(e); }
});

settingsRouter.put("/settings", async (req, res, next) => {
  try {
    const body = req.body || {};
    const isSuper = !!req.admin?.is_super;
    for (const k of KEYS) {
      if (k in body) {
        if (SUPER_ONLY_KEYS.has(k) && !isSuper) continue;
        let v = String(body[k] ?? "").slice(0, 5000);
        // Don't overwrite stored key when UI sends the masked placeholder.
        if (AI_SECRET_KEYS.has(k) && /^\*+$/.test(v)) continue;
        await pool.query(
          `INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)`,
          [k, v],
        );
      }
    }
    invalidateDeliverySettingsCache();
    clearUberTokenCache();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Public read of safe settings (used by storefront for logo/contact/etc.).
export const publicSettingsRouter = Router();
const PUBLIC_KEYS = [
  "site_title", "site_tagline", "logo_url", "favicon_url", "announcement_text", "announcement_speed",
  "contact_email", "contact_phone", "contact_whatsapp", "contact_address",
  "gst_rate_percent", "delivery_packaging_fee",
  "notification_rules",
  "social_instagram", "social_facebook", "social_pinterest", "social_youtube",
];
publicSettingsRouter.get("/site-settings", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT k, v FROM site_settings WHERE k IN (${PUBLIC_KEYS.map(() => "?").join(",")})`,
      PUBLIC_KEYS,
    );
    const out = {};
    for (const k of PUBLIC_KEYS) out[k] = "";
    for (const r of rows) {
      const v = r.v || "";
      out[r.k] = IMAGE_SETTING_KEYS.has(r.k) && v ? resolveImageUrl(v) : v;
    }
    res.json(out);
  } catch (e) { next(e); }
});
