-- ============================================================================
-- Orbit 2.0 Cloudflare D1 Migration: 0003_user_ai_credentials.sql
-- Entity: User AI Credentials for Bring Your Own API Key (BYOK)
-- Encrypted at rest, isolated by user_id, with cascade deletion
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_ai_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'anthropic')),
  encrypted_key TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  preferred_model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_user ON user_ai_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_provider ON user_ai_credentials(user_id, provider);
