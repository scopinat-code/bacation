import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "vacation-admin-session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function safeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function signature(expiresAt: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(expiresAt).digest("base64url");
}

export function adminAuthConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected && safeEqual(password, expected));
}

export function createAdminSession() {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS);
  const signed = signature(expiresAt);
  return signed ? `${expiresAt}.${signed}` : null;
}

export function verifyAdminSession(token: string | undefined) {
  if (!token) return false;
  const [expiresAt, providedSignature] = token.split(".");
  if (!expiresAt || !providedSignature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expectedSignature = signature(expiresAt);
  return Boolean(expectedSignature && safeEqual(providedSignature, expectedSignature));
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/admin",
  maxAge: SESSION_DURATION_SECONDS,
};
