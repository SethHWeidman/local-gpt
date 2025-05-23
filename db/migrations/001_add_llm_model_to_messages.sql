-- Add the llm_model column to the messages table
ALTER TABLE messages
ADD COLUMN llm_model VARCHAR(50) NULL;

-- You can add a comment to confirm it ran
COMMENT ON COLUMN messages.llm_model IS 'Stores the LLM that generated the message, e.g., chatgpt, claude. Added YYYY-MM-DD.';