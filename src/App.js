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
