-- MERIDIAN DASHBOARD - LEGAL ONBOARDING SCHEMA
-- Database: meridian_0j0f
-- Created: 2026-02-20
-- Purpose: User agreement tracking, e-signatures, compliance documentation

-- ============================================================================
-- 1. ONBOARDING SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'failed')),
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  abandoned_at TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed')
  )
);

CREATE INDEX idx_onboarding_user ON onboarding_sessions(user_id);
CREATE INDEX idx_onboarding_token ON onboarding_sessions(session_token);
CREATE INDEX idx_onboarding_status ON onboarding_sessions(status);

-- ============================================================================
-- 2. RISK ACKNOWLEDGMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS risk_acknowledgments (
  id SERIAL PRIMARY KEY,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL CHECK (risk_type IN (
    'options_trading_risk',
    'automated_trading_risk',
    'no_performance_guarantee',
    'no_fdic_insurance',
    'market_volatility',
    'leverage_margin_risk',
    'system_downtime_risk',
    'third_party_api_risk',
    'total_loss_possible',
    'past_performance_disclaimer',
    'no_investment_advice',
    'user_sole_responsibility'
  )),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMP,
  ip_address INET,
  UNIQUE(onboarding_session_id, risk_type)
);

CREATE INDEX idx_risk_ack_session ON risk_acknowledgments(onboarding_session_id);
CREATE INDEX idx_risk_ack_user ON risk_acknowledgments(user_id);

-- ============================================================================
-- 3. DOCUMENT AGREEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_agreements (
  id SERIAL PRIMARY KEY,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'terms_of_service',
    'privacy_policy',
    'risk_disclosure',
    'arbitration_agreement',
    'liability_waiver',
    'performance_disclaimer'
  )),
  document_version TEXT NOT NULL,
  document_hash TEXT NOT NULL, -- SHA-256 hash of document content
  accepted BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMP,
  ip_address INET,
  scroll_percentage INTEGER, -- How far user scrolled (0-100)
  time_spent_seconds INTEGER, -- Time spent viewing document
  UNIQUE(onboarding_session_id, document_type)
);

CREATE INDEX idx_doc_agreement_session ON document_agreements(onboarding_session_id);
CREATE INDEX idx_doc_agreement_user ON document_agreements(user_id);
CREATE INDEX idx_doc_agreement_type ON document_agreements(document_type);

-- ============================================================================
-- 4. SIGNATURE EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS signature_events (
  id SERIAL PRIMARY KEY,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('typed', 'drawn', 'uploaded')),
  signature_data TEXT NOT NULL, -- Base64 encoded signature image or typed name
  signer_name TEXT NOT NULL,
  signer_date DATE NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  geolocation TEXT, -- Optional: City, State, Country
  timestamp_utc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_hash TEXT NOT NULL, -- HMAC of signature + timestamp + IP
  is_valid BOOLEAN NOT NULL DEFAULT true,
  invalidated_at TIMESTAMP,
  invalidation_reason TEXT
);

CREATE INDEX idx_signature_session ON signature_events(onboarding_session_id);
CREATE INDEX idx_signature_user ON signature_events(user_id);
CREATE INDEX idx_signature_timestamp ON signature_events(timestamp_utc);

-- ============================================================================
-- 5. ACCREDITED INVESTOR VERIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS accredited_investor_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  is_accredited BOOLEAN NOT NULL,
  qualification_basis TEXT CHECK (qualification_basis IN (
    'income_individual', -- $200K+ individual
    'income_joint', -- $300K+ joint
    'net_worth', -- $1M+ excluding primary residence
    'professional_designation', -- Series 7, 65, 82
    'entity', -- $5M+ entity
    'none' -- Not accredited
  )),
  self_certified BOOLEAN NOT NULL DEFAULT true,
  third_party_verified BOOLEAN NOT NULL DEFAULT false,
  verification_document_url TEXT, -- S3 link to uploaded documentation
  verified_at TIMESTAMP,
  expires_at TIMESTAMP, -- Verification valid for 90 days
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accredited_user ON accredited_investor_verifications(user_id);
CREATE INDEX idx_accredited_status ON accredited_investor_verifications(is_accredited);

-- ============================================================================
-- 6. USER DOCUMENTS (S3 Storage References)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'signed_tos',
    'signed_risk_disclosure',
    'signed_privacy_policy',
    'complete_onboarding_package',
    'accredited_investor_proof',
    'identity_verification'
  )),
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_url TEXT NOT NULL, -- Presigned URL for download
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'failed')),
  uploaded_at TIMESTAMP,
  expires_at TIMESTAMP, -- Presigned URL expiration
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_docs_user ON user_documents(user_id);
CREATE INDEX idx_user_docs_session ON user_documents(onboarding_session_id);
CREATE INDEX idx_user_docs_type ON user_documents(document_type);

