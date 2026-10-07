import type { DetectedCode } from "./types";

/**
 * Words that should never be treated as a code even if they appear next to
 * verification language.
 */
const STOPWORDS = new Set([
  "VERIFY",
  "VERIFICATION",
  "EMAIL",
  "ACCOUNT",
  "GOOGLE",
  "SECURITY",
  "LOGIN",
  "SIGNIN",
  "PASSWORD",
  "ONETIME",
  "PLEASE",
  "CLICK",
  "BELOW",
  "ENTER",
  "THIS",
  "CODE",
  "HTTPS",
  "HTTP",
  "HTTP",
]);

/** Language that confirms a nearby token really is a verification code. */
const CONTEXT_RE =
  /(verification|verify|one[\s-]?time|otp|security code|auth(?:entication)? code|passcode|login code|sign[\s-]?in code|your code|\bcode\b|confirm)/i;

/** Candidate shapes: 4-8 digits, or a 5-9 char uppercase/alphanumeric token. */
const PATTERNS: RegExp[] = [/\b(\d{4,8})\b/g, /\b([A-Z][A-Z0-9]{4,8})\b/g];

/**
 * Find verification / one-time codes in a message.
 *
 * A candidate is only accepted when it appears inside a window of text that
 * also contains verification language, which keeps false positives (order
 * numbers, dates, tracking IDs) out of the results.
 */
export function detectCodes(subject: string, body: string): DetectedCode[] {
  const text = `${subject}\n${body}`;
  const found = new Map<string, DetectedCode>();

  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1];
      if (STOPWORDS.has(code.toUpperCase())) continue;

      const start = Math.max(0, match.index - 90);
      const end = Math.min(text.length, match.index + code.length + 60);
      const context = text.slice(start, end).replace(/\s+/g, " ").trim();

      if (!CONTEXT_RE.test(context)) continue;
      if (found.has(code)) continue;

      found.set(code, { code, context });
    }
  }

  return [...found.values()];
}

/** True when a message is worth fetching in detail. */
export function looksLikeVerification(subject: string, snippet: string): boolean {
  return CONTEXT_RE.test(`${subject} ${snippet}`);
}
