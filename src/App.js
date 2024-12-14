import React, { useState } from "react";
import {
  ConversationProvider,
  useConversation,
} from "./contexts/ConversationContext";
import Modal from "./components/Modal";
import ControlPanel from "./components/ControlPanel";
import ConversationPanel from "./components/ConversationPanel";
import InteractionArea from "./components/InteractionArea";
import api from "./api";

// Create a new component to use hooks
const AppContent = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editState, setEditState] = useState({ id: null, text: "" });
  const { currentConversation, setCurrentConversation, fetchConversations } =
    useConversation();

  const handleSubmit = async () => {
    setIsModalVisible(true);
    try {
      const data = await api.submitInteraction(
        currentConversation.userText,
        currentConversation.systemMessage
      );
      setCurrentConversation((prev) => ({
        ...prev,
        llmResponse: data["GPT-4 Response"],
      }));
      await fetchConversations(); // Refresh the conversation list
    } catch (error) {
      console.error("Error submitting:", error);
    } finally {
      setIsModalVisible(false);
    }
  };

  const handleEditConversation = async (id, newTopic) => {
    await api.updateConversationTopic(id, newTopic);
    setEditState({ id: null, text: "" });
    await fetchConversations();
  };

  const handleSelectConversation = async (conversationId) => {
    try {
      const response = await api.fetchMessages(conversationId);
      // Find the different message types
      const systemMessage =
        response.find((msg) => msg.sender === "system")?.text || "";
      const userMessage =
        response.find((msg) => msg.sender === "user")?.text || "";
      const assistantMessage =
        response.find((msg) => msg.sender === "assistant")?.text || "";

      // Update the current conversation in context
      setCurrentConversation({
        systemMessage,
        userText: userMessage,
        llmResponse: assistantMessage,
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  return (
    <>
      <Modal
        isVisible={isModalVisible}
        message="Retrieving response from LLM, please wait..."
      />
      <div className="header-material">
        <h1 className="main-title">Local GPT</h1>
        <p>
          A way to interact with large language models locally on your laptop.
        </p>
      </div>
      <div className="app-container">
        <ConversationPanel
          editState={editState}
          setEditState={setEditState}
          onEditComplete={handleEditConversation}
          onSelectConversation={handleSelectConversation}
        />
        <InteractionArea onSubmit={handleSubmit} />
        <ControlPanel />
      </div>
    </>
  );
};

// Main App component wraps everything in the provider
const App = () => (
  <ConversationProvider>
    <AppContent />
  </ConversationProvider>
);

export default App;
