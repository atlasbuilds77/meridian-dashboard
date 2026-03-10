-- NDA Acceptances Table
CREATE TABLE IF NOT EXISTS nda_acceptances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  nda_version TEXT NOT NULL DEFAULT '1.0',
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, nda_version),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nda_user_id ON nda_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_nda_version ON nda_acceptances(nda_version);
