-- Message Aggregator Database Setup Script
-- Run this script on your existing PostgreSQL database

-- Create the database if it doesn't exist
-- CREATE DATABASE message_aggregator;

-- Connect to the database
-- \c message_aggregator;

-- Create tables for the message aggregator application

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) DEFAULT 'Unknown',
    ai BOOLEAN DEFAULT FALSE,
    waiting BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    messager VARCHAR(50) DEFAULT 'telegram',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    ai BOOLEAN DEFAULT FALSE,
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_uuid ON chats(uuid);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chats_updated_at 
    BEFORE UPDATE ON chats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional)
-- INSERT INTO chats (uuid, name, ai, tags) VALUES 
--     ('sample-chat-1', 'Sample Chat 1', false, ARRAY['support', 'urgent']),
--     ('sample-chat-2', 'Sample Chat 2', true, ARRAY['general']);

-- INSERT INTO messages (chat_id, message, message_type, ai) VALUES 
--     (1, 'Hello, I need help with my account', 'text', false),
--     (1, 'I can help you with that. What specific issue are you experiencing?', 'text', true),
--     (2, 'How do I reset my password?', 'text', false),
--     (2, 'You can reset your password by clicking the "Forgot Password" link on the login page.', 'text', true);

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;

COMMIT; 