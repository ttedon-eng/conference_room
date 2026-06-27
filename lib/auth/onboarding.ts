import { createHash, randomInt } from "node:crypto";

export const ALLOWED_SIGNUP_DOMAINS = ["samsung.com", "partner.samsung.com"] as const;
export const SIGNUP_VERIFICATION_CODE_LENGTH = 6;
export const SIGNUP_VERIFICATION_WINDOW_MINUTES = 10;
export const SIGNUP_VERIFICATION_LOCK_THRESHOLD = 5;
export const DEFAULT_NEXT_PATH = "/account";
export const UNSPECIFIED_GROUP_NAME = "미지정";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getEmailDomain(value: string) {
  const normalizedEmail = normalizeEmail(value);
  const parts = normalizedEmail.split("@");
  return parts[parts.length - 1] ?? "";
}

export function isAllowedSignupEmail(value: string) {
  return ALLOWED_SIGNUP_DOMAINS.includes(getEmailDomain(value) as (typeof ALLOWED_SIGNUP_DOMAINS)[number]);
}

export function isSafeNextPath(value: string | null | undefined) {
  const nextPath = value?.trim();

  return Boolean(
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("://"),
  );
}

export function normalizeNextPath(value: string | null | undefined) {
  return isSafeNextPath(value) ? value!.trim() : DEFAULT_NEXT_PATH;
}

export function generateVerificationCode() {
  return randomInt(0, 10 ** SIGNUP_VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(SIGNUP_VERIFICATION_CODE_LENGTH, "0");
}

export function createVerificationCodeHash(sessionId: string, code: string) {
  return createHash("sha256").update(`${sessionId}:${code}`).digest("hex");
}

export function verificationCodeMatches(sessionId: string, code: string, codeHash: string) {
  return createVerificationCodeHash(sessionId, code) === codeHash;
}

export function addMinutes(baseDate: Date, minutes: number) {
  return new Date(baseDate.getTime() + minutes * 60_000);
}

