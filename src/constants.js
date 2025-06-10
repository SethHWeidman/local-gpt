import modelConfig from "../shared/models.json";

export const API_ENDPOINTS = {
  CONVERSATIONS: "http://localhost:5005/api/conversations",
  MESSAGES: "http://localhost:5005/api/messages",
};

export const MODEL_INDICATORS = {
  GPT: "H",
  CLAUDE: "C",
};

// List of available OpenAI models for selection in the UI
export const OPENAI_MODELS = modelConfig.openai_models;

// List of available Anthropic Claude models for selection in the UI
export const ANTHROPIC_MODELS = modelConfig.anthropic_models;

// Models that should run with no temperature ("reasoning models")
export const REASONING_MODELS = modelConfig.reasoning_models;
