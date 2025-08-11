-- Multi-Tenant Database Schema Migration
-- Stage 1: Database changes for multi-business AI aggregator

-- 1. Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create tenant_settings table for per-business AI configuration
CREATE TABLE IF NOT EXISTS tenant_settings (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  system_message TEXT,
  handover_mode TEXT DEFAULT 'ask', -- 'ask' or 'immediate'
  language TEXT DEFAULT 'en',
  thresholds JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create faqs table for per-business FAQ storage
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT, -- optional comma-separated list for matching
  priority INTEGER DEFAULT 1, -- for ordering/importance
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add tenant_id to existing chats table
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 5. Add tenant_id to existing messages table  
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 6. Add tenant_id to existing bot_settings table (for backward compatibility)
ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_tenant_id ON faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_tenant_active ON faqs(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_chats_tenant_id ON chats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_settings_tenant_id ON bot_settings(tenant_id);

-- 8. Migrate existing data to new structure
-- Move existing bot_settings to tenant_settings for 'default' tenant
INSERT INTO tenant_settings (tenant_id, system_message, handover_mode, language, thresholds)
SELECT 
  'default',
  COALESCE(value, ''),
  'ask',
  'en',
  '{}'::jsonb
FROM bot_settings 
WHERE key = 'system_message'
ON CONFLICT (tenant_id) DO NOTHING;

-- 9. Create default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, tenant_id, is_admin)
VALUES ('admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gS8sK.', 'default', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 10. Add constraints for data integrity
ALTER TABLE tenant_settings 
ADD CONSTRAINT check_handover_mode CHECK (handover_mode IN ('ask', 'immediate'));

ALTER TABLE tenant_settings 
ADD CONSTRAINT check_language CHECK (language IN ('en', 'ru', 'es', 'fr', 'de'));

-- 11. Create view for easy tenant data access
CREATE OR REPLACE VIEW tenant_overview AS
SELECT 
  ts.tenant_id,
  ts.system_message,
  ts.handover_mode,
  ts.language,
  ts.thresholds,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT c.id) as chat_count,
  COUNT(DISTINCT m.id) as message_count
FROM tenant_settings ts
LEFT JOIN users u ON u.tenant_id = ts.tenant_id
LEFT JOIN chats c ON c.tenant_id = ts.tenant_id
LEFT JOIN messages m ON m.tenant_id = ts.tenant_id
GROUP BY ts.id, ts.tenant_id, ts.system_message, ts.handover_mode, ts.language, ts.thresholds;

-- 12. Add comments for documentation
COMMENT ON TABLE users IS 'User authentication and tenant association';
COMMENT ON TABLE tenant_settings IS 'Per-business AI configuration and behavior settings';
COMMENT ON TABLE faqs IS 'Per-business FAQ storage with keywords for matching';
COMMENT ON COLUMN users.tenant_id IS 'Links user to specific business tenant';
COMMENT ON COLUMN tenant_settings.handover_mode IS 'Manager handover behavior: ask=prompt user, immediate=direct handover';
COMMENT ON COLUMN tenant_settings.thresholds IS 'JSON config for AI sensitivity, response limits, etc.';
COMMENT ON COLUMN faqs.keywords IS 'Comma-separated keywords for FAQ matching without embeddings';
COMMENT ON COLUMN faqs.priority IS 'FAQ importance/ordering (1=highest priority)';
