# Fix for n8n get_settings Action

## Problem
The webhook is receiving a `get_settings` action but the PostgreSQL nodes are failing because `tenant_id` is not available in the request body.

## Root Cause
The "Normalize Input" node only handles regular message requests and doesn't account for different action types like `get_settings`.

## Solution

### Step 1: Fix the "Normalize Input" Node

Replace the jsCode in the "Normalize Input" node with:

```javascript
const body = $json.body || {}; // Access the body property first

// Handle different action types
if (body.action === 'get_settings') {
  // For get_settings action, determine tenant_id
  // You can extract it from the webhook URL or use a default
  const webhookUrl = $json.webhookUrl || '';
  let tenant_id = 'default';
  
  // Extract tenant_id from webhook URL if available
  // Example: https://domain.com/webhook/76a8bfb0-a105-41a0-8553-e64a9d25ad79
  // You might want to map webhook IDs to tenant IDs
  if (webhookUrl.includes('76a8bfb0-a105-41a0-8553-e64a9d25ad79')) {
    tenant_id = 'tenant_1'; // Map to your specific tenant
  }
  
  return [{
    json: {
      action: 'get_settings',
      tenant_id: tenant_id,
      timestamp: body.timestamp
    }
  }];
} else {
  // Handle regular message requests
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
}
```

### Step 2: Fix the "Get Current Settings" Node

Update the SQL query in the "Get Current Settings" node to handle missing tenant_id:

```sql
SELECT system_message, handover_mode, language, thresholds
FROM tenant_settings
WHERE tenant_id = COALESCE('{{ $json.tenant_id }}', 'default')
LIMIT 1;
```

### Step 3: Add a Switch Node (Optional)

For better workflow control, add a Switch node after "Normalize Input" to route different actions:

1. **Add Switch Node** after "Normalize Input"
2. **Configure conditions**:
   - `$json.action === 'get_settings'` → Route to settings retrieval
   - `$json.action !== 'get_settings'` → Route to regular message processing

### Step 4: Update Response Handling

Make sure the "Format GET Response" node handles the get_settings case properly:

```javascript
const settings = $('Get Current Settings').first().json || {};
const faqs = $('Load Tenant FAQs').all().map(i => i.json);

// Check if this is a get_settings request
const isGetSettings = $('Normalize Input').first().json.action === 'get_settings';

if (isGetSettings) {
  return [{
    json: {
      "system message for ai": settings.system_message || "",
      "faqs": faqs.length 
        ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') 
        : "No FAQs",
      "handover_mode": settings.handover_mode || "ask",
      "language": settings.language || "en",
      "thresholds": settings.thresholds || {}
    }
  }];
} else {
  // Regular response format
  return [{
    json: {
      "system message for ai": settings.system_message || "",
      "faqs": faqs.length 
        ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') 
        : "No FAQs"
    }
  }];
}
```

## Testing

After making these changes:

1. **Test get_settings action**: Send a POST request with `{"action": "get_settings", "timestamp": "..."}`
2. **Test regular message**: Send a regular message request
3. **Verify responses**: Both should work without errors

## Alternative: Simple Fix

If you want a quick fix, just update the "Normalize Input" node to always provide a tenant_id:

```javascript
const body = $json.body || {};
return [{
  json: {
    tenant_id: body.tenant_id || 'default', // Always provide tenant_id
    chat_id: body.chat_id,
    question: body.text || '',
    system_message: body.system_message || null,
    faqs: body.faqs || null,
    user_id: body.user_id || null,
    channel: body.channel || 'webapp',
    action: body.action || null // Include action for routing
  }
}];
```

This ensures that `tenant_id` is always available for the PostgreSQL queries.
