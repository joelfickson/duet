CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX idx_sessions_created_at ON sessions (created_at);
