-- Updated N8N Workflow Queries for Version Control System
-- These queries work with the new version-controlled tables

-- 1. Load Tenant Settings (for n8n "Load Tenant Settings" node)
SELECT 
    COALESCE(system_message, '') AS system_message, 
    COALESCE(handover_mode, 'ask') AS handover_mode, 
    COALESCE(language, 'en') AS language, 
    COALESCE(thresholds, '{}'::jsonb) AS thresholds,
    version
FROM tenant_settings_history 
WHERE tenant_id = COALESCE('{{$json.tenant_id}}', 'default') 
AND is_current = true
LIMIT 1;

-- 2. Load Tenant FAQs (for n8n "Load Tenant FAQs" node)
SELECT 
    question, 
    answer, 
    keywords 
FROM faqs_history 
WHERE tenant_id = COALESCE('{{$json.tenant_id}}', 'default') 
AND version = (
    SELECT MAX(version) 
    FROM faqs_history 
    WHERE tenant_id = COALESCE('{{$json.tenant_id}}', 'default')
)
ORDER BY priority, id;

-- 3. Update Tenant Settings (for n8n PUT query node)
-- This creates a new version instead of updating existing data
-- Replace the existing PUT query with this version-controlled approach:

-- Step 1: Archive current settings
UPDATE tenant_settings_history
SET is_current = false
WHERE tenant_id = '{{$json.tenant_id}}' AND is_current = true;

-- Step 2: Insert new settings version
INSERT INTO tenant_settings_history (
    tenant_id, system_message, handover_mode, 
    language, thresholds, version, is_current
) VALUES (
    '{{$json.tenant_id}}',
    '{{$json.system_message}}',
    COALESCE('{{$json.handover_mode}}', 'ask'),
    COALESCE('{{$json.language}}', 'en'),
    COALESCE('{{$json.thresholds}}'::jsonb, '{}'::jsonb),
    EXTRACT(EPOCH FROM NOW())::INT,
    true
);

-- 4. Update FAQs (for n8n PUT query node)
-- This creates a new version of all FAQs for the tenant
-- Replace the existing FAQ update logic with this:

-- Step 1: Insert new FAQ versions
-- (This should be done for each FAQ in the update array)
INSERT INTO faqs_history (
    tenant_id, question, answer, keywords, priority, version
) VALUES 
-- Example for multiple FAQs:
('{{$json.tenant_id}}', '{{$json.faqs[0].question}}', '{{$json.faqs[0].answer}}', '{{$json.faqs[0].keywords}}', 1, EXTRACT(EPOCH FROM NOW())::INT),
('{{$json.tenant_id}}', '{{$json.faqs[1].question}}', '{{$json.faqs[1].answer}}', '{{$json.faqs[1].keywords}}', 2, EXTRACT(EPOCH FROM NOW())::INT);

-- 5. Revert to Previous Version (for n8n revert functionality)
-- To revert to a specific version (e.g., version 1754945295):

-- Revert tenant settings
UPDATE tenant_settings_history
SET is_current = false
WHERE tenant_id = '{{$json.tenant_id}}' AND is_current = true;

UPDATE tenant_settings_history
SET is_current = true
WHERE tenant_id = '{{$json.tenant_id}}' AND version = 1754945295;

-- Get FAQs from specific version
SELECT question, answer, keywords, priority
FROM faqs_history
WHERE tenant_id = '{{$json.tenant_id}}' AND version = 1754945295
ORDER BY priority;

-- 6. List Available Versions (for n8n version selection)
-- Get all available versions for a tenant
SELECT DISTINCT 
    version,
    created_at,
    CASE WHEN is_current THEN 'Current' ELSE 'Historical' END as status
FROM tenant_settings_history
WHERE tenant_id = '{{$json.tenant_id}}'
ORDER BY version DESC;

-- 7. Get Version Details (for n8n version info)
-- Get details about a specific version
SELECT 
    'settings' as type,
    tenant_id,
    system_message,
    handover_mode,
    language,
    version,
    created_at
FROM tenant_settings_history
WHERE tenant_id = '{{$json.tenant_id}}' AND version = 1754945295

UNION ALL

SELECT 
    'faqs' as type,
    tenant_id,
    question as system_message,
    answer as handover_mode,
    keywords as language,
    version,
    created_at
FROM faqs_history
WHERE tenant_id = '{{$json.tenant_id}}' AND version = 1754945295;

-- 8. Backward Compatibility Views
-- These views provide the same interface as the old tables
-- Use these for existing queries that don't need version control

-- Current tenant settings view
SELECT * FROM current_tenant_settings WHERE tenant_id = '{{$json.tenant_id}}';

-- Current FAQs view  
SELECT * FROM current_faqs WHERE tenant_id = '{{$json.tenant_id}}';
