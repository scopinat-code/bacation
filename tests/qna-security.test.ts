import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createQnaPasswordFingerprint,
  createQnaRequestFingerprint,
} from "../lib/qna-db";

afterEach(() => vi.unstubAllEnvs());

describe("Q&A request fingerprints", () => {
  it("cannot bypass the network limit by changing only User-Agent", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-only-session-secret-for-fingerprints");
    const first = new Request("https://example.test/api/qna", {
      headers: { "x-real-ip": "203.0.113.10", "user-agent": "browser-a" },
    });
    const rotatedAgent = new Request("https://example.test/api/qna", {
      headers: { "x-real-ip": "203.0.113.10", "user-agent": "browser-b" },
    });
    const otherAddress = new Request("https://example.test/api/qna", {
      headers: { "x-real-ip": "203.0.113.11", "user-agent": "browser-a" },
    });

    expect(createQnaRequestFingerprint(first)).toBe(createQnaRequestFingerprint(rotatedAgent));
    expect(createQnaRequestFingerprint(first)).not.toBe(createQnaRequestFingerprint(otherAddress));
  });

  it("scopes password-attempt limits to each post without exposing its id", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-only-session-secret-for-password-limits");
    const request = new Request("https://example.test/api/qna", {
      headers: { "x-real-ip": "203.0.113.10" },
    });
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";

    const first = createQnaPasswordFingerprint(request, firstId);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain(firstId);
    expect(first).not.toBe(createQnaPasswordFingerprint(request, secondId));
  });
});
