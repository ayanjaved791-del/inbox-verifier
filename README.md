# Inbox Verifier

A Next.js app that runs on **Vercel** and checks one or more Gmail accounts for
verification / one-time codes on a **Vercel Cron** schedule (every 2 hours by
default). When it finds a code it pushes an alert to Telegram and/or a generic
webhook.

This is the self-hosted equivalent of the CREAO "Inbox Digest" agent: you own
the code, the credentials, and the hosting.

## How it works

1. Vercel Cron calls `GET /api/check` every 2 hours (`0 */2 * * *`, UTC).
2. For each configured Gmail account the app mints an access token from a stored
   refresh token and searches unread mail in the lookback window.
3. Each candidate message is fetched and scanned for verification codes
   (4–8 digit codes and uppercase alphanumeric tokens that appear next to
   verification language such as "verification code", "OTP", "one-time").
4. New codes are sent to every configured notification channel.

## Project layout

```
inbox-verifier/
├─ app/
│  ├─ api/check/route.ts   # the cron-triggered endpoint
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx             # informational landing page
├─ lib/
│  ├─ codes.ts             # verification-code detection
│  ├─ config.ts            # environment -> config
│  ├─ gmail.ts             # Gmail REST client (token, list, get, labels)
│  ├─ notify.ts            # Telegram / webhook dispatch
│  └─ types.ts
├─ scripts/
│  └─ get-refresh-token.mjs  # one-time OAuth helper
├─ .env.example
├─ next.config.mjs
├─ package.json
├─ tsconfig.json
└─ vercel.json             # cron schedule
```

## Setup

### 1. Create Google OAuth credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create
   (or pick) a project.
2. **APIs & Services → Library** → enable the **Gmail API**.
3. **APIs & Services → OAuth consent screen** → configure it (External, add
   yourself as a test user while in testing).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type **Web application**.
5. Add an authorized redirect URI: `http://localhost:53682/oauth2callback`.
6. Copy the **Client ID** and **Client secret**.

### 2. Mint refresh tokens (one per Gmail account)

```bash
npm install
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run token
```

Approve access, copy the printed refresh token, and repeat for each account you
want to watch. (If you want label-based de-duplication, run with
`GMAIL_MARK_PROCESSED=true` to request the `gmail.modify` scope.)

### 3. Deploy to Vercel

```bash
npx vercel
```

Then set these environment variables in **Vercel → Project → Settings →
Environment Variables** (see `.env.example` for the full list):

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | yes | OAuth client secret |
| `GMAIL_REFRESH_TOKENS` | yes | One or more refresh tokens, comma-separated |
| `CRON_SECRET` | recommended | Protects `/api/check`; Vercel sends it automatically to cron |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | optional | Telegram alerts |
| `NOTIFY_WEBHOOK_URL` | optional | Slack / Discord / Teams / custom webhook |
| `LOOKBACK_MINUTES` | optional | Window per run (default 180) |
| `MAX_MESSAGES` | optional | Cap per account per run (default 25) |
| `GMAIL_MARK_PROCESSED` | optional | Enable label de-duplication (needs `gmail.modify`) |
| `NOTIFY_ALWAYS` | optional | Notify even when no codes were found |

### 4. Verify the cron

`vercel.json` registers the schedule. After deploying, trigger it once manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/check
```

The response is JSON with a `summary` (accounts checked, messages scanned, codes
found, and any errors).

## Watching multiple Gmail accounts

Put each account's refresh token in `GMAIL_REFRESH_TOKENS`, comma-separated:

```
GMAIL_REFRESH_TOKENS=token1,token2,token3
GMAIL_ACCOUNT_1_EMAIL=primary@gmail.com
GMAIL_ACCOUNT_2_EMAIL=second@gmail.com
GMAIL_ACCOUNT_3_EMAIL=third@gmail.com
```

## Important notes

- **Vercel Cron plan limits.** Hobby allows **one cron run per day**. An
  every-2-hours schedule requires a **Pro** plan. On Hobby, change the schedule
  in `vercel.json` to e.g. `0 8 * * *`.
- **De-duplication.** By default the app scans a time window each run, so a code
  email can be reported twice if the window overlaps between runs. Set
  `GMAIL_MARK_PROCESSED=true` (and use the `gmail.modify` scope) to label each
  reported message and skip it on later runs.
- **Secrets.** Never commit `.env`. All credentials live in Vercel environment
  variables.
- **Scopes.** Read-only (`gmail.readonly`) is enough unless you enable
  `GMAIL_MARK_PROCESSED`, which needs `gmail.modify`.
