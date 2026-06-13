import { google } from "googleapis";
import { GOOGLE_CALENDAR_SCOPE } from "../config/constants.js";

/**
 * Build a fresh OAuth2 client from env. One per request/sync — never share auth state
 * across users.
 */
export function makeOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set.");
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

/**
 * Exchange a one-time auth code (from the frontend auth-code flow) for tokens, then read
 * the user's basic profile. Returns { tokens, profile }.
 *
 * @react-oauth/google's `useGoogleLogin({ flow: 'auth-code' })` defaults to a POPUP
 * (ux_mode 'popup'), and Google requires the code exchange for the popup flow to use the
 * special redirect_uri 'postmessage'. If you switch the frontend to ux_mode 'redirect',
 * set OAUTH_REDIRECT_MODE=redirect so we use the real callback URI instead.
 */
export async function exchangeCodeForTokens(code) {
  const client = makeOAuthClient();
  const redirectUri =
    process.env.OAUTH_REDIRECT_MODE === "redirect"
      ? process.env.GOOGLE_REDIRECT_URI
      : "postmessage";

  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  client.setCredentials(tokens);

  // Pull the profile so we know whose calendar this is.
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  return { tokens, profile };
}

/**
 * Build an authorized OAuth2 client for a stored user, refreshing the access token if we
 * have a refresh token. The googleapis client auto-refreshes when given a refresh_token.
 */
export function authedClientForUser(user) {
  const client = makeOAuthClient();
  client.setCredentials({
    refresh_token: user.refreshToken || undefined,
    access_token: user.accessToken || undefined,
    expiry_date: user.accessTokenExpiry ? new Date(user.accessTokenExpiry).getTime() : undefined,
  });
  return client;
}

export { GOOGLE_CALENDAR_SCOPE };
