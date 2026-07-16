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
  channels: {
    channel: string;
    visitors: number;
    sessions: number;
    starts: number;
    completions: number;
    exports: number;
    completionRate: number;
  }[];
};

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return neon(connectionString);
}

function isMissingChannelColumn(error: unknown) {
  return typeof error === "object" && error !== null
    && "code" in error && error.code === "42703";
}

async function ensureAnalyticsChannelSchema() {
  const sql = database();
  await sql`
    ALTER TABLE analytics_events
      ADD COLUMN IF NOT EXISTS channel varchar(64) NOT NULL DEFAULT 'unknown'
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'analytics_events_channel_format'
      ) THEN
        ALTER TABLE analytics_events
          ADD CONSTRAINT analytics_events_channel_format
          CHECK (channel ~ '^[a-z0-9][a-z0-9_-]{0,63}$');
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS analytics_events_channel_created_idx
      ON analytics_events (channel, created_at DESC)
  `;
}

export async function recordAnalyticsEvent(input: {
  eventName: AnalyticsEventName;
  visitorId: string;
  sessionId: string;
  scope?: AnalyticsScope;
  channel: string;
}) {
  const sql = database();
  const insert = () => sql`
      INSERT INTO analytics_events (event_name, visitor_id, session_id, scope, channel)
      VALUES (${input.eventName}, ${input.visitorId}, ${input.sessionId}, ${input.scope ?? null}, ${input.channel})
      ON CONFLICT DO NOTHING
    `;

  try {
    await insert();
  } catch (error) {
    if (!isMissingChannelColumn(error)) throw error;
    await ensureAnalyticsChannelSchema();
    await insert();
  }
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

  const loadChannelRows = () => sql`
      SELECT
        channel,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'page_view')::int AS visitors,
        COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'page_view')::int AS sessions,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'planner_started')::int AS starts,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_name = 'schedule_completed')::int AS completions,
        COUNT(*) FILTER (WHERE event_name IN ('png_download', 'pdf_download', 'pptx_download', 'print'))::int AS exports
      FROM analytics_events
      GROUP BY channel
      ORDER BY visitors DESC, channel
      LIMIT 50
    `;
  let channelRows;
  try {
    channelRows = await loadChannelRows();
  } catch (error) {
    if (!isMissingChannelColumn(error)) throw error;
    await ensureAnalyticsChannelSchema();
    channelRows = await loadChannelRows();
  }

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
    channels: channelRows.map((item) => {
      const starts = number(item.starts as number | string);
      const completions = number(item.completions as number | string);
      return {
        channel: String(item.channel),
        visitors: number(item.visitors as number | string),
        sessions: number(item.sessions as number | string),
        starts,
        completions,
        exports: number(item.exports as number | string),
        completionRate: starts ? Math.round((completions / starts) * 100) : 0,
      };
    }),
  };
}
