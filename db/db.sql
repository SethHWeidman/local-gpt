DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;


-- Create the "conversations" table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    conversation_topic VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the "messages" table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    message_text TEXT NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

