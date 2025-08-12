// FINAL FIX for Normalize Input node
// Replace the existing jsCode in the "Normalize Input" node with this:

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
