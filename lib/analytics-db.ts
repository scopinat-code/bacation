import { neon } from "@neondatabase/serverless";
import type { AnalyticsEventName, AnalyticsScope } from "@/lib/analytics";

type AnalyticsSummaryRow = {
  total_visitors: number | string;
  today_visitors: number | string;
  week_visitors: number | string;
  month_visitors: number | string;
  total_sessions: number | string;
  planner_started: number | string;
  schedule_completed: number | string;
  png_downloads: number | string;
  pdf_downloads: number | string;
  pptx_downloads: number | string;
  prints: number | string;
};

export type AnalyticsSummary = {
  totalVisitors: number;
  todayVisitors: number;
  weekVisitors: number;
  monthVisitors: number;
  totalSessions: number;
  plannerStarted: number;
  scheduleCompleted: number;
  pngDownloads: number;
  pdfDownloads: number;
  pptxDownloads: number;
  prints: number;
  completionRate: number;
  daily: { label: string; visitors: number; completions: number }[];
};

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return neon(connectionString);
}

export async function recordAnalyticsEvent(input: {
  eventName: AnalyticsEventName;
  visitorId: string;
  sessionId: string;
  scope?: AnalyticsScope;
}) {
  const sql = database();
  await sql`
    INSERT INTO analytics_events (event_name, visitor_id, session_id, scope)
    VALUES (${input.eventName}, ${input.visitorId}, ${input.sessionId}, ${input.scope ?? null})
    ON CONFLICT DO NOTHING
  `;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const sql = database();
  const summaryRows = await sql`
    WITH bounds AS (
      SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS today
    )
    SELECT
      COUNT(DISTINCT visitor_id)::int AS total_visitors,
      COUNT(DISTINCT visitor_id) FILTER (
        WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = bounds.today
      )::int AS today_visitors,
      COUNT(DISTINCT visitor_id) FILTER (
        WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date >= bounds.today - 6
      )::int AS week_visitors,
      COUNT(DISTINCT visitor_id) FILTER (
        WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date >= bounds.today - 29
      )::int AS month_visitors,
      COUNT(DISTINCT session_id)::int AS total_sessions,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'planner_started')::int AS planner_started,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'schedule_completed')::int AS schedule_completed,
      COUNT(*) FILTER (WHERE event_name = 'png_download')::int AS png_downloads,
      COUNT(*) FILTER (WHERE event_name = 'pdf_download')::int AS pdf_downloads,
      COUNT(*) FILTER (WHERE event_name = 'pptx_download')::int AS pptx_downloads,
      COUNT(*) FILTER (WHERE event_name = 'print')::int AS prints
    FROM analytics_events
    CROSS JOIN bounds
    GROUP BY bounds.today
  `;

  const dailyRows = await sql`
    WITH days AS (
      SELECT generate_series(
        (now() AT TIME ZONE 'Asia/Seoul')::date - 13,
        (now() AT TIME ZONE 'Asia/Seoul')::date,
        interval '1 day'
      )::date AS day
    ), daily AS (
      SELECT
        (created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
        COUNT(DISTINCT visitor_id)::int AS visitors,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'schedule_completed')::int AS completions
      FROM analytics_events
      WHERE created_at >= now() - interval '15 days'
      GROUP BY 1
    )
    SELECT
      to_char(days.day, 'MM/DD') AS label,
      COALESCE(daily.visitors, 0)::int AS visitors,
      COALESCE(daily.completions, 0)::int AS completions
    FROM days
    LEFT JOIN daily USING (day)
    ORDER BY days.day
  `;

  const row = summaryRows[0] as AnalyticsSummaryRow | undefined;
  const number = (value: number | string | undefined) => Number(value ?? 0);
  const plannerStarted = number(row?.planner_started);
  const scheduleCompleted = number(row?.schedule_completed);

  return {
    totalVisitors: number(row?.total_visitors),
    todayVisitors: number(row?.today_visitors),
    weekVisitors: number(row?.week_visitors),
    monthVisitors: number(row?.month_visitors),
    totalSessions: number(row?.total_sessions),
    plannerStarted,
    scheduleCompleted,
    pngDownloads: number(row?.png_downloads),
    pdfDownloads: number(row?.pdf_downloads),
    pptxDownloads: number(row?.pptx_downloads),
    prints: number(row?.prints),
    completionRate: plannerStarted ? Math.round((scheduleCompleted / plannerStarted) * 100) : 0,
    daily: dailyRows.map((item) => ({
      label: String(item.label),
      visitors: number(item.visitors as number | string),
      completions: number(item.completions as number | string),
    })),
  };
}
