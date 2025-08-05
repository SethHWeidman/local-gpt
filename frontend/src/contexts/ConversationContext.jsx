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
import { useAuth } from "./AuthContext";

// Create a Context for conversation data and actions.
// Components that need conversation state or behavior can subscribe to this context.
const ConversationContext = createContext();

/**
 * ConversationProvider wraps your application (or part of it) and provides conversation
 * state and actions via React Context.
 * Wrap components that need access to conversation data with this provider.
 */
export const ConversationProvider = ({ children }) => {
  // List of all conversation summaries fetched from the backend.
  const [conversations, setConversations] = useState([]);
  // Details of the currently selected conversation, including messages and any system
  // prompt.
  const [currentConversation, setCurrentConversation] = useState({
    id: null,
    messages: [],
    systemMessage: "",
  });

  // The draft text for the user's next message.
  const [currentUserInput, setCurrentUserInput] = useState("");
  // The chosen language model (e.g., OpenAI model identifier). Defaults to none so
  // users must explicitly select a model.
  const [selectedLLM, setSelectedLLM] = useState("");
  // Optional parent message ID if replying to a specific message.
  const [selectedParentId, setSelectedParentId] = useState(null);

  // Fetch the list of conversations from the backend API.
  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.fetchConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  }, []);

  const { isAuthenticated } = useAuth();

  // Fetch conversation list on login; clear state on logout.
  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    } else {
      setConversations([]);
      setCurrentConversation({ id: null, messages: [], systemMessage: "" });
      setCurrentUserInput("");
      setSelectedParentId(null);
    }
  }, [isAuthenticated, fetchConversations]);

  /**
   * Load messages for a given conversation ID.
   * If no ID is provided, reset to an empty conversation state.
   */
  const loadConversationMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setCurrentConversation({ id: null, messages: [], systemMessage: "" });
      setCurrentUserInput("");
      return;
    }
    try {
      const fetchedMessages = await api.fetchMessages(conversationId);
      // Extract system message (e.g., prompt or instructions).
      const systemMsg =
        fetchedMessages.find((msg) => msg.sender === "system")?.text || "";
      // Only show user and assistant [non-system] messages in the UI.
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

/**
 * Custom hook to access the ConversationContext.
 * Throws an error if used outside of a ConversationProvider.
 */
export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      "useConversation must be used within a ConversationProvider"
    );
  }
  return context;
};
