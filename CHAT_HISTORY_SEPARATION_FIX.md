# Chat History Separation Fix

## Problem Description

The chat history of `sifisonondo [5636526615]` is mixed with `fifo033 [1374368397]` because the system was not properly separating chats for different devices/users. This happens when:

1. Multiple devices write to the bot
2. The system reuses existing chat records instead of creating new ones
3. Messages from different users get stored in the same chat

## Root Cause

The issue was in the chat creation and lookup logic in `backend/crud.py`:

1. **Chat Lookup**: The `get_chat_by_user_id` function only checks the `user_id` field
2. **No Device Separation**: The system doesn't distinguish between different devices/sessions for the same user
3. **Chat Reuse**: When a new device writes to the bot, it reuses the existing chat instead of creating a new one

## Solution Implemented

### 1. Database Schema Changes

Added a `session_id` column to the `chats` table to support device separation:

```sql
ALTER TABLE chats ADD COLUMN session_id VARCHAR(100);
```

### 2. Code Changes

#### Modified `backend/crud.py`:

- Added `session_id` field to the `Chat` model
- Created `get_chat_by_user_id_and_session()` function for session-based chat lookup
- Modified `create_chat()` to accept optional `session_id` parameter

#### Modified `backend/main.py`:

- Updated `process_telegram_message()` to use session-based chat creation
- Uses Telegram `chat_id` as the session identifier
- Creates separate chats for different devices/sessions

### 3. Migration Scripts

Created two SQL scripts:

1. **`migrate_add_session_id.sql`**: Adds the session_id column
2. **`fix_mixed_chat_history.sql`**: Helps separate existing mixed chat history

## How It Works Now

1. **Session Identification**: Each Telegram chat gets a unique session_id (the Telegram chat_id)
2. **Chat Creation**: New chats are created with both `user_id` and `session_id`
3. **Chat Lookup**: The system first tries to find a chat by `user_id` + `session_id`, then falls back to just `user_id`
4. **Device Separation**: Different devices will create separate chat sessions even for the same user

## Implementation Steps

### Step 1: Run Database Migration

```sql
-- Run this in your database
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'chats' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE chats ADD COLUMN session_id VARCHAR(100);
        RAISE NOTICE 'Successfully added session_id column to chats table';
    ELSE
        RAISE NOTICE 'session_id column already exists, skipping migration';
    END IF;
END $$;
```

### Step 2: Deploy Code Changes

1. Deploy the updated `backend/crud.py` and `backend/main.py` files
2. Restart the backend service

### Step 3: Fix Existing Mixed History (Optional)

If you want to separate the existing mixed chat history, run the `fix_mixed_chat_history.sql` script. **Note**: This requires manual review and adjustment based on your specific message patterns.

## Testing

After deployment:

1. **New Device Test**: Have a new device write to the bot - it should create a new chat
2. **Existing Device Test**: Have an existing device write to the bot - it should use the existing chat
3. **Multiple Devices**: Have multiple devices write to the bot - each should have its own chat

## Verification

Check the database to verify separation:

```sql
SELECT 
    c.id as chat_id,
    c.user_id,
    c.name,
    c.session_id,
    COUNT(m.id) as message_count
FROM chats c
LEFT JOIN messages m ON c.id = m.chat_id
WHERE c.user_id LIKE '%sifisonondo%' OR c.user_id LIKE '%fifo033%'
GROUP BY c.id, c.user_id, c.name, c.session_id
ORDER BY c.created_at;
```

## Benefits

1. **Device Separation**: Each device gets its own chat session
2. **Backward Compatibility**: Existing chats continue to work
3. **Scalability**: Supports multiple devices per user
4. **Clean History**: No more mixed chat histories

## Future Considerations

1. **Session Management**: Consider implementing session expiration
2. **Chat Merging**: Add functionality to merge chats if needed
3. **User Preferences**: Allow users to manage their chat sessions
4. **Analytics**: Track session usage for better user experience
