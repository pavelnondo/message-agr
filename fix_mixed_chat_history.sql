-- Fix mixed chat history by creating separate chats for different users
-- This script will help separate the mixed chat history between sifisonondo and fifo033

-- First, let's see what we have
SELECT 
    c.id as chat_id,
    c.user_id,
    c.name,
    c.created_at,
    COUNT(m.id) as message_count
FROM chats c
LEFT JOIN messages m ON c.id = m.chat_id
WHERE c.user_id LIKE '%sifisonondo%' OR c.user_id LIKE '%fifo033%'
GROUP BY c.id, c.user_id, c.name, c.created_at
ORDER BY c.created_at;

-- Create new chat for fifo033 if it doesn't exist
INSERT INTO chats (uuid, user_id, name, ai, waiting, messager, is_awaiting_manager_confirmation, created_at, updated_at, ai_enabled, last_client_message_at, hidden, tenant_id, session_id)
SELECT 
    gen_random_uuid()::text as uuid,
    'fifo033 [1374368397]' as user_id,
    'fifo033' as name,
    ai,
    waiting,
    messager,
    is_awaiting_manager_confirmation,
    NOW() as created_at,
    NOW() as updated_at,
    ai_enabled,
    last_client_message_at,
    hidden,
    tenant_id,
    '1374368397' as session_id
FROM chats 
WHERE user_id LIKE '%sifisonondo%'
AND NOT EXISTS (
    SELECT 1 FROM chats WHERE user_id = 'fifo033 [1374368397]'
)
LIMIT 1;

-- Get the new chat ID for fifo033
DO $$
DECLARE
    new_chat_id INTEGER;
    old_chat_id INTEGER;
BEGIN
    -- Get the new chat ID for fifo033
    SELECT id INTO new_chat_id 
    FROM chats 
    WHERE user_id = 'fifo033 [1374368397]' 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Get the old chat ID that has mixed messages
    SELECT id INTO old_chat_id 
    FROM chats 
    WHERE user_id LIKE '%sifisonondo%' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Move messages from fifo033 to the new chat
    -- This is a heuristic approach - you may need to adjust the logic
    -- based on your specific message patterns
    
    -- Update messages that appear to be from fifo033 to the new chat
    UPDATE messages 
    SET chat_id = new_chat_id
    WHERE chat_id = old_chat_id
    AND (
        -- Add conditions to identify fifo033 messages
        -- This is a placeholder - you'll need to define the logic
        -- based on your message content patterns
        message LIKE '%fifo033%' OR
        message LIKE '%1374368397%'
        -- Add more specific conditions as needed
    );
    
    RAISE NOTICE 'Moved messages from chat % to new chat % for fifo033', old_chat_id, new_chat_id;
END $$;

-- Show the results
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
