import { googleCredentials } from "./config";
import type { GmailMessage } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/* -------------------------------------------------------------------------- */
/* Minimal Gmail API shapes (only the fields we read)                         */
/* -------------------------------------------------------------------------- */

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailApiMessage {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: GmailPart;
}

interface GmailLabel {
  id: string;
  name: string;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Exchange a long-lived refresh token for a short-lived access token. */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = googleCredentials();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google token response contained no access_token");
  return json.access_token;
}

/** Resolve the email address behind an access token. */
export async function getProfileEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL_BASE}/profile`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail profile lookup failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { emailAddress?: string };
  return json.emailAddress ?? "unknown";
}

/** List message IDs matching a Gmail search query. */
export async function listMessageIds(
  accessToken: string,
  query: string,
  maxResults: number,
): Promise<string[]> {
  const url = new URL(`${GMAIL_BASE}/messages`);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));

  const res = await fetch(url.toString(), { headers: authHeaders(accessToken), cache: "no-store" });
  if (!res.ok) throw new Error(`Gmail list failed (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as { messages?: { id: string }[] };
  return (json.messages ?? []).map((m) => m.id);
}

/** Fetch a single message with its decoded body text. */
export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const url = new URL(`${GMAIL_BASE}/messages/${id}`);
  url.searchParams.set("format", "full");

  const res = await fetch(url.toString(), { headers: authHeaders(accessToken), cache: "no-store" });
  if (!res.ok) throw new Error(`Gmail get ${id} failed (${res.status}): ${await res.text()}`);

  const msg = (await res.json()) as GmailApiMessage;
  const headers = msg.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => (h.name ?? "").toLowerCase() === name.toLowerCase())?.value ?? "";

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: header("Subject"),
    from: header("From"),
    date: header("Date"),
    body: extractBody(msg.payload) || msg.snippet || "",
  };
}

/** Walk the MIME tree and concatenate all text/plain parts. */
function extractBody(part?: GmailPart): string {
  if (!part) return "";

  const chunks: string[] = [];

  if (part.mimeType === "text/plain" && part.body?.data) {
    chunks.push(decodeBase64Url(part.body.data));
  }

  for (const child of part.parts ?? []) {
    const nested = extractBody(child);
    if (nested) chunks.push(nested);
  }

  // Fall back to text/html when no plain part exists.
  if (chunks.length === 0 && part.mimeType === "text/html" && part.body?.data) {
    chunks.push(stripHtml(decodeBase64Url(part.body.data)));
  }

  return chunks.join("\n").trim();
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Optional label-based de-duplication                                        */
/* -------------------------------------------------------------------------- */

/** Return the ID of a label, creating it when missing. Requires gmail.modify. */
export async function ensureLabel(accessToken: string, name: string): Promise<string> {
  const listRes = await fetch(`${GMAIL_BASE}/labels`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
  });
  if (!listRes.ok) throw new Error(`Gmail label list failed (${listRes.status}): ${await listRes.text()}`);
  const list = (await listRes.json()) as { labels?: GmailLabel[] };
  const existing = (list.labels ?? []).find((l) => l.name === name);
  if (existing) return existing.id;

  const createRes = await fetch(`${GMAIL_BASE}/labels`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  if (!createRes.ok) throw new Error(`Gmail label create failed (${createRes.status}): ${await createRes.text()}`);
  const created = (await createRes.json()) as GmailLabel;
  return created.id;
}

/** Apply a label to a message. Requires gmail.modify. */
export async function addLabelToMessage(
  accessToken: string,
  messageId: string,
  labelId: string,
): Promise<void> {
  const res = await fetch(`${GMAIL_BASE}/messages/${messageId}/modify`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
  if (!res.ok) throw new Error(`Gmail modify failed (${res.status}): ${await res.text()}`);
}
