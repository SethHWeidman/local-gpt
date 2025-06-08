export const API_ENDPOINTS = {
  CONVERSATIONS: "http://localhost:5005/api/conversations",
  MESSAGES: "http://localhost:5005/api/messages",
  SUBMIT: "http://localhost:5005/submit-interaction",
};

export const MODEL_INDICATORS = {
  GPT: "H",
  CLAUDE: "C",
};

// List of available OpenAI models for selection in the UI
// List of available models (OpenAI and Anthropic Claude) for selection in the UI
export const OPENAI_MODELS = [
  "gpt-4.1-2025-04-14",
  "o4-mini",
  "claude-sonnet-4-0",
];