-- ============================================================================
-- 7. AGE VERIFICATION FAILURES (Compliance Logging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS age_verification_failures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  provided_dob DATE,
  calculated_age INTEGER,
  minimum_age_required INTEGER NOT NULL DEFAULT 18,
  ip_address INET NOT NULL,
  user_agent TEXT,
  blocked BOOLEAN NOT NULL DEFAULT true,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_age_fail_user ON age_verification_failures(user_id);
CREATE INDEX idx_age_fail_timestamp ON age_verification_failures(attempted_at);

-- ============================================================================
-- 8. AUDIT LOG (Complete Event Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS onboarding_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'session_started',
    'step_completed',
    'risk_acknowledged',
    'document_viewed',
    'document_accepted',
    'signature_captured',
    'accredited_verified',
    'age_verified',
    'age_verification_failed',
    'session_completed',
    'session_abandoned'
  )),
  event_data JSONB, -- Additional context (step number, document ID, etc.)
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON onboarding_audit_log(user_id);
CREATE INDEX idx_audit_session ON onboarding_audit_log(onboarding_session_id);
CREATE INDEX idx_audit_event ON onboarding_audit_log(event_type);
CREATE INDEX idx_audit_timestamp ON onboarding_audit_log(timestamp);

-- ============================================================================
-- 9. USER CONSENT TRACKING (GDPR/CCPA Compliance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'terms_of_service',
    'privacy_policy',
    'marketing_emails',
    'data_processing',
    'third_party_sharing',
    'performance_tracking'
  )),
  consent_version TEXT NOT NULL,
  consented BOOLEAN NOT NULL,
  consented_at TIMESTAMP,
  revoked_at TIMESTAMP,
  ip_address INET,
  current BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, consent_type, current)
);

CREATE INDEX idx_consent_user ON user_consents(user_id);
CREATE INDEX idx_consent_type ON user_consents(consent_type);
CREATE INDEX idx_consent_current ON user_consents(current) WHERE current = true;

-- ============================================================================
-- 10. COOLING-OFF PERIOD TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS cooling_off_periods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  onboarding_session_id INTEGER REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  cooling_off_hours INTEGER NOT NULL DEFAULT 24,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP NOT NULL,
  waived BOOLEAN NOT NULL DEFAULT false,
  waived_at TIMESTAMP,
  waiver_reason TEXT,
  notified_user BOOLEAN NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMP,
  CONSTRAINT valid_waiver CHECK (
    (waived = true AND waived_at IS NOT NULL AND waiver_reason IS NOT NULL) OR
    (waived = false)
  )
);

CREATE INDEX idx_cooling_off_user ON cooling_off_periods(user_id);
CREATE INDEX idx_cooling_off_ends ON cooling_off_periods(ends_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Check if user has completed onboarding
CREATE OR REPLACE FUNCTION user_has_completed_onboarding(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM onboarding_sessions
    WHERE user_id = p_user_id AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Check if user is in cooling-off period
CREATE OR REPLACE FUNCTION user_in_cooling_off(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM cooling_off_periods
    WHERE user_id = p_user_id
    AND ends_at > CURRENT_TIMESTAMP
    AND waived = false
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Get user's latest signature
CREATE OR REPLACE FUNCTION get_latest_signature(p_user_id INTEGER)
RETURNS TABLE (
  signature_data TEXT,
  signer_name TEXT,
  signed_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT se.signature_data, se.signer_name, se.timestamp_utc
  FROM signature_events se
  WHERE se.user_id = p_user_id
  AND se.is_valid = true
  ORDER BY se.timestamp_utc DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA RETENTION POLICY (6 Years for Compliance)
-- ============================================================================

COMMENT ON TABLE onboarding_sessions IS 'Retain for 6 years per SEC Rule 204-2';
COMMENT ON TABLE signature_events IS 'Retain for 6 years per ESIGN Act';
COMMENT ON TABLE document_agreements IS 'Retain for 6 years per SEC requirements';
COMMENT ON TABLE accredited_investor_verifications IS 'Retain for 6 years per SEC Rule 506';
COMMENT ON TABLE onboarding_audit_log IS 'Retain for 6 years for legal compliance';

-- ============================================================================
-- GRANTS (Application Database User)
-- ============================================================================

-- Grant permissions to application user (meridian_user)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO meridian_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO meridian_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO meridian_user;
