import { NextRequest, NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { detectCodes } from "@/lib/codes";
import { addLabelToMessage, ensureLabel, getAccessToken, getMessage, getProfileEmail, listMessageIds } from "@/lib/gmail";
import { notify } from "@/lib/notify";
import type { AccountFinding, CheckSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/check — invoked by Vercel Cron every 2 hours.
 * POST /api/check — same handler, for manual triggers.
 *
 * Protected by CRON_SECRET when set: Vercel sends it automatically as
 * "Authorization: Bearer <CRON_SECRET>". Manual callers may also pass ?key=.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    const queryKey = new URL(request.url).searchParams.get("key");
    const ok = header === `Bearer ${secret}` || queryKey === secret;
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const config = loadConfig();
    const startedAt = new Date().toISOString();
    const findings: AccountFinding[] = [];
    const errors: { account: string; error: string }[] = [];
    let messagesScanned = 0;

    // Gmail's newer_than: operator takes hours (d/m/y are day/month/year),
    // so round the configured window up to whole hours.
    const lookbackHours = Math.max(1, Math.ceil(config.lookbackMinutes / 60));

    for (const account of config.accounts) {
      const label = account.email ?? "account";
      try {
        const accessToken = await getAccessToken(account.refreshToken);
        const email = account.email ?? (await getProfileEmail(accessToken));

        let query = `is:unread newer_than:${lookbackHours}h`;
        if (config.markProcessed) {
          query += ` -label:"${config.processedLabel}"`;
        }

        const ids = await listMessageIds(accessToken, query, config.maxMessages);

        let processedLabelId: string | null = null;
        if (config.markProcessed && ids.length > 0) {
          processedLabelId = await ensureLabel(accessToken, config.processedLabel);
        }

        for (const id of ids) {
          messagesScanned += 1;
          const message = await getMessage(accessToken, id);
          const codes = detectCodes(message.subject, message.body);
          if (codes.length === 0) continue;

          findings.push({
            account: email,
            messageId: message.id,
            subject: message.subject,
            from: message.from,
            date: message.date,
            codes,
          });

          if (processedLabelId) {
            await addLabelToMessage(accessToken, message.id, processedLabelId);
          }
        }
      } catch (error) {
        errors.push({ account: label, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const summary: CheckSummary = {
      startedAt,
      finishedAt: new Date().toISOString(),
      accountsChecked: config.accounts.length,
      messagesScanned,
      codesFound: findings.reduce((total, f) => total + f.codes.length, 0),
      findings,
      errors,
      notified: false,
    };

    if (summary.codesFound > 0 || config.notifyAlways) {
      const results = await notify(summary);
      summary.notified = results.some((r) => r.ok && r.channel !== "console");
    }

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
