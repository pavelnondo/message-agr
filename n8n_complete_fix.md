# Complete n8n Fix for tenant_id Issue

## Problem
The PostgreSQL query is failing with: `column "tenant_1" does not exist` because the `tenant_id` is not being properly passed through the n8n workflow nodes.

## Root Cause
The "Normalize Input" node is not handling the `get_settings` action properly, so the `tenant_id` is not available to the "Get Current Settings" PostgreSQL node.

## Solution

### Step 1: Fix the "Normalize Input" Node

**Node ID**: `567fccec-34ab-4899-948b-514e151a44c2`

Replace the jsCode with:

```javascript
const body = $json.body || {};

// Handle get_settings action with tenant_id from backend
if (body.action === 'get_settings') {
  return [{
    json: {
      action: 'get_settings',
      tenant_id: body.tenant_id || 'default', // Use tenant_id from backend
      timestamp: body.timestamp
    }
  }];
}

// Handle save_settings action with tenant_id from backend
if (body.action === 'save_settings') {
  return [{
    json: {
      action: 'save_settings',
      tenant_id: body.tenant_id || 'default', // Use tenant_id from backend
      system_message: body.system_message || '',
      faqs: body.faqs || '',
      timestamp: body.timestamp
    }
  }];
}

// Handle regular message requests (existing logic)
return [{
  json: {
    tenant_id: body.tenant_id || 'default',
    chat_id: body.chat_id,
    question: body.text || '',
    system_message: body.system_message || null,
    faqs: body.faqs || null,
    user_id: body.user_id || null,
    channel: body.channel || 'webapp'
  }
}];
```

### Step 2: Fix the "Get Current Settings" Node

**Node ID**: `ee5b9e23-6229-46f3-af65-98d4b281e5ca`

Update the SQL query to:

```sql
SELECT system_message, handover_mode, language, thresholds
FROM tenant_settings
WHERE tenant_id = '{{ $json.tenant_id }}'
LIMIT 1;
```

**Important**: Use single quotes around the expression: `'{{ $json.tenant_id }}'`

### Step 3: Fix the "Load Tenant Settings" Node

**Node ID**: `5cfc33fd-77c7-4536-852a-b2fea6623903`

Update the SQL query to:

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

### Step 4: Test the Workflow

1. **Deploy the workflow** with the changes
2. **Test get_settings**: Send a request with `{"action": "get_settings", "tenant_id": "tenant_1", "timestamp": "..."}`
3. **Check the logs** to ensure no SQL errors

## Alternative: Debug the Data Flow

If you're still having issues, add a debug node after "Normalize Input" to see what data is being passed:

**Add Debug Node**:
```javascript
// Debug node to see what data is available
return [{
  json: {
    debug_info: "Data from Normalize Input",
    input_data: $input.item.json,
    tenant_id: $input.item.json.tenant_id,
    action: $input.item.json.action
  }
}];
```

## Expected Data Flow

1. **Webhook receives**: `{"action": "get_settings", "tenant_id": "tenant_1", "timestamp": "..."}`
2. **Normalize Input outputs**: `{"action": "get_settings", "tenant_id": "tenant_1", "timestamp": "..."}`
3. **Get Current Settings executes**: `SELECT ... WHERE tenant_id = 'tenant_1'`
4. **Result**: Settings for tenant_1 are returned

## Common Issues

1. **Missing quotes**: Use `'{{ $json.tenant_id }}'` not `{{ $json.tenant_id }}`
2. **Wrong node reference**: Make sure you're referencing the correct node
3. **Data not flowing**: Check that the "Normalize Input" node is properly connected to "Get Current Settings"
