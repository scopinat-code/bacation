export type AnalyticsEventName =
  | "page_view"
  | "planner_started"
  | "schedule_completed"
  | "png_download"
  | "pdf_download"
  | "pptx_download"
  | "print";

export type AnalyticsScope = "weekly" | "vacation";

const VISITOR_KEY = "vacation-one-slot:visitor-id";
const SESSION_KEY = "vacation-one-slot:session-id";
const CHANNEL_KEY = "vacation-one-slot:analytics-channel";

const REFERRER_CHANNELS: Array<[string, string]> = [
  ["cafe.naver.com", "naver_cafe"],
  ["blog.naver.com", "naver_blog"],
  ["naver.com", "naver"],
  ["google.", "google"],
  ["daum.net", "daum"],
  ["kakao.com", "kakao"],
  ["instagram.com", "instagram"],
  ["threads.net", "threads"],
  ["facebook.com", "facebook"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["orbi.kr", "orbi"],
  ["disquiet.io", "disquiet"],
  ["daangn.com", "daangn"],
];

export function normalizeAnalyticsChannel(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64);
  return normalized || null;
}

export function explicitAnalyticsChannel(search: string): string | null {
  const params = new URLSearchParams(search);
  return normalizeAnalyticsChannel(params.get("ref") ?? params.get("utm_source"));
}

export function resolveAnalyticsChannel(search: string, referrer: string, currentHostname = ""): string {
  const explicit = explicitAnalyticsChannel(search);
  if (explicit) return explicit;
  if (!referrer) return "direct";

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    if (currentHostname && hostname === currentHostname.toLowerCase()) return "direct";
    return REFERRER_CHANNELS.find(([domain]) => hostname.includes(domain))?.[1] ?? "referral";
  } catch {
    return "direct";
  }
}

function getBrowserId(storage: Storage, key: string) {
  const saved = storage.getItem(key);
  if (saved) return saved;
  const id = crypto.randomUUID();
  storage.setItem(key, id);
  return id;
}

function getAnalyticsChannel() {
  const explicit = explicitAnalyticsChannel(window.location.search);
  if (explicit) {
    window.sessionStorage.setItem(CHANNEL_KEY, explicit);
    return explicit;
  }

  const saved = normalizeAnalyticsChannel(window.sessionStorage.getItem(CHANNEL_KEY));
  if (saved) return saved;

  const channel = resolveAnalyticsChannel(window.location.search, document.referrer, window.location.hostname);
  window.sessionStorage.setItem(CHANNEL_KEY, channel);
  return channel;
}

export function trackAnalytics(eventName: AnalyticsEventName, scope?: AnalyticsScope) {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getBrowserId(window.localStorage, VISITOR_KEY);
    const sessionId = getBrowserId(window.sessionStorage, SESSION_KEY);
    const channel = getAnalyticsChannel();
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, visitorId, sessionId, scope, channel }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 통계 전송 실패가 사용자의 계획 만들기를 방해하지 않도록 합니다.
  }
}
