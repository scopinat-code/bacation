import { describe, expect, it } from "vitest";
import { explicitAnalyticsChannel, normalizeAnalyticsChannel, resolveAnalyticsChannel } from "../lib/analytics";

describe("analytics channel attribution", () => {
  it("normalizes explicit channel names into safe slugs", () => {
    expect(normalizeAnalyticsChannel(" Naver Cafe ")).toBe("naver-cafe");
    expect(normalizeAnalyticsChannel("instagram_reels")).toBe("instagram_reels");
    expect(normalizeAnalyticsChannel("한글 채널")).toBeNull();
  });

  it("uses ref before utm_source", () => {
    expect(explicitAnalyticsChannel("?utm_source=instagram&ref=naver_cafe")).toBe("naver_cafe");
  });

  it("supports standard utm_source links", () => {
    expect(resolveAnalyticsChannel("?utm_source=teacher_newsletter", "", "example.com")).toBe("teacher_newsletter");
  });

  it("maps known referrers without storing a full URL", () => {
    expect(resolveAnalyticsChannel("", "https://cafe.naver.com/example/123", "example.com")).toBe("naver_cafe");
    expect(resolveAnalyticsChannel("", "https://www.google.com/search?q=test", "example.com")).toBe("google");
    expect(resolveAnalyticsChannel("", "https://unknown.example/path?private=value", "example.com")).toBe("referral");
  });

  it("classifies empty, invalid, and same-site referrers as direct", () => {
    expect(resolveAnalyticsChannel("", "", "example.com")).toBe("direct");
    expect(resolveAnalyticsChannel("", "not-a-url", "example.com")).toBe("direct");
    expect(resolveAnalyticsChannel("", "https://example.com/qna", "example.com")).toBe("direct");
  });
});
