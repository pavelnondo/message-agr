# Fix for FAQ Retrieval in n8n Workflow

## Problem
The "Format GET Response" node is trying to get FAQs from a "Load Tenant FAQs" node that doesn't exist, but the FAQs are actually included in the "Load Tenant Settings" node.

## Current Code (Broken)
```javascript
const settings = $('Get Current Settings').first().json || {};
const faqs = $('Load Tenant FAQs').all().map(i => i.json);

return [{
  json: {
    "system message for ai": settings.system_message || "",
    "faqs": faqs.length 
      ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') 
      : "No FAQs"
  }
}];
```

## Fixed Code
```javascript
const settings = $('Get Current Settings').first().json || {};
const tenantSettings = $('Load Tenant Settings').first().json || {};

// Get FAQs from the tenant_settings query result
const faqs = tenantSettings.faqs || [];

return [{
  json: {
    "system message for ai": settings.system_message || "",
    "faqs": faqs.length 
      ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') 
      : "No FAQs"
  }
}];
```

## Alternative: Use Only "Get Current Settings"

If you want to simplify, you can modify the "Get Current Settings" node to include FAQs and then use only that node:

### Step 1: Update "Get Current Settings" Node
**Node ID**: `ee5b9e23-6229-46f3-af65-98d4b281e5ca`

Change the SQL query to:
```sql
SELECT 
    ts.system_message,
    ts.handover_mode,
    ts.language,
    ts.thresholds,
    (SELECT jsonb_agg(jsonb_build_object('question', f.question, 'answer', f.answer))
     FROM faqs f 
     WHERE f.tenant_id = ts.tenant_id) AS faqs
FROM tenant_settings ts
WHERE ts.tenant_id = '{{ $json.tenant_id }}'
LIMIT 1;
```

### Step 2: Update "Format GET Response" Node
**Node ID**: `6d67224f-5d97-4243-b54e-73926d43cc9b`

Use this simplified code:
```javascript
const settings = $('Get Current Settings').first().json || {};
const faqs = settings.faqs || [];

return [{
  json: {
    "system message for ai": settings.system_message || "",
    "faqs": faqs.length 
      ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') 
      : "No FAQs"
  }
}];
```

## Also Fix "Load Tenant Settings" Node

**Node ID**: `5cfc33fd-77c7-4536-852a-b2fea6623903`

Change the SQL query from:
```sql
WHERE ts.tenant_id = COALESCE('{{ $('Normalize Input').item.json.tenant_id }}', 'default')
```

To:
```sql
WHERE ts.tenant_id = '{{ $json.tenant_id }}'
```

## Expected Result
After these fixes, you should get:
```json
{
  "system message for ai": "You are a helpful AI assistant for tenant 1.",
  "faqs": "Q: What are your hours?\nA: We're open 9-5.\n\nQ: How do I contact support?\nA: Call us at 555-1234."
}
```
