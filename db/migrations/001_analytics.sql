CREATE TABLE IF NOT EXISTS analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name varchar(40) NOT NULL CHECK (event_name IN (
    'page_view',
    'planner_started',
    'schedule_completed',
    'png_download',
    'pdf_download',
    'pptx_download',
    'print'
  )),
  visitor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  scope varchar(12) CHECK (scope IS NULL OR scope IN ('weekly', 'vacation')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_event_created_idx
  ON analytics_events (event_name, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_page_view_once_per_session_idx
  ON analytics_events (visitor_id, session_id)
  WHERE event_name = 'page_view';
