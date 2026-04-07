-- SnapTrade integration fields on users table
-- Stores SnapTrade user mapping and selected account

DO $$
BEGIN
    -- snaptrade_user_id: the userId registered with SnapTrade
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'snaptrade_user_id'
    ) THEN
        ALTER TABLE users ADD COLUMN snaptrade_user_id VARCHAR(255);
    END IF;

    -- snaptrade_user_secret: the userSecret returned on registration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'snaptrade_user_secret'
    ) THEN
        ALTER TABLE users ADD COLUMN snaptrade_user_secret TEXT;
    END IF;

    -- snaptrade_selected_account: UUID of the user's selected broker account
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'snaptrade_selected_account'
    ) THEN
        ALTER TABLE users ADD COLUMN snaptrade_selected_account VARCHAR(255);
    END IF;

    -- snaptrade_connected_at: timestamp of when broker was connected
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'snaptrade_connected_at'
    ) THEN
        ALTER TABLE users ADD COLUMN snaptrade_connected_at TIMESTAMP;
    END IF;
END $$;

-- Index for lookups by snaptrade_user_id
CREATE INDEX IF NOT EXISTS idx_users_snaptrade_user_id ON users(snaptrade_user_id);
