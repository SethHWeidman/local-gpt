-- Add user association to conversations if not exists
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);