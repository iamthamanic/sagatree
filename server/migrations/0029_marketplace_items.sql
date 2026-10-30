-- RPC-MARKETPLACE-COUNT (#878). Durable marketplace_items for host download counter.
-- Deployment decision: host SQLite successor replaces optional src/supabase marketplace RPC scripts.
-- Counters are server-authority only — no client write fallback (#675).

CREATE TABLE IF NOT EXISTS marketplace_items (
  id TEXT NOT NULL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('world', 'adventure', 'character', 'item', 'ruleset')),
  title TEXT NOT NULL,
  description TEXT,
  author_id TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  rating REAL NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  downloads INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
  image_url TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS marketplace_items_author_idx ON marketplace_items (author_id);
CREATE INDEX IF NOT EXISTS marketplace_items_type_idx ON marketplace_items (type);
