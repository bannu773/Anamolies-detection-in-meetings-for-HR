import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/constants.js";

/**
 * Decodes the Bearer token from the Authorization header, if present.
 * Attaches `req.user = { email, isAdmin }` or leaves it undefined.
 * Never rejects the request — use `requireAdmin` for that.
 */
export function optionalUser(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // expired / invalid — treat as anonymous
      req.user = null;
    }
  }
  next();
}

/**
 * Middleware that requires a valid admin JWT.
 * Returns 401 if no token, 403 if token is valid but not admin.
 */
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: "Authentication required.",
      hint: "Connect your Google account and use an admin email.",
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      error: "Session expired or invalid. Please reconnect.",
      detail: err.message,
    });
  }

  if (!payload.isAdmin) {
    return res.status(403).json({
      error: "Admin access required for per-meeting cost details.",
      hint: "Individual contributor costs reveal salary data — restricted to admins.",
    });
  }

  req.user = payload;
  next();
}
