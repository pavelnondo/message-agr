-- Version Control Migration for Tenant Settings and FAQs
-- This migration adds version control tables to preserve history and enable reverts

-- 1. Create versioned tenant settings table
CREATE TABLE IF NOT EXISTS tenant_settings_history (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    system_message TEXT,
    handover_mode VARCHAR(10),
    language VARCHAR(5),
    thresholds JSONB,
    version INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_current BOOLEAN DEFAULT false
);

-- 2. Create versioned FAQs table
CREATE TABLE IF NOT EXISTS faqs_history (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords JSONB,
    priority INT,
    version INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenant_settings_history_tenant_version ON tenant_settings_history(tenant_id, version);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_history_current ON tenant_settings_history(tenant_id, is_current);
CREATE INDEX IF NOT EXISTS idx_faqs_history_tenant_version ON faqs_history(tenant_id, version);
CREATE INDEX IF NOT EXISTS idx_faqs_history_tenant ON faqs_history(tenant_id);

-- 4. Migrate existing data to version control system
-- First, get the current timestamp as version number
DO $$
DECLARE
    current_version INT;
    tenant_record RECORD;
BEGIN
    current_version := EXTRACT(EPOCH FROM NOW())::INT;
    
    -- Migrate existing tenant settings to history
    FOR tenant_record IN SELECT * FROM tenant_settings LOOP
        INSERT INTO tenant_settings_history (
            tenant_id, system_message, handover_mode, language, thresholds, version, is_current
        ) VALUES (
            tenant_record.tenant_id,
            tenant_record.system_message,
            tenant_record.handover_mode,
            tenant_record.language,
            tenant_record.thresholds,
            current_version,
            true
        );
    END LOOP;
    
    -- Migrate existing FAQs to history
    INSERT INTO faqs_history (
        tenant_id, question, answer, keywords, priority, version
    )
    SELECT 
        tenant_id, question, answer, keywords, priority, current_version
    FROM faqs;
END $$;

-- 5. Create a view for current tenant settings (for backward compatibility)
CREATE OR REPLACE VIEW current_tenant_settings AS
SELECT 
    tenant_id,
    system_message,
    handover_mode,
    language,
    thresholds,
    version,
    created_at
FROM tenant_settings_history
WHERE is_current = true;

-- 6. Create a view for current FAQs (for backward compatibility)
CREATE OR REPLACE VIEW current_faqs AS
SELECT 
    fh.tenant_id,
    fh.question,
    fh.answer,
    fh.keywords,
    fh.priority,
    fh.version,
    fh.created_at
FROM faqs_history fh
INNER JOIN (
    SELECT tenant_id, MAX(version) as max_version
    FROM faqs_history
    GROUP BY tenant_id
) latest ON fh.tenant_id = latest.tenant_id AND fh.version = latest.max_version
WHERE fh.is_active = true OR fh.is_active IS NULL;

-- 7. Add comments for documentation
COMMENT ON TABLE tenant_settings_history IS 'Version control table for tenant settings - preserves all historical versions';
COMMENT ON TABLE faqs_history IS 'Version control table for FAQs - preserves all historical versions';
COMMENT ON COLUMN tenant_settings_history.version IS 'Unix timestamp used as version identifier';
COMMENT ON COLUMN tenant_settings_history.is_current IS 'Flag indicating if this is the currently active version';
COMMENT ON COLUMN faqs_history.version IS 'Unix timestamp used as version identifier - matches tenant_settings_history version';

-- 8. Verify the migration
SELECT 
    'tenant_settings_history' as table_name,
    COUNT(*) as record_count
FROM tenant_settings_history
UNION ALL
SELECT 
    'faqs_history' as table_name,
    COUNT(*) as record_count
FROM faqs_history;

-- 9. Show sample of migrated data
SELECT 
    'Current tenant settings' as info,
    tenant_id,
    version,
    is_current
FROM tenant_settings_history
WHERE is_current = true
ORDER BY tenant_id;

SELECT 
    'Sample FAQs from latest version' as info,
    tenant_id,
    COUNT(*) as faq_count,
    MAX(version) as version
FROM faqs_history
GROUP BY tenant_id
ORDER BY tenant_id;
