ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS channel varchar(64) NOT NULL DEFAULT 'unknown';

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
END $$;

CREATE INDEX IF NOT EXISTS analytics_events_channel_created_idx
  ON analytics_events (channel, created_at DESC);
