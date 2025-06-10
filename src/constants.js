import modelConfig from "../shared/models.json";

export const API_ENDPOINTS = {
  CONVERSATIONS: "http://localhost:5005/api/conversations",
  MESSAGES: "http://localhost:5005/api/messages",
};

export const MODEL_INDICATORS = {
  GPT: "H",
  CLAUDE: "C",
};

export const OPENAI_MODELS = modelConfig.openai_models;

export const ANTHROPIC_MODELS = modelConfig.anthropic_models;

export const REASONING_MODELS = modelConfig.reasoning_models;
