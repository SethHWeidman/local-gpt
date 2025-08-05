/**
 * Application-wide constants and model configuration.
 *
 * API_ENDPOINTS holds the REST API base URLs.
 * OPENAI_MODELS, ANTHROPIC_MODELS, and REASONING_MODELS are lists loaded from shared/models.json.
 * Note: REASONING_MODELS is used by the backend to determine temperature settings.
 */
import modelConfig from "../../shared/models.json";

// Base URL for API: in development use local backend, in production use same origin
const BASE_URL = import.meta.env.DEV ? "http://localhost:5005" : "";

export const API_ENDPOINTS = {
  CONVERSATIONS: `${BASE_URL}/api/conversations`,
  MESSAGES: `${BASE_URL}/api/messages`,
  AUTH: {
    LOGIN: `${BASE_URL}/api/auth/login`,
    REGISTER: `${BASE_URL}/api/auth/register`,
    ME: `${BASE_URL}/api/auth/me`,
    KEYS: `${BASE_URL}/api/auth/keys`,
  },
};

export const OPENAI_MODELS = modelConfig.openai_models;

export const ANTHROPIC_MODELS = modelConfig.anthropic_models;

export const REASONING_MODELS = modelConfig.reasoning_models;
