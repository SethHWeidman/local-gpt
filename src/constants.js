export const API_ENDPOINTS = {
  CONVERSATIONS: "http://localhost:5005/api/conversations",
  MESSAGES: "http://localhost:5005/api/messages",
};

export const MODEL_INDICATORS = {
  GPT: "H",
  CLAUDE: "C",
};

// List of available OpenAI models for selection in the UI
export const OPENAI_MODELS = [
  "gpt-4.1-2025-04-14",
  "o4-mini",
];

// List of available Anthropic Claude models for selection in the UI
export const ANTHROPIC_MODELS = [
  "claude-sonnet-4-0",
  "claude-opus-4-0",
];
