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
    tree: null,
    // activeMessageId: current leaf shown in UI (override or server),
    activeMessageId: null,
    // serverActiveMessageId: DB active_message_id for reset purposes
    serverActiveMessageId: null,
  });

  const [currentUserInput, setCurrentUserInput] = useState("");
  const [selectedLLM, setSelectedLLM] = useState(OPENAI_MODELS[0]);
  const [selectedParentMessageId, setSelectedParentMessageId] = useState(null);

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

  /**
   * Load messages (active path) and tree for a conversation.
   * @param conversationId ID of the conversation
   * @param overrideActiveMessageId optional override for active message navigation
   */
  const loadConversationMessages = useCallback(
    async (conversationId, overrideActiveMessageId = null) => {
      if (!conversationId) {
        setCurrentConversation({
          id: null,
          messages: [],
          systemMessage: "",
          tree: null,
          activeMessageId: null,
          serverActiveMessageId: null,
        });
        setCurrentUserInput("");
        setSelectedParentMessageId(null);
        return;
      }
      try {
        // Fetch both the active path and the full tree
        const [fetchedMessages, treeData] = await Promise.all([
          api.fetchMessages(conversationId, overrideActiveMessageId),
          api.fetchConversationTree(conversationId),
        ]);

        const systemMsg =
          fetchedMessages.find((msg) => msg.sender === "system")?.text || "";
        const displayMessages = fetchedMessages.filter(
          (msg) => msg.sender !== "system"
        );

        setCurrentConversation({
          id: conversationId,
          messages: displayMessages,
          systemMessage: systemMsg,
          tree: treeData.tree,
          // Use override if provided, else the server's active message
          activeMessageId:
            overrideActiveMessageId != null
              ? overrideActiveMessageId
              : treeData.active_message_id,
          serverActiveMessageId: treeData.active_message_id,
        });
        setCurrentUserInput("");
        setSelectedParentMessageId(null);
      } catch (error) {
        console.error(
          `Error fetching messages for conversation ${conversationId}:`,
          error
        );
        setCurrentConversation({
          id: null,
          messages: [],
          systemMessage: "",
          tree: null,
          activeMessageId: null,
          serverActiveMessageId: null,
        });
        setCurrentUserInput("");
        setSelectedParentMessageId(null);
      }
    },
    []
  );

  // Navigate to a different branch in the conversation tree (UI only)
  const switchToBranch = useCallback(
    (messageId) => {
      if (!currentConversation.id) return;
      loadConversationMessages(currentConversation.id, messageId);
    },
    [currentConversation.id, loadConversationMessages]
  );

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
        selectedParentMessageId,
        setSelectedParentMessageId,
        switchToBranch,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};
export const useConversation = () => useContext(ConversationContext);
