/**
 * Unified token helpers. Both admin_users and customers share JWTs signed
 * with the same secret. `kind` distinguishes them.
 */
import jwt from "jsonwebtoken";

const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

export function hasUserJwtSecret() {
  return Boolean(process.env.JWT_SECRET);
}

function getSecret() {
  return process.env.JWT_SECRET || null;
}

export function signToken(payload) {
  const secret = getSecret();
  if (!secret) {
    const err = new Error("JWT_SECRET environment variable is required");
    err.status = 503;
    throw err;
  }
  return jwt.sign(payload, secret, { expiresIn: EXPIRES });
}

export function verifyAnyToken(req, _res, next) {
  const secret = getSecret();
  if (!secret) return next();
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return next();
  try { req.auth = jwt.verify(h.slice(7), secret); } catch { /* ignore */ }
  next();
}

export function requireUser(req, res, next) {
  if (!hasUserJwtSecret()) return res.status(503).json({ error: "JWT_SECRET environment variable is required" });
  verifyAnyToken(req, res, () => {
    if (!req.auth) return res.status(401).json({ error: "Login required" });
    next();
  });
}

export function requireStaff(req, res, next) {
  if (!hasUserJwtSecret()) return res.status(503).json({ error: "JWT_SECRET environment variable is required" });
  verifyAnyToken(req, res, () => {
    if (!req.auth) return res.status(401).json({ error: "Login required" });
    if (req.auth.kind !== "admin") return res.status(403).json({ error: "Staff only" });
    next();
  });
}
