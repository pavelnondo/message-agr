// Prepare History Query - Fixed Version with Database Chat ID Lookup
const inputItem = $input.item.json;

// Configuration
const MAX_USER_ID_LENGTH = 100;
const MAX_CHAT_INPUT_LENGTH = 5000;
const HISTORY_LIMIT = 40;

// Initialize output
const output = {
    userId: 'unknown_user',
    chatInput: '',
    chat_id: null,
    database_chat_id: null, // New field for database chat_id
    sqlSelectQuery: `SELECT NULL::text as message, NULL::text as message_type, 
                    NULL::timestamp with time zone as created_at, 
                    false as is_awaiting_manager_confirmation WHERE false;`
};

try {
    // Process User ID
    if (inputItem.user_id && typeof inputItem.user_id === 'string') {
        const cleanUserId = inputItem.user_id.trim();
        if (cleanUserId.length > 0 && cleanUserId.length <= MAX_USER_ID_LENGTH) {
            output.userId = cleanUserId;
        }
    }

    // Process Chat Input
    if (inputItem.question && typeof inputItem.question === 'string') {
        output.chatInput = inputItem.question.length > MAX_CHAT_INPUT_LENGTH
            ? inputItem.question.substring(0, MAX_CHAT_INPUT_LENGTH)
            : inputItem.question;
    }

    // Process Chat ID - Extract Telegram chat_id from user_id
    if (inputItem.chat_id) {
        const chatIdStr = String(inputItem.chat_id).trim();
        if (/^\d+$/.test(chatIdStr)) {
            output.chat_id = chatIdStr;
            
            // First, find the database chat_id using the Telegram chat_id
            // Look for chats where user_id contains the Telegram chat_id
            const findChatQuery = `
                SELECT id as database_chat_id
                FROM chats 
                WHERE user_id LIKE '%[${output.chat_id}]%'
                ORDER BY id DESC
                LIMIT 1;
            `;
            
            // For now, we'll use a placeholder. In n8n, you'll need to execute this query first
            // and then use the result in the main query
            output.findChatQuery = findChatQuery;
            
            // Main query using the found database_chat_id
            output.sqlSelectQuery = `
                WITH chat_lookup AS (
                    SELECT id as database_chat_id
                    FROM chats 
                    WHERE user_id LIKE '%[${output.chat_id}]%'
                    ORDER BY id DESC
                    LIMIT 1
                )
                SELECT
                    m.message,
                    m.message_type,
                    m.created_at,
                    COALESCE(c.is_awaiting_manager_confirmation, false) as is_awaiting_manager_confirmation
                FROM chat_lookup cl
                JOIN messages m ON m.chat_id = cl.database_chat_id
                LEFT JOIN chats c ON m.chat_id = c.id
                ORDER BY m.created_at DESC
                LIMIT ${HISTORY_LIMIT};
            `;
        }
    }

} catch (error) {
    console.error(`Prepare History Query Error: ${error.message}`);
}

return [{ json: output }];
