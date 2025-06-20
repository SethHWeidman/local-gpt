-- Migration to add tree structure support to messages
-- This allows messages to have parent-child relationships for branching conversations

-- Add parent_message_id to create tree structure
ALTER TABLE messages ADD COLUMN parent_message_id INTEGER;
ALTER TABLE messages ADD CONSTRAINT fk_parent_message 
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- Add index for better performance when traversing the tree
CREATE INDEX idx_messages_parent_id ON messages(parent_message_id);
CREATE INDEX idx_messages_conversation_parent 
    ON messages(conversation_id, parent_message_id);

-- Add a field to track which message is currently selected in each conversation
-- This determines the active path in the tree
ALTER TABLE conversations ADD COLUMN active_message_id INTEGER;
ALTER TABLE conversations ADD CONSTRAINT fk_active_message 
    FOREIGN KEY (active_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Add a sequence number within each parent to maintain order of branches
ALTER TABLE messages ADD COLUMN branch_order INTEGER DEFAULT 0;
CREATE INDEX idx_messages_branch_order ON messages(parent_message_id, branch_order);