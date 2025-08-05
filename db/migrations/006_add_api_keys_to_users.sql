-- Add columns for storing per-user API keys
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
  ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
