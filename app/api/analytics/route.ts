import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/analytics-db";
import type { AnalyticsEventName, AnalyticsScope } from "@/lib/analytics";

const EVENT_NAMES = new Set<AnalyticsEventName>([
  "page_view",
  "planner_started",
  "schedule_completed",
  "png_download",
  "pdf_download",
  "pptx_download",
  "print",
]);
const SCOPES = new Set<AnalyticsScope>(["weekly", "vacation"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 2_048) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const body = await request.json() as {
      eventName?: AnalyticsEventName;
      visitorId?: string;
      sessionId?: string;
      scope?: AnalyticsScope;
      channel?: string;
    };
    const channel = body.channel ?? "direct";

    if (
      !body.eventName || !EVENT_NAMES.has(body.eventName) ||
      !body.visitorId || !UUID_PATTERN.test(body.visitorId) ||
      !body.sessionId || !UUID_PATTERN.test(body.sessionId) ||
      (body.scope !== undefined && !SCOPES.has(body.scope)) ||
      !CHANNEL_PATTERN.test(channel)
    ) {
      return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
    }

    await recordAnalyticsEvent({
      eventName: body.eventName,
      visitorId: body.visitorId,
      sessionId: body.sessionId,
      scope: body.scope,
      channel,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to record analytics event", error);
    return new NextResponse(null, { status: 503 });
  }
}
