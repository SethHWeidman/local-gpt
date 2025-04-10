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

  async submitInteraction(userText, systemMessage) {
    const response = await fetch(API_ENDPOINTS.SUBMIT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userText, systemMessage }),
    });
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
};

export default api;
