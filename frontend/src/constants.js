/**
 * Application-wide constants and model configuration.
 *
 * API_ENDPOINTS holds the REST API base URLs.
 * OPENAI_MODELS, ANTHROPIC_MODELS, and REASONING_MODELS are lists loaded from shared/models.json.
 * Note: REASONING_MODELS is used by the backend to determine temperature settings.
 */
import modelConfig from "../../shared/models.json";

// Dev hits the local Flask server; prod must be relative to the current page (/gptree/)
const ORIGIN = import.meta.env.DEV ? "http://localhost:5005" : "";
const API_ROOT = import.meta.env.DEV ? "/api" : "api"; // NOTE: no leading "/" in prod

export const API_ENDPOINTS = {
  CONVERSATIONS: `${ORIGIN}${API_ROOT}/conversations`,
  MESSAGES: `${ORIGIN}${API_ROOT}/messages`,
  AUTH: {
    LOGIN: `${ORIGIN}${API_ROOT}/auth/login`,
    REGISTER: `${ORIGIN}${API_ROOT}/auth/register`,
    ME: `${ORIGIN}${API_ROOT}/auth/me`,
    KEYS: `${ORIGIN}${API_ROOT}/auth/keys`,
  },
  // If you reference the SSE endpoint anywhere, expose it here too:
  STREAM: import.meta.env.DEV ? `${ORIGIN}/stream` : `stream`,
};

export const OPENAI_MODELS = modelConfig.openai_models;

export const ANTHROPIC_MODELS = modelConfig.anthropic_models;

export const REASONING_MODELS = modelConfig.reasoning_models;
