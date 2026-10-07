import { describe, expect, it } from "vitest";
import { detectCodes, looksLikeVerification } from "./codes";

describe("detectCodes", () => {
  it("finds a numeric code in an n8n-style verification email", () => {
    const codes = detectCodes(
      "045895 : Verify your email for n8n",
      "Or return to the signup page and enter this code:\n\n045895\n\nHappy automating",
    );
    expect(codes.map((c) => c.code)).toContain("045895");
  });

  it("finds an alphanumeric code announced in the subject", () => {
    const codes = detectCodes("JFNWJB is your Gravatar code", "Use this code to log in.");
    expect(codes.map((c) => c.code)).toEqual(["JFNWJB"]);
  });

  it("finds a code described as a one-time password", () => {
    const codes = detectCodes(
      "Your verification code",
      "Your one-time password is 884213. It expires in 10 minutes.",
    );
    expect(codes.map((c) => c.code)).toContain("884213");
  });

  it("detects a code when the verification language follows it", () => {
    const codes = detectCodes("", "123456 is your verification code");
    expect(codes.map((c) => c.code)).toEqual(["123456"]);
  });

  it("ignores order and tracking numbers", () => {
    const codes = detectCodes(
      "Your Amazon order 123-4567890-1234567 has shipped",
      "Tracking number 1Z999AA10123456784 arrives Tuesday",
    );
    expect(codes).toEqual([]);
  });

  it("ignores security alerts that carry no code", () => {
    const codes = detectCodes(
      "Security alert",
      "You allowed Pipedream access to some of your Google Account data",
    );
    expect(codes).toEqual([]);
  });

  it("ignores marketing mail that carries no code", () => {
    const codes = detectCodes("Welcome to CREAO", "Thanks for signing up.");
    expect(codes).toEqual([]);
  });

  it("does not match bare numbers with no verification context", () => {
    const codes = detectCodes("Invoice 2026", "Total due: 1450 USD");
    expect(codes).toEqual([]);
  });

  it("requires at least four digits", () => {
    const codes = detectCodes("Your code is 123", "Please enter 123");
    expect(codes).toEqual([]);
  });

  it("de-duplicates a code that appears more than once", () => {
    const codes = detectCodes(
      "Your verification code 123456",
      "123456 is your code. Again: 123456",
    );
    expect(codes.map((c) => c.code)).toEqual(["123456"]);
  });

  it("returns an empty array for empty input", () => {
    expect(detectCodes("", "")).toEqual([]);
  });

  it("reports the surrounding context of a match", () => {
    const [code] = detectCodes("Your code", "Use 445566 to continue");
    expect(code?.code).toBe("445566");
    expect(code?.context).toContain("445566");
  });
});

describe("looksLikeVerification", () => {
  it("returns true for verification language in the subject", () => {
    expect(looksLikeVerification("Verify your email", "")).toBe(true);
  });

  it("returns true for verification language in the snippet", () => {
    expect(looksLikeVerification("", "Your one-time password")).toBe(true);
  });

  it("returns false for ordinary mail", () => {
    expect(looksLikeVerification("Weekly newsletter", "Top stories this week")).toBe(false);
  });
});
