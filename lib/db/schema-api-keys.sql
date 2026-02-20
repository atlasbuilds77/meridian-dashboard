-- API Credentials Table (ENCRYPTED STORAGE)
-- Stores user API keys for read-only access to trading platforms

CREATE TABLE IF NOT EXISTS api_credentials (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'tradier', 'topstepx', 'webull', 'polymarket'
    
    -- Encrypted fields (AES-256-GCM)
    encrypted_api_key TEXT NOT NULL, -- Base64 encoded encrypted key
    encrypted_api_secret TEXT, -- For platforms requiring secret (e.g., Polymarket)
    encryption_iv TEXT NOT NULL, -- Initialization vector for decryption
    
    -- Metadata
    key_name VARCHAR(100), -- User-friendly name ("My Tradier Account")
    is_active BOOLEAN DEFAULT true,
    last_verified TIMESTAMP, -- Last successful API call
    verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'failed'
    error_message TEXT, -- Last error if verification failed
    
    -- Platform-specific metadata
    account_number VARCHAR(50), -- Tradier account number, etc.
    
    -- Permissions (read-only enforcement)
    permissions JSONB DEFAULT '{"read_only": true}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- One credential per platform per user
    UNIQUE(user_id, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_credentials_user_id ON api_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_platform ON api_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_api_credentials_active ON api_credentials(is_active);

-- Audit log for API key operations (security compliance)
CREATE TABLE IF NOT EXISTS api_key_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id INTEGER REFERENCES api_credentials(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'verified', 'failed', 'deleted', 'rotated'
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON api_key_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON api_key_audit_log(created_at DESC);

-- User onboarding status
CREATE TABLE IF NOT EXISTS user_onboarding (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    onboarding_completed BOOLEAN DEFAULT false,
    current_step VARCHAR(50) DEFAULT 'welcome', -- 'welcome', 'api_keys', 'accounts', 'complete'
    skipped_steps JSONB DEFAULT '[]',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON user_onboarding(user_id);

COMMENT ON TABLE api_credentials IS 'Encrypted storage for user API keys. Keys are encrypted with AES-256-GCM using server-side encryption key.';
COMMENT ON COLUMN api_credentials.encrypted_api_key IS 'AES-256-GCM encrypted API key (Base64 encoded)';
COMMENT ON COLUMN api_credentials.encryption_iv IS 'Initialization vector for AES decryption (Base64 encoded)';
COMMENT ON COLUMN api_credentials.permissions IS 'JSON object defining allowed operations (enforces read-only)';
