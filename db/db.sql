DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;


-- Create the "conversations" table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    conversation_topic VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    active_message_id INTEGER
);

-- Create the "messages" table with tree structure support
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    message_text TEXT NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    llm_model VARCHAR(50) NULL,
    llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    parent_message_id INTEGER,
    branch_order INTEGER DEFAULT 0,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Add foreign key constraint for active_message_id (must be added after messages table is created)
ALTER TABLE conversations ADD CONSTRAINT fk_active_message 
    FOREIGN KEY (active_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_messages_parent_id ON messages(parent_message_id);
CREATE INDEX idx_messages_conversation_parent ON messages(conversation_id, parent_message_id);
CREATE INDEX idx_messages_branch_order ON messages(parent_message_id, branch_order);
