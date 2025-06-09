import { API_ENDPOINTS } from "./constants";

const api = {
  async fetchConversations() {
    const response = await fetch(API_ENDPOINTS.CONVERSATIONS);
    return response.json();
  },

  async fetchMessages(conversationId) {
    const response = await fetch(`${API_ENDPOINTS.MESSAGES}/${conversationId}`);
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
