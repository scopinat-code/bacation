import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminAuthConfigured, createAdminSession, verifyAdminPassword, verifyAdminSession } from "../lib/admin-auth";

describe("admin authentication", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_PASSWORD", "a-strong-test-password");
    vi.stubEnv("ADMIN_SESSION_SECRET", "a-long-random-test-session-secret");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("accepts only the configured password", () => {
    expect(adminAuthConfigured()).toBe(true);
    expect(verifyAdminPassword("a-strong-test-password")).toBe(true);
    expect(verifyAdminPassword("wrong-password")).toBe(false);
  });

  it("creates a signed session and rejects tampering", () => {
    const token = createAdminSession();
    expect(token).toBeTruthy();
    expect(verifyAdminSession(token ?? undefined)).toBe(true);
    expect(verifyAdminSession(`${token}tampered`)).toBe(false);
  });
});
