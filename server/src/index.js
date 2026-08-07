import "dotenv/config";
// Default app timezone to Canada (Eastern) unless overridden by env.
process.env.TZ = process.env.TZ || "America/Toronto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { imgRouter } from "./routes/img.js";
import { deliveryAdminRouter, deliveryPublicRouter } from "./routes/delivery.js";
import { attendanceSyncRouter } from "./routes/attendance.js";
import { imageFallback } from "./lib/image-fallback.js";
import { mediaCacheControl } from "./lib/cache-settings.js";

const app = express();
// cPanel/Passenger sits behind Apache and sends X-Forwarded-For. Express must
// trust that single proxy hop or express-rate-limit rejects requests with
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: false,
}));
// Keep the raw bytes around for routes that need HMAC verification
// (e.g. the Uber Direct webhook). The global json parser otherwise eats them.
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// Serve uploaded media. imageFallback() lets old .jpg URLs resolve to the
// newly-optimized .avif file so links keep working after optimization.
import { UPLOADS_DIR, PRODUCTS_DIR } from "./lib/uploads.js";
app.use("/uploads", mediaCacheControl(), imageFallback(UPLOADS_DIR), express.static(UPLOADS_DIR));
app.use("/api/uploads", mediaCacheControl(), imageFallback(UPLOADS_DIR), express.static(UPLOADS_DIR));
app.use("/products", mediaCacheControl(), imageFallback(PRODUCTS_DIR), express.static(PRODUCTS_DIR));
app.use("/api/products", mediaCacheControl(), imageFallback(PRODUCTS_DIR), express.static(PRODUCTS_DIR));

// Light rate limits
const orderLimit = rateLimit({ windowMs: 60_000, max: 20 });
const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 10 });
app.use(["/orders", "/api/orders"], orderLimit);
app.use(["/admin/login", "/api/admin/login"], loginLimit);

function registerApiRoutes(basePath) {
  const prefix = basePath === "/" ? "" : basePath;
  const mountPath = basePath || "/";

  app.get(`${prefix}/health`, (_req, res) => res.json({ ok: true }));
  app.use(`${prefix}/auth`, authRouter);
  app.use(mountPath, imgRouter);
  app.use(mountPath, publicRouter);
  app.use(mountPath, deliveryPublicRouter);
  app.use(`${prefix}/admin`, adminRouter);
  app.use(`${prefix}/admin`, deliveryAdminRouter);
  app.use(mountPath, attendanceSyncRouter);
}

// Mount under both /api and / because cPanel Passenger may strip /api.
registerApiRoutes("/api");
registerApiRoutes("");

app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  const status = err.status || 500;
  res.status(status).json({ error: status < 500 ? err.message || "Bad request" : "Internal server error" });
});

const isPassenger = typeof globalThis.PhusionPassenger !== "undefined";
const listenTarget = isPassenger ? "passenger" : process.env.PORT || 4000;
let serverStarted = false;

export function startServer() {
  if (serverStarted) return;
  serverStarted = true;
  if (isPassenger) {
    // eslint-disable-next-line no-undef
    PhusionPassenger.configure({ autoInstall: false });
  }
  app.listen(listenTarget, () => {
    console.log(`Flames Gourmet API listening on ${listenTarget} (${process.env.NODE_ENV || "development"})`);
  });
  // Ensure late-migration columns exist on legacy databases before any
  // route queries them (prevents "Unknown column 'cash_received'" 500s).
  import("./lib/ensure-schema.js").then(({ ensureOrderSchema }) => ensureOrderSchema()).catch(() => {});
  // Background sweeper: cancel stale unpaid online orders every minute.
  import("./lib/auto-cancel.js").then(({ autoCancelStaleUnpaidOrders }) => {
    autoCancelStaleUnpaidOrders(true);
    setInterval(() => autoCancelStaleUnpaidOrders(true), 60_000).unref?.();
  }).catch(() => {});
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isPassenger || isMainModule) startServer();

export { app };
export default app;
