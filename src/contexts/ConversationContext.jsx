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

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.fetchConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};
export const useConversation = () => useContext(ConversationContext);
