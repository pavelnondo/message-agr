-- Ensure uuid-ossp extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add uuid column if missing
ALTER TABLE chats ADD COLUMN IF NOT EXISTS uuid uuid;

-- Ensure a default is set so inserts without uuid succeed
ALTER TABLE chats ALTER COLUMN uuid SET DEFAULT uuid_generate_v4();

-- Backfill any NULL uuids (if the column is currently nullable)
UPDATE chats SET uuid = uuid_generate_v4() WHERE uuid IS NULL;

-- Optionally enforce NOT NULL (uncomment if desired)
-- ALTER TABLE chats ALTER COLUMN uuid SET NOT NULL;


