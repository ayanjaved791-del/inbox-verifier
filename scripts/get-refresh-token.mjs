#!/usr/bin/env node
/**
 * Mint a Google OAuth refresh token for the Inbox Verifier.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run token
 *
 * Optional:
 *   GMAIL_MARK_PROCESSED=true   request the gmail.modify scope (needed for
 *                               label-based de-duplication) instead of the
 *                               default read-only scope.
 *   OAUTH_PORT=53682            local callback port.
 *
 * Before running, add this authorized redirect URI to your OAuth client in
 * Google Cloud Console:
 *   http://localhost:53682/oauth2callback
 */
import http from "node:http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = Number(process.env.OAUTH_PORT ?? 53682);
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const SCOPE =
  process.env.GMAIL_MARK_PROCESSED === "true"
    ? "https://www.googleapis.com/auth/gmail.modify"
    : "https://www.googleapis.com/auth/gmail.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT_URI);

  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Authorization failed: ${error ?? "missing code"}`);
    console.error("Authorization failed:", error ?? "missing code");
    server.close();
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const json = await tokenRes.json();

    res.writeHead(tokenRes.ok ? 200 : 500, { "Content-Type": "text/plain" });
    res.end(tokenRes.ok ? "Done. You can close this tab." : "Token exchange failed. See terminal.");

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", JSON.stringify(json));
      return;
    }

    console.log("\n================ REFRESH TOKEN ================");
    console.log(json.refresh_token ?? "(none returned)");
    console.log("===============================================\n");
    console.log("Add it to GMAIL_REFRESH_TOKENS in your Vercel environment.");
    if (!json.refresh_token) {
      console.log(
        "No refresh_token was returned. Revoke prior access at https://myaccount.google.com/permissions and run again.",
      );
    }
  } catch (err) {
    res.writeHead(500).end("Token exchange error. See terminal.");
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`\nScope: ${SCOPE}`);
  console.log(`\nOpen this URL in a browser and approve access:\n\n${authUrl.toString()}\n`);
});
