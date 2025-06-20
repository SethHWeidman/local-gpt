/**
 * API utility for interacting with the backend conversation and message endpoints.
 */
import { API_ENDPOINTS } from "./constants";

const api = {
  async fetchConversations() {
    const response = await fetch(API_ENDPOINTS.CONVERSATIONS);
    return response.json();
  },

  /**
   * Fetch the active path of messages for a conversation,
   * optionally overriding the active message via query param.
   */
  async fetchMessages(conversationId, activeMessageId) {
    let url = `${API_ENDPOINTS.MESSAGES}/${conversationId}`;
    if (activeMessageId != null) {
      url += `?activeMessageId=${activeMessageId}`;
    }
    const response = await fetch(url);
    return response.json();
  },

  async fetchConversationTree(conversationId) {
    const response = await fetch(
      `${API_ENDPOINTS.CONVERSATIONS}/${conversationId}/tree`
    );
    return response.json();
  },

  async setActiveMessage(conversationId, messageId) {
    const response = await fetch(
      `${API_ENDPOINTS.CONVERSATIONS}/${conversationId}/active-message`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId }),
      }
    );
    return response.json();
  },

  async fetchMessageChildren(messageId) {
    const response = await fetch(
      `${API_ENDPOINTS.MESSAGES}/${messageId}/children`
    );
    return response.json();
  },

  async updateConversationTopic(id, topic) {
    const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    return response.json();
  },

  async deleteConversation(id) {
    const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error("Failed to delete conversation");
    }
    return response.json();
  },
};

export default api;
