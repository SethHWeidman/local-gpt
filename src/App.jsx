import { useState, useRef, useEffect } from "react";
import {
  ConversationProvider,
  useConversation,
} from "./contexts/ConversationContext";
import Modal from "./components/Modal";
import ConversationPanel from "./components/ConversationPanel";
import InteractionArea from "./components/InteractionArea";
import api from "./api";

const AppContent = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editState, setEditState] = useState({ id: null, text: "" });
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const eventSourceRef = useRef(null);

  const {
    currentConversation,
    setCurrentConversation,
    currentUserInput,
    setCurrentUserInput,
    fetchConversations,
    loadConversationMessages,
    selectedLLM,
  } = useConversation();

  const messagesEndRef = useRef(null);
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [currentConversation.messages]);

  const toggleDeleteMode = () => setIsDeleteMode((prev) => !prev);

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      await fetchConversations();
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
    const textToSend = currentUserInput.trim();

    const systemMessage = currentConversation.systemMessage || "";

    if (!textToSend) {
      return;
    }

    const newUserMessage = { text: textToSend, sender: "user" };
    setCurrentConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, newUserMessage],
    }));
    setCurrentUserInput("");

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

    if (currentConversation.id) {
      urlParams.append("conversationId", currentConversation.id);
    }
    urlParams.append("llm", selectedLLM);

    const url = `${baseUrl}?${urlParams.toString()}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    let assistantMessageIndex = -1;

    es.onmessage = (evt) => {
      console.log("Received SSE event:", evt.data);
      try {
        const parsed = JSON.parse(evt.data);

        if (parsed.error) {
          console.error("Stream error:", parsed.error);
          setCurrentConversation((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { text: `Error: ${parsed.error}`, sender: "system" },
            ],
          }));
          es.close();
          setIsModalVisible(false);
          return;
        }

        if (parsed.new_conversation_id) {
          const newId = parsed.new_conversation_id;
          console.log("Received new conversation ID:", newId);

          const currentSystemMessage = systemMessage;
          const currentUserMessage = newUserMessage;

          const messagesForNewConversation = [];
          if (currentSystemMessage) {
            messagesForNewConversation.push({
              text: currentSystemMessage,
              sender: "system",
            });
          }
          messagesForNewConversation.push(currentUserMessage);

          setCurrentConversation((prevConv) => ({
            ...prevConv,
            id: newId,
            messages: messagesForNewConversation,
            systemMessage: currentSystemMessage,
          }));

          fetchConversations();

          setCurrentConversation((prevConv) => ({
            ...prevConv,
            messages: [
              ...prevConv.messages,
              { text: "", sender: "assistant", llm_model: selectedLLM },
            ],
          }));

          assistantMessageIndex = messagesForNewConversation.length;
          return;
        }

        if (parsed.token !== undefined) {
          const token = parsed.token;

          setCurrentConversation((prev) => {
            const newMessages = [...prev.messages];
            if (assistantMessageIndex === -1) {
              newMessages.push({
                text: token,
                sender: "assistant",
                llm_model: selectedLLM,
              });
              assistantMessageIndex = newMessages.length - 1;
            } else {
              if (newMessages[assistantMessageIndex]) {
                newMessages[assistantMessageIndex] = {
                  ...newMessages[assistantMessageIndex],
                  text: newMessages[assistantMessageIndex].text + token,
                };
              } else {
                console.error("Assistant message index out of bounds!");
              }
            }
            return { ...prev, messages: newMessages };
          });
        }
      } catch (err) {
        console.error(
          "Failed to parse SSE data or update state:",
          evt.data,
          err
        );
      }
    };

    const handleClose = (isError = false) => {
      es.close();
      eventSourceRef.current = null;
      setIsModalVisible(false);
      console.log(`SSE connection closed${isError ? " due to error" : ""}.`);
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
      handleClose(true);
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
      await fetchConversations();
      if (currentConversation.id === id) {
      }
    } catch (error) {
      console.error("Error updating conversation topic:", error);
    }
  };

  const handleConversationSelected = (conversationId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsModalVisible(false);
    }
    loadConversationMessages(conversationId);
  };

  return (
    <>
      <Modal
        isVisible={isModalVisible}
        message="Thinking..."
      />
      <div className="header-material">
        <h1 className="main-title">Local GPT</h1>
        <p>Now with conversation history!</p>
      </div>
      <div className="app-container">
        <ConversationPanel
          editState={editState}
          setEditState={setEditState}
          onEditComplete={handleEditConversation}
          onSelectConversation={handleConversationSelected}
          isDeleteMode={isDeleteMode}
          toggleDeleteMode={toggleDeleteMode}
          onDeleteConversation={handleDeleteConversation}
        />
        <InteractionArea
          onSubmit={handleSubmit}
          messagesEndRef={messagesEndRef}
        />
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
