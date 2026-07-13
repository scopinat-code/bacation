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

function getBrowserId(storage: Storage, key: string) {
  const saved = storage.getItem(key);
  if (saved) return saved;
  const id = crypto.randomUUID();
  storage.setItem(key, id);
  return id;
}

export function trackAnalytics(eventName: AnalyticsEventName, scope?: AnalyticsScope) {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getBrowserId(window.localStorage, VISITOR_KEY);
    const sessionId = getBrowserId(window.sessionStorage, SESSION_KEY);
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, visitorId, sessionId, scope }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 통계 전송 실패가 사용자의 계획 만들기를 방해하지 않도록 합니다.
  }
}
