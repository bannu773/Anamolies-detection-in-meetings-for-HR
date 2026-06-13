/**
 * Client-side session token helpers (Phase 6 — Privacy).
 *
 * The server signs a JWT on Google login containing { email, name, isAdmin }.
 * We store it in sessionStorage (clears when the browser tab closes — intentional:
 * no persistent login state on shared/lab machines).
 *
 * We decode the payload client-side using plain base64 — no jwt library needed
 * because we're NOT verifying the signature here (the server does that on each
 * admin API call). We only read public claims for UI decisions.
 */

const TOKEN_KEY = "hr_session_token";

/** Save the token returned by POST /auth/google. */
export function saveToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
}

/** Retrieve the stored token, or null. */
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Remove the stored token (logout). */
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Decode the JWT payload (no signature verification — server verifies on each call).
 * Returns null if no token or token is malformed.
 */
function decodePayload() {
  const token = getToken();
  if (!token) return null;
  try {
    const base64 = token.split(".")[1];
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Whether the current session token represents an admin user.
 * Also checks that the token hasn't expired (exp claim, in seconds).
 */
export function isAdmin() {
  const payload = decodePayload();
  if (!payload) return false;
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    clearToken(); // expired — clean up
    return false;
  }
  return Boolean(payload.isAdmin);
}

/**
 * Return the user profile from the token, or null.
 * { email, name, isAdmin }
 */
export function getSessionUser() {
  const payload = decodePayload();
  if (!payload) return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    clearToken();
    return null;
  }
  return { email: payload.email, name: payload.name, isAdmin: Boolean(payload.isAdmin) };
}
