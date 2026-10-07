import type { CheckSummary } from "./types";

export interface NotifyResult {
  channel: string;
  ok: boolean;
  detail?: string;
}

/** Render a compact, human-readable alert for a run. */
export function formatSummary(summary: CheckSummary): string {
  const lines: string[] = [];
  lines.push(`🔐 Verification codes — ${summary.codesFound} found`);
  lines.push("");

  for (const finding of summary.findings) {
    const codes = finding.codes.map((c) => c.code).join(", ");
    lines.push(`• ${codes}  —  ${finding.from}`);
    lines.push(`  ${finding.subject}  (${finding.date})`);
  }

  if (summary.findings.length === 0) {
    lines.push("No new verification codes.");
  }

  if (summary.errors.length > 0) {
    lines.push("");
    lines.push("⚠️ Errors:");
    for (const err of summary.errors) {
      lines.push(`• ${err.account}: ${err.error}`);
    }
  }

  return lines.join("\n");
}

/**
 * Dispatch a summary to every configured notification channel.
 * Channels are independent: one failing does not stop the others.
 */
export async function notify(summary: CheckSummary): Promise<NotifyResult[]> {
  const text = formatSummary(summary);
  const results: NotifyResult[] = [];

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChat = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && telegramChat) {
    results.push(await sendTelegram(telegramToken, telegramChat, text));
  }

  const webhook = process.env.NOTIFY_WEBHOOK_URL;
  if (webhook) {
    results.push(await sendWebhook(webhook, text, summary));
  }

  if (results.length === 0) {
    // No external channel configured — log so the run is still observable.
    console.log("[inbox-verifier] no notification channel configured\n" + text);
    results.push({ channel: "console", ok: true, detail: "logged only" });
  }

  return results;
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<NotifyResult> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return { channel: "telegram", ok: res.ok, detail: res.ok ? undefined : await res.text() };
  } catch (error) {
    return { channel: "telegram", ok: false, detail: String(error) };
  }
}

async function sendWebhook(url: string, text: string, summary: CheckSummary): Promise<NotifyResult> {
  try {
    // `text` works for Slack/Discord/Teams style endpoints; the structured
    // payload is included for endpoints that want it.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, summary }),
    });
    return { channel: "webhook", ok: res.ok, detail: res.ok ? undefined : await res.text() };
  } catch (error) {
    return { channel: "webhook", ok: false, detail: String(error) };
  }
}
