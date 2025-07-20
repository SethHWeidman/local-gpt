/**
 * App.jsx
 *
 * Defines the main application components:
 * - AppContent: handles conversation UI, user input, and streaming responses.
 * - App: wraps AppContent with ConversationProvider for global state.
 */
import { useState, useRef, useEffect } from "react";
import {
  ConversationProvider,
  useConversation,
} from "./contexts/ConversationContext";
import ConversationPanel from "./components/ConversationPanel";
import StreamingIndicator from "./components/StreamingIndicator";
import ControlPanel from "./components/ControlPanel";
import InteractionArea from "./components/InteractionArea";
import DeleteModeToggle from "./components/DeleteModeToggle";
import api from "./api";

const AppContent = () => {
  const [isStreaming, setIsStreaming] = useState(false);
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
    selectedParentId,
    setSelectedParentId,
  } = useConversation();

  const messagesEndRef = useRef(null);
  // Scroll to the end of the chat when new messages arrive.
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [currentConversation.messages]);

  // Toggle delete mode to enable removing conversations.
  const toggleDeleteMode = () => setIsDeleteMode((prev) => !prev);

  // Delete a conversation and refresh the conversation list.
  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      await fetchConversations();
      if (currentConversation?.id === id) {
        await loadConversationMessages(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  // Send user input and stream assistant response via SSE.
  const handleSubmit = async () => {
    const textToSend = currentUserInput.trim();

    const systemMessage = currentConversation.systemMessage || "";

    if (!textToSend) {
      return;
    }

    setCurrentUserInput("");
    setIsStreaming(true);

    // Clean up any existing SSE connection to avoid duplicate streams.
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const baseUrl = "http://localhost:5005/stream";
    // Construct URL parameters: always include user text and add system message only
    // when starting a new conversation.
    const urlParams = new URLSearchParams({
      userText: textToSend,
      ...(currentConversation.id ? {} : { systemMessage: systemMessage }),
    });

    if (currentConversation.id) {
      urlParams.append("conversationId", currentConversation.id);
    }
    urlParams.append("llm", selectedLLM);
    if (currentConversation.id != null && selectedParentId != null) {
      urlParams.append("parentMessageId", selectedParentId);
    }

    const url = `${baseUrl}?${urlParams.toString()}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    let assistantMessageIndex = -1;
    let pendingUserText = textToSend;
    const branchParentId =
      currentConversation.id != null ? selectedParentId : null;
    let assistantParentId = null;

    es.onmessage = (evt) => {
      console.log("Received SSE event:", evt.data);
      // Handle incoming Server-Sent Events: parse the JSON payload and route it through
      // the appropriate update flows (errors, new conversation, assignment of message
      // IDs, or streaming tokens) inside this try block.
      try {
        const parsed = JSON.parse(evt.data);

        if (parsed.error) {
          console.error("Stream error:", parsed.error);
          // On stream error, append a system message with the error text to the
          // conversation.
          setCurrentConversation((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { text: `Error: ${parsed.error}`, sender: "system" },
            ],
          }));
          es.close();
          setIsStreaming(false);
          return;
        }

        if (parsed.new_conversation_id) {
          const newId = parsed.new_conversation_id;
          console.log("Received new conversation ID:", newId);

          setCurrentConversation((prev) => ({
            ...prev,
            id: newId,
            messages: [],
          }));
          setSelectedParentId(null);

          fetchConversations();
          return;
        }
        if (parsed.user_message_id !== undefined) {
          const newUserMsgId = parsed.user_message_id;
          assistantParentId = newUserMsgId;
          // Add the user's message and a temporary assistant stub to the conversation
          // to optimistically update the UI while waiting for the assistant response
          setCurrentConversation((prev) => {
            const base = prev.messages;
            const userMsg = {
              id: newUserMsgId,
              text: pendingUserText,
              sender: "user",
              parent_message_id: branchParentId,
            };
            const stubMsg = {
              // temporary stub with unique key; will be updated with real id when
              // streaming completes
              id: `assistant-stub-${newUserMsgId}`,
              key: `assistant-stub-${newUserMsgId}`,
              text: "",
              sender: "assistant",
              llm_model: selectedLLM,
              parent_message_id: newUserMsgId,
            };
            assistantMessageIndex = base.length + 1;
            return {
              ...prev,
              messages: [...base, userMsg, stubMsg],
            };
          });
          setSelectedParentId(newUserMsgId);
          return;
        }
        // Assign an ID to the final assistant stub for correct branching
        if (parsed.assistant_message_id !== undefined) {
          const newAssistId = parsed.assistant_message_id;
          setCurrentConversation((prev) => {
            const newMessages = [...prev.messages];
            // Replace the temporary assistant stub's id with the actual id once
            // received
            if (
              assistantMessageIndex !== -1 &&
              newMessages[assistantMessageIndex]
            ) {
              newMessages[assistantMessageIndex] = {
                ...newMessages[assistantMessageIndex],
                id: newAssistId,
              };
            }
            return { ...prev, messages: newMessages };
          });
          setSelectedParentId(newAssistId);
          return;
        }
        // Only process streaming token fragments here; ignore SSE events without a
        // token field.
        // Other parsed messages (e.g., assistant_message_id updates) are already
        // handled above.
        if (parsed.token !== undefined) {
          const token = parsed.token;

          setCurrentConversation((prev) => {
            const newMessages = [...prev.messages];
            if (assistantMessageIndex === -1) {
              newMessages.push({
                text: token,
                sender: "assistant",
                llm_model: selectedLLM,
                parent_message_id: assistantParentId,
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
      setIsStreaming(false);
      console.log(`SSE connection closed${isError ? " due to error" : ""}.`);
    };

    // Close SSE connection on error and display a system message.
    es.onerror = (evt) => {
      if (es.readyState === EventSource.CLOSED) return;
      console.error("SSE error: connection lost", evt);
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

  // Update conversation topic and refresh the conversation list.
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

  // Load messages for selected conversation and reset any active stream, unless
  // re-selecting the already active conversation (e.g., on rename).
  const handleConversationSelected = (conversationId) => {
    if (conversationId === currentConversation.id) {
      return;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsStreaming(false);
    }
    loadConversationMessages(conversationId);
  };

  return (
    <>
      <div className="header-material">
        <h1 className="main-title">GPTree</h1>
        <p>Have conversations with LLMs, visualized with a tree structure.</p>
        <DeleteModeToggle
          isDeleteMode={isDeleteMode}
          toggleDeleteMode={toggleDeleteMode}
        />
        <StreamingIndicator isVisible={isStreaming} />
      </div>
      <div className="app-container">
        <ConversationPanel
          editState={editState}
          setEditState={setEditState}
          onEditComplete={handleEditConversation}
          onSelectConversation={handleConversationSelected}
          isDeleteMode={isDeleteMode}
          onDeleteConversation={handleDeleteConversation}
          isStreaming={isStreaming}
        />
        <InteractionArea
          onSubmit={handleSubmit}
          messagesEndRef={messagesEndRef}
        />
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
