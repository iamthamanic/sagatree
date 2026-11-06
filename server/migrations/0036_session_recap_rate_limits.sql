-- CUT-14 durable session-recap quota (Edge consume_session_recap_rate_limit parity).
CREATE TABLE IF NOT EXISTS session_recap_rate_limits (
  user_id TEXT NOT NULL PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  updated_at TEXT NOT NULL
) STRICT;
