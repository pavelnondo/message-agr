// Fix for Normalize Input node to handle get_settings action
// Replace the existing jsCode in the Normalize Input node with this:

const body = $json.body || {}; // Access the body property first

// Handle different action types
if (body.action === 'get_settings') {
  // For get_settings action, we need to determine tenant_id
  // You can either:
  // 1. Use a default tenant_id
  // 2. Extract it from headers or other context
  // 3. Use the tenant_id from the webhook URL or other source
  
  return [{
    json: {
      action: 'get_settings',
      tenant_id: 'default', // or extract from appropriate source
      timestamp: body.timestamp
    }
  }];
} else {
  // Handle regular message requests
  return [{
    json: {
      tenant_id: body.tenant_id || 'default',
      chat_id: body.chat_id,
      question: body.text || '', // Changed from body.question to body.text
      system_message: body.system_message || null,
      faqs: body.faqs || null,
      user_id: body.user_id || null,
      channel: body.channel || 'webapp'
    }
  }];
}
