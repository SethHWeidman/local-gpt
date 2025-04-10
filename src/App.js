import React, { useState, useRef, useEffect } from "react";
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
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const eventSourceRef = useRef(null);

  // Get state and functions from the updated context
  const {
    currentConversation,
    setCurrentConversation,
    currentUserInput, // Get the user input state
    setCurrentUserInput, // We need this if InteractionArea doesn't manage its own state
    fetchConversations,
    loadConversationMessages, // Get the message loading function
  } = useConversation();

  // Scroll to bottom when messages change
  // Trigger scroll on message update
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation.messages]);

  // Toggle delete mode
  const toggleDeleteMode = () => setIsDeleteMode((prev) => !prev);

  // Handle deleting a conversation
  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      await fetchConversations();
      // If the deleted conversation is the current one, reset it
      if (currentConversation?.id === id) {
        setCurrentConversation({
          systemMessage: "",
          userText: "",
          llmResponse: "",
        });
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const handleSubmit = async () => {
    // Use currentUserInput from context, trim whitespace
    const textToSend = currentUserInput.trim();

    // Get system message - either from current convo or a default (e.g., from ControlPanel state if you implement that)
    // For now, let's assume new convos use a default/empty string, and existing ones use the one loaded.
    // The backend logic already handles finding the system message for existing convos.
    const systemMessage = currentConversation.systemMessage || ""; // Or get from ControlPanel state

    if (!textToSend) {
      return; // Don't submit empty messages
    }

    // Optimistically add user message to the UI immediately
    const newUserMessage = { text: textToSend, sender: "user" };
    setCurrentConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, newUserMessage],
    }));
    setCurrentUserInput(""); // Clear the input field immediately

    setCurrentConversation((prev) => ({ ...prev, llmResponse: "" }));
    setIsModalVisible(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const baseUrl = "http://localhost:5005/stream";
    const urlParams = new URLSearchParams({
      userText: textToSend,
      ...(currentConversation.id ? {} : { systemMessage: systemMessage }),
    });

    // Add conversationId if it exists
    if (currentConversation.id) {
      urlParams.append("conversationId", currentConversation.id);
    }

    const url = `${baseUrl}?${urlParams.toString()}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    let assistantMessageIndex = -1; // Keep track of the assistant message being built

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

    const handleClose = (isError = false) => {
      es.close();
      eventSourceRef.current = null;
      setIsModalVisible(false);
      // Only fetch conversations if it was a *new* conversation and *not* an error close
      // Fetching is already done when new_conversation_id is received.
      // If continuing, the conversation already exists in the list.
      console.log(`SSE connection closed${isError ? " due to error" : ""}.`);
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
      handleClose(true); // Pass error flag
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { text: `Error: Connection lost`, sender: "system" },
        ],
      }));
    };
  };

  const handleEditConversation = async (id, newTopic) => {
    try {
      await api.updateConversationTopic(id, newTopic);
      setEditState({ id: null, text: "" });
      await fetchConversations(); // Refresh list
      // Optionally update topic in currentConversation if it's the selected one
      if (currentConversation.id === id) {
        // You might need to adjust the state structure or refetch if topic is stored there
      }
    } catch (error) {
      console.error("Error updating conversation topic:", error);
    }
  };

  const handleConversationSelected = (conversationId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close(); // Stop any active stream
      setIsModalVisible(false);
    }
    loadConversationMessages(conversationId); // Use the context function
  };

  return (
    <>
      <Modal
        isVisible={isModalVisible}
        message="Thinking..." // Updated message
      />
      <div className="header-material">
        {/* Header content */}
        <h1 className="main-title">Local GPT (Multi-Turn)</h1>
        <p>Now with conversation history!</p>
      </div>
      <div className="app-container">
        <ConversationPanel
          editState={editState}
          setEditState={setEditState}
          onEditComplete={handleEditConversation}
          onSelectConversation={handleConversationSelected} // Use updated handler
          isDeleteMode={isDeleteMode}
          toggleDeleteMode={toggleDeleteMode}
          onDeleteConversation={handleDeleteConversation}
        />
        {/* Pass messagesEndRef to InteractionArea if scrolling needs to be managed there */}
        <InteractionArea
          onSubmit={handleSubmit}
          messagesEndRef={messagesEndRef}
        />
        <ControlPanel /> {/* Consider adding system prompt input here */}
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
