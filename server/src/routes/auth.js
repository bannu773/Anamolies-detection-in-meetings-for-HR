import { Router } from "express";
import jwt from "jsonwebtoken";
import { exchangeCodeForTokens } from "../calendar/googleClient.js";
import { User } from "../models/User.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/constants.js";

const router = Router();

/** Is this email configured as an admin? */
function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}

/**
 * POST /auth/google
 * Body: { code }  — one-time auth code from the frontend auth-code flow.
 * Exchanges it server-side for tokens, persists the refresh token, returns only
 * non-sensitive profile info, AND a short-lived signed session JWT.
 * The session JWT is signed with the server's JWT_SECRET and encodes
 * { email, isAdmin, iat, exp } — no raw tokens. The client stores it in
 * sessionStorage and sends it as `Authorization: Bearer <token>` on admin routes.
 */
router.post("/", async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Missing auth code." });

  try {
    const { tokens, profile } = await exchangeCodeForTokens(code);
    const email = (profile.email || "").toLowerCase();
    if (!email) return res.status(400).json({ error: "Could not read Google profile email." });

    const adminFlag = isAdminEmail(email);

    const update = {
      email,
      name: profile.name || "",
      googleId: profile.id || null,
      accessToken: tokens.access_token || null,
      accessTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      isAdmin: adminFlag,
    };
    // Google only returns a refresh_token on first consent — keep the old one otherwise.
    if (tokens.refresh_token) update.refreshToken = tokens.refresh_token;

    const user = await User.findOneAndUpdate({ email }, { $set: update }, {
      upsert: true,
      new: true,
    });

    // Sign a short-lived session JWT (no raw tokens inside — just identity claims).
    const sessionToken = jwt.sign(
      { email: user.email, name: user.name, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      user: { email: user.email, name: user.name, isAdmin: user.isAdmin },
      token: sessionToken,                       // client stores in sessionStorage
      hasRefreshToken: Boolean(user.refreshToken),
    });
  } catch (err) {
    console.error("[auth/google] error:", err.message);
    res.status(500).json({ error: "OAuth exchange failed.", detail: err.message });
  }
});

export default router;
