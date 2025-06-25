-- Add parent_message_id column to messages to support conversation tree branching
ALTER TABLE messages
ADD COLUMN parent_message_id INTEGER NULL REFERENCES messages(id);

COMMENT ON COLUMN messages.parent_message_id IS
  'Indicates the parent message id for tree-structured conversations. Added YYYY-MM-DD.';