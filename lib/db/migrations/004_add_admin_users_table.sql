-- Admin users table
-- Stores Discord IDs of users with admin privileges
-- This supplements the ADMIN_DISCORD_IDS env var for easier management

CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255), -- Optional, for reference
    granted_by VARCHAR(255), -- Discord ID of admin who granted access
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT, -- Why they were granted admin (e.g., "Co-founder", "Support team")
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_admin_users_discord_id ON admin_users(discord_id);
CREATE INDEX idx_admin_users_active ON admin_users(is_active);

-- Comments
COMMENT ON TABLE admin_users IS 'Users with admin privileges - supplements ADMIN_DISCORD_IDS env var';
COMMENT ON COLUMN admin_users.discord_id IS 'Discord snowflake ID (17-19 digits)';
COMMENT ON COLUMN admin_users.is_active IS 'Set to false to revoke admin access without deleting record';

-- Insert initial admins
INSERT INTO admin_users (discord_id, username, granted_by, notes, is_active)
VALUES 
    ('838217421088669726', 'Orion', 'SYSTEM', 'Owner/Founder', true),
    ('361901004631145355', 'Aphmas', '838217421088669726', 'Co-founder/Developer', true)
ON CONFLICT (discord_id) DO NOTHING;
