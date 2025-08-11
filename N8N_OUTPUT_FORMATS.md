# N8N Workflow Output Formats

This document specifies the exact output formats expected from the N8N workflow for proper integration with the message aggregator backend.

## Overview

The N8N workflow responds to webhook requests with different formats based on the request type. The backend processes these responses to handle AI-generated replies and manager handover scenarios.

## 1. POST Request Response (User Query Processing)

When the backend sends a user message to N8N for AI processing, N8N should respond with:

### Standard AI Response Format
```json
{
  "answer": "AI-generated response text",
  "manager": false
}
```

### Manager Handover Response Format  
```json
{
  "answer": "I'll connect you with a manager who can help you better.",
  "manager": true
}
```

### Key Fields:
- **`answer`** (string, required): The AI-generated response text that will be sent to the user
- **`manager`** (boolean, required): 
  - `false` = Continue with AI support
  - `true` = Hand over to human manager (disables AI for this chat)

## 2. PUT Request Response (Settings Update)

When the backend sends settings updates to N8N:

```json
{
  "status": "Update processed successfully"
}
```

## 3. GET Request Response (Settings Retrieval)

When the backend requests current settings from N8N:

```json
{
  "system message for ai": "Current system message from database",
  "faqs": "Current FAQs from database"
}
```

## Backend Processing Logic

### AI Response Processing (`handle_n8n_response`)
1. **Extract Response**: Parse `answer` and `manager` fields
2. **Save AI Message**: Store the `answer` text as a new message in database
3. **Manager Handover Check**: If `manager: true`:
   - Set `chat.ai = False`
   - Set `chat.waiting = True`
   - Broadcast status change to frontend
4. **WebSocket Broadcast**: Send new message to all connected clients

### Database Schema Used
- **`chats.ai`**: Boolean - AI enabled/disabled status
- **`chats.waiting`**: Boolean - Waiting for manager confirmation
- **`chats.is_awaiting_manager_confirmation`**: Boolean - Frontend compatibility field

### Manager Handover Workflow
```
User Message → N8N AI Processing → Response with manager: true
↓
Backend Updates: ai=false, waiting=true
↓
Frontend Shows: "WAITING" indicator, moves to "Waiting for Manager" section
↓
Manager Takes Over: Manual responses from frontend
```

## Auto AI Reactivation (New Feature)

### Trigger Conditions
- Chat has `waiting = true` and `ai = false`
- No client messages for 10+ minutes (`last_client_message_at`)
- Automatic reactivation every 2 minutes check

### Reactivation Process
1. Set `chat.ai = true`, `chat.waiting = false`
2. Send auto-message: "🤖 AI support has been automatically reactivated. How can I help you?"
3. Broadcast status change to frontend
4. Move chat from "Waiting" to "AI Active" section

## Error Handling

### Invalid N8N Response
If N8N response is malformed or missing required fields:
- Backend logs error
- Sends fallback message to user
- Does not change chat AI status

### N8N Timeout/Unavailable
- Backend catches timeout exceptions
- Sends fallback message: "I'm experiencing technical difficulties. A human agent will assist you shortly."
- Does not forward message to N8N

## File Upload Behavior

### Important: Files Bypass N8N
- All file uploads (photos, documents, videos, audio) automatically:
  - Set `chat.ai = false` 
  - Set `chat.waiting = true`
  - **Do NOT send to N8N**
  - Immediately alert manager for handling

### File Types Detected
- **Photos**: `📷 Photo received`
- **Documents**: `📎 Document received: filename.pdf`
- **Videos**: `🎥 Video received`
- **Audio**: `🎵 Audio received`

## Testing Checklist

✅ **Standard AI Response**: Verify `{"answer": "text", "manager": false}` creates message and keeps AI active
✅ **Manager Handover**: Verify `{"answer": "text", "manager": true}` disables AI and enables waiting status
✅ **Settings Update**: Verify PUT requests return proper status confirmation
✅ **Settings Retrieval**: Verify GET requests return current system message and FAQs
✅ **Auto Reactivation**: Verify AI reactivates after 10 minutes of client silence
✅ **File Handling**: Verify files bypass N8N and turn off AI immediately
✅ **WebSocket Updates**: Verify frontend receives real-time status changes
✅ **Error Handling**: Verify malformed responses trigger fallback messages

## Critical Notes

1. **Field Names**: Use exact field names (`answer`, `manager`) - case sensitive
2. **Boolean Values**: Use actual boolean `true`/`false`, not strings
3. **Response Time**: N8N should respond within 30 seconds to avoid timeout
4. **Manager Field**: Always include `manager` field, even if `false`
5. **Message Content**: The `answer` field content is sent directly to users via Telegram

This format ensures seamless integration between N8N AI processing and the message aggregator's chat management system.
