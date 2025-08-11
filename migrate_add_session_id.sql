-- Migration to add session_id column to chats table for device separation
-- Run this script manually in your database

-- Check if session_id column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'chats' AND column_name = 'session_id'
    ) THEN
        -- Add session_id column
        ALTER TABLE chats ADD COLUMN session_id VARCHAR(100);
        RAISE NOTICE 'Successfully added session_id column to chats table';
    ELSE
        RAISE NOTICE 'session_id column already exists, skipping migration';
    END IF;
END $$;
