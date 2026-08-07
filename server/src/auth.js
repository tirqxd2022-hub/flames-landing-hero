import jwt from "jsonwebtoken";

const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

export function hasJwtSecret() {
  return Boolean(process.env.JWT_SECRET);
}

function getSecret() {
  return process.env.JWT_SECRET || null;
}

export function signAdminToken(payload) {
  const secret = getSecret();
  if (!secret) {
    const err = new Error("JWT_SECRET environment variable is required");
    err.status = 503;
    throw err;
  }
  return jwt.sign(payload, secret, { expiresIn: EXPIRES });
}

export function requireAdmin(req, res, next) {
  const secret = getSecret();
  if (!secret) return res.status(503).json({ error: "JWT_SECRET environment variable is required" });
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.admin = jwt.verify(header.slice(7), secret);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireSuper(req, res, next) {
  if (!req.admin?.is_super) return res.status(403).json({ error: "Super Admin only." });
  next();
}
