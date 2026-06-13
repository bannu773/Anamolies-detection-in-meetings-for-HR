import mongoose from "mongoose";

/**
 * A user who has connected their Google Calendar. We persist the refresh token here so
 * we can re-sync without forcing a re-login. Tokens are backend-only and never sent to
 * the client.
 *
 * `isAdmin` gates rate configuration and individual-salary visibility. It is derived at
 * connect time from the ADMIN_EMAILS env list.
 */
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: "" },
    googleId: { type: String, default: null },

    // OAuth tokens (backend-only).
    refreshToken: { type: String, default: null },
    accessToken: { type: String, default: null },
    accessTokenExpiry: { type: Date, default: null },

    isAdmin: { type: Boolean, default: false },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
