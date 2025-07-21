/**
 * ConversationContext.jsx
 *
 * Provides conversation state and actions to the React component tree.
 *
 * - conversations: list of available conversations.
 * - currentConversation: object with id, messages, and systemMessage.
 * - currentUserInput: text for the next user message.
 * - selectedLLM: the chosen language model identifier.
 *
 * Exposes functions to fetch conversations and messages from the backend.
 */
import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import api from "../api";
import { OPENAI_MODELS } from "../constants";

const ConversationContext = createContext();

export const ConversationProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState({
    id: null,
    messages: [],
    systemMessage: "",
  });

  const [currentUserInput, setCurrentUserInput] = useState("");
  const [selectedLLM, setSelectedLLM] = useState(OPENAI_MODELS[0]);
  const [selectedParentId, setSelectedParentId] = useState(null);

  // Fetch the list of conversations from the backend.
  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.fetchConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  }, []);

  // Fetch conversations when the provider mounts.
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages for a given conversation or reset state if none is selected.
  const loadConversationMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setCurrentConversation({ id: null, messages: [], systemMessage: "" });
      setCurrentUserInput("");
      return;
    }
    try {
      const fetchedMessages = await api.fetchMessages(conversationId);
      const systemMsg =
        fetchedMessages.find((msg) => msg.sender === "system")?.text || "";
      const displayMessages = fetchedMessages.filter(
        (msg) => msg.sender !== "system"
      );

      setCurrentConversation({
        id: conversationId,
        messages: displayMessages,
        systemMessage: systemMsg,
      });
      setSelectedParentId(null);
      setCurrentUserInput("");
    } catch (error) {
      console.error(
        `Error fetching messages for conversation ${conversationId}:`,
        error
      );
      setCurrentConversation({ id: null, messages: [], systemMessage: "" });
      setCurrentUserInput("");
    }
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        setConversations,
        currentConversation,
        setCurrentConversation,
        currentUserInput,
        setCurrentUserInput,
        fetchConversations,
        loadConversationMessages,
        selectedLLM,
        setSelectedLLM,
        selectedParentId,
        setSelectedParentId,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
};
