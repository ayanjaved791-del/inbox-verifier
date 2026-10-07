/**
 * Shared types for the Inbox Verifier app.
 */

export interface AccountConfig {
  /** Optional friendly label, used only for display. */
  email?: string;
  /** Google OAuth refresh token for this account. */
  refreshToken: string;
}

export interface AppConfig {
  accounts: AccountConfig[];
  lookbackMinutes: number;
  maxMessages: number;
  markProcessed: boolean;
  processedLabel: string;
  notifyAlways: boolean;
}

/** A single Gmail message reduced to the fields we care about. */
export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  body: string;
}

/** A verification / one-time code found in a message. */
export interface DetectedCode {
  code: string;
  /** Short surrounding text used to confirm the match, for auditing. */
  context: string;
}

/** Codes found in one account, plus the message that carried them. */
export interface AccountFinding {
  account: string;
  messageId: string;
  subject: string;
  from: string;
  date: string;
  codes: DetectedCode[];
}

export interface CheckSummary {
  startedAt: string;
  finishedAt: string;
  accountsChecked: number;
  messagesScanned: number;
  codesFound: number;
  findings: AccountFinding[];
  errors: { account: string; error: string }[];
  notified: boolean;
}
