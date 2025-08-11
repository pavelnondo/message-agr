-- Multi-Tenant Database Schema Migration
-- Stage 1: Database changes for multi-business AI aggregator

-- 1. Create tenant_settings table for per-business AI configuration
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

-- 2. Create faqs table for per-business FAQ storage
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

-- 3. Add tenant_id to existing chats table
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 4. Add tenant_id to existing messages table  
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 5. Add tenant_id to existing bot_settings table (for backward compatibility)
ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_tenant_id ON faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_tenant_active ON faqs(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_chats_tenant_id ON chats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_settings_tenant_id ON bot_settings(tenant_id);

-- 7. Migrate existing data to new structure
-- Move existing bot_settings to tenant_settings for 'default' tenant
INSERT INTO tenant_settings (tenant_id, system_message, handover_mode, language, thresholds, created_at, updated_at)
SELECT 
  'default',
  (SELECT value FROM bot_settings WHERE key = 'system message for ai' LIMIT 1),
  'ask',
  'en',
  '{}',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM tenant_settings WHERE tenant_id = 'default');

-- Move existing FAQs to new faqs table
INSERT INTO faqs (tenant_id, question, answer, keywords, priority, is_active, created_at, updated_at)
SELECT 
  'default',
  'Legacy FAQ',
  (SELECT value FROM bot_settings WHERE key = 'faqs' LIMIT 1),
  '',
  1,
  true,
  now(),
  now()
WHERE EXISTS (SELECT 1 FROM bot_settings WHERE key = 'faqs' AND value IS NOT NULL);

-- 8. Add constraints for data integrity
ALTER TABLE tenant_settings 
ADD CONSTRAINT check_handover_mode CHECK (handover_mode IN ('ask', 'immediate'));

ALTER TABLE tenant_settings 
ADD CONSTRAINT check_language CHECK (language IN ('en', 'ru', 'es', 'fr', 'de'));

-- 9. Create view for easy tenant data access
CREATE OR REPLACE VIEW tenant_overview AS
SELECT 
  ts.tenant_id,
  ts.system_message,
  ts.handover_mode,
  ts.language,
  ts.thresholds,
  COUNT(DISTINCT c.id) as total_chats,
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT f.id) as total_faqs,
  ts.updated_at as last_updated
FROM tenant_settings ts
LEFT JOIN chats c ON ts.tenant_id = c.tenant_id
LEFT JOIN messages m ON ts.tenant_id = m.tenant_id  
LEFT JOIN faqs f ON ts.tenant_id = f.tenant_id AND f.is_active = true
GROUP BY ts.tenant_id, ts.system_message, ts.handover_mode, ts.language, ts.thresholds, ts.updated_at;

-- 10. Add comments for documentation
COMMENT ON TABLE tenant_settings IS 'Per-business AI configuration and settings';
COMMENT ON TABLE faqs IS 'Per-business FAQ storage with keywords for matching';
COMMENT ON COLUMN tenant_settings.handover_mode IS 'Manager handover behavior: ask=prompt user, immediate=direct handover';
COMMENT ON COLUMN tenant_settings.thresholds IS 'JSON config for AI sensitivity, response limits, etc.';
COMMENT ON COLUMN faqs.keywords IS 'Comma-separated keywords for FAQ matching without embeddings';
COMMENT ON COLUMN faqs.priority IS 'FAQ importance/ordering (1=highest priority)';
