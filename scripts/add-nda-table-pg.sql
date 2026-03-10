-- NDA Acceptances Table (PostgreSQL)
CREATE TABLE IF NOT EXISTS nda_acceptances (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL,
  nda_version TEXT NOT NULL DEFAULT '1.0',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, nda_version)
);

CREATE INDEX IF NOT EXISTS idx_nda_user_id ON nda_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_nda_version ON nda_acceptances(nda_version);

-- Add foreign key if users table exists
-- ALTER TABLE nda_acceptances ADD CONSTRAINT fk_nda_user 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
