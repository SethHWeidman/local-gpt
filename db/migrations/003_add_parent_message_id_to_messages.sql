-- Add parent_message_id column to messages if not exists
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS parent_message_id INTEGER NULL REFERENCES messages(id);

COMMENT ON COLUMN messages.parent_message_id IS
  'Indicates the parent message id for tree-structured conversations. Added 
  YYYY-MM-DD.';