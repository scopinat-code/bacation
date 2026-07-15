CREATE TABLE IF NOT EXISTS qna_posts (
  id uuid PRIMARY KEY,
  category varchar(16) NOT NULL CHECK (category IN ('inquiry', 'bug', 'suggestion')),
  visibility varchar(8) NOT NULL CHECK (visibility IN ('public', 'private')),
  nickname varchar(20) NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 20),
  title varchar(100) NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  content text NOT NULL CHECK (char_length(content) BETWEEN 5 AND 5000),
  password_hash varchar(256) NOT NULL,
  answer_content text CHECK (answer_content IS NULL OR char_length(answer_content) BETWEEN 1 AND 5000),
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  answer_updated_at timestamptz,
  CHECK (
    (answer_content IS NULL AND answered_at IS NULL AND answer_updated_at IS NULL)
    OR
    (answer_content IS NOT NULL AND answered_at IS NOT NULL AND answer_updated_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS qna_posts_public_created_idx
  ON qna_posts (created_at DESC)
  WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS qna_posts_admin_created_idx
  ON qna_posts (created_at DESC);

-- Only one-way request fingerprints are retained. No IP address or user-agent is stored.
-- Rows are pruned by the write path after their short rate-limit lifetime has elapsed.
CREATE TABLE IF NOT EXISTS qna_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint_hash char(64) NOT NULL CHECK (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  action varchar(16) NOT NULL CHECK (action IN ('create', 'password', 'admin_login')),
  time_slot bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint_hash, action, time_slot)
);

CREATE INDEX IF NOT EXISTS qna_rate_limits_recent_idx
  ON qna_rate_limits (fingerprint_hash, action, created_at DESC);
