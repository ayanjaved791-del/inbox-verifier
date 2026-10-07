import type { AccountConfig, AppConfig } from "./types";

/** Read a required environment variable or throw a clear error. */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

/** Google OAuth client credentials, used to mint access tokens. */
export function googleCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
  };
}

/**
 * Build the runtime config from environment variables.
 *
 * Multiple Gmail accounts are supported by comma-separating their refresh
 * tokens in GMAIL_REFRESH_TOKENS. An optional GMAIL_ACCOUNT_<n>_EMAIL value
 * provides a friendly label for each token by position.
 */
export function loadConfig(): AppConfig {
  const raw = process.env.GMAIL_REFRESH_TOKENS ?? process.env.GMAIL_REFRESH_TOKEN ?? "";
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error(
      "No Gmail refresh tokens configured. Set GMAIL_REFRESH_TOKENS (comma-separated for multiple accounts).",
    );
  }

  const accounts: AccountConfig[] = tokens.map((refreshToken, index) => ({
    refreshToken,
    email: process.env[`GMAIL_ACCOUNT_${index + 1}_EMAIL`]?.trim() || undefined,
  }));

  return {
    accounts,
    lookbackMinutes: toPositiveInt(process.env.LOOKBACK_MINUTES, 180),
    maxMessages: toPositiveInt(process.env.MAX_MESSAGES, 25),
    markProcessed: process.env.GMAIL_MARK_PROCESSED === "true",
    processedLabel: process.env.GMAIL_PROCESSED_LABEL?.trim() || "CREAO/OTP-Sent",
    notifyAlways: process.env.NOTIFY_ALWAYS === "true",
  };
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
