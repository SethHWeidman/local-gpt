/**
 * API utility for interacting with the backend conversation and message endpoints.
 */
import { API_ENDPOINTS } from "./constants";

const api = {
  async fetchConversations() {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(API_ENDPOINTS.CONVERSATIONS, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.json();
  },

  async fetchMessages(conversationId) {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(
      `${API_ENDPOINTS.MESSAGES}/${conversationId}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    return response.json();
  },

  async updateConversationTopic(id, topic) {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ topic }),
    });
    return response.json();
  },

  async deleteConversation(id) {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to delete conversation");
    }
    return response.json();
  },

  /**
   * Get the current user's API keys.
   */
  async getUserSettings() {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(API_ENDPOINTS.AUTH.ME, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return {
      openai_api_key: data.user.openai_api_key,
      anthropic_api_key: data.user.anthropic_api_key,
    };
  },

  /**
   * Update the current user's API keys.
   */
  async updateUserSettings({ openai_api_key, anthropic_api_key }) {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(API_ENDPOINTS.AUTH.KEYS, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ openai_api_key, anthropic_api_key }),
    });
    return response.json();
  },
};

export default api;
