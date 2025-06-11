/**
 * Application-wide constants and model configuration.
 *
 * API_ENDPOINTS holds the REST API base URLs.
 * MODEL_INDICATORS maps LLM providers to their UI indicator letters.
 * OPENAI_MODELS, ANTHROPIC_MODELS, and REASONING_MODELS are lists loaded from shared/models.json.
 */
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
