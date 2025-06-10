-- Add the llm_provider column to the messages table
ALTER TABLE messages
ADD COLUMN llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai';

COMMENT ON COLUMN messages.llm_provider IS 'Indicates the provider: openai or anthropic. Added YYYY-MM-DD.';