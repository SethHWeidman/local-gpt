import React, { useState, useRef } from "react";
import {
  ConversationProvider,
  useConversation,
} from "./contexts/ConversationContext";
import Modal from "./components/Modal";
import ControlPanel from "./components/ControlPanel";
import ConversationPanel from "./components/ConversationPanel";
import InteractionArea from "./components/InteractionArea";
import api from "./api";

const AppContent = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editState, setEditState] = useState({ id: null, text: "" });
  const eventSourceRef = useRef(null);

  const { currentConversation, setCurrentConversation, fetchConversations } =
    useConversation();

  const handleSubmit = async () => {
    const userText = currentConversation.userText || "";
    const systemMessage = currentConversation.systemMessage || "";

    if (!userText.trim() && !systemMessage.trim()) {
      return;
    }

    setCurrentConversation((prev) => ({ ...prev, llmResponse: "" }));
    setIsModalVisible(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const baseUrl = "http://localhost:5005/stream";
    const urlParams = new URLSearchParams({
      userText: userText,
      systemMessage: systemMessage,
    });
    const url = `${baseUrl}?${urlParams.toString()}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      console.log("Received SSE event:", evt.data); // Debug incoming data
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed.error) {
          console.error("Stream error:", parsed.error);
          setCurrentConversation((prev) => ({
            ...prev,
            llmResponse: `Error: ${parsed.error}`,
          }));
          es.close();
          setIsModalVisible(false);
          fetchConversations();
          return;
        }
        const token = parsed.token || "";
        setCurrentConversation((prev) => ({
          ...prev,
          llmResponse: (prev.llmResponse || "") + token,
        }));
      } catch (err) {
        console.error("Failed to parse SSE data:", evt.data, err);
      }
    };

    const handleClose = () => {
      es.close();
      eventSourceRef.current = null;
      setIsModalVisible(false);
      fetchConversations();
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
      handleClose();
    };
    es.onclose = handleClose;
  };

  const handleEditConversation = async (id, newTopic) => {
    await api.updateConversationTopic(id, newTopic);
    setEditState({ id: null, text: "" });
    await fetchConversations();
  };

  const handleSelectConversation = async (conversationId) => {
    try {
      const response = await api.fetchMessages(conversationId);
      const systemMessage =
        response.find((msg) => msg.sender === "system")?.text || "";
      const userMessage =
        response.find((msg) => msg.sender === "user")?.text || "";
      const assistantMessage =
        response.find((msg) => msg.sender === "assistant")?.text || "";

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

const App = () => (
  <ConversationProvider>
    <AppContent />
  </ConversationProvider>
);

export default App;
