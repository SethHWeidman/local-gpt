/**
 * Application-wide constants and model configuration.
 *
 * API_ENDPOINTS holds the REST API base URLs.
 * OPENAI_MODELS, ANTHROPIC_MODELS, and REASONING_MODELS are lists loaded from shared/models.json.
 * Note: REASONING_MODELS is used by the backend to determine temperature settings.
 */
import modelConfig from "../shared/models.json";

export const API_ENDPOINTS = {
  CONVERSATIONS: "http://localhost:5005/api/conversations",
  MESSAGES: "http://localhost:5005/api/messages",
};

export const OPENAI_MODELS = modelConfig.openai_models;

export const ANTHROPIC_MODELS = modelConfig.anthropic_models;

export const REASONING_MODELS = modelConfig.reasoning_models;
