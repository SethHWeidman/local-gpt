import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import api from "../api";

const ConversationContext = createContext();

export const ConversationProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState({
    id: null, // The ID of the currently active conversation
    messages: [], // Array of { text: string, sender: string }
    systemMessage: "", // Keep track of the system message for this convo (optional, could be fetched)
  });

  const [currentUserInput, setCurrentUserInput] = useState("");
  const [selectedLLM, setSelectedLLM] = useState("chatgpt"); // Default to ChatGPT

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.fetchConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  }, []); // Add useCallback to stabilize function reference

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]); // Use fetchConversations in dependency array

  const loadConversationMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setCurrentConversation({ id: null, messages: [], systemMessage: "" });
      setCurrentUserInput(""); // Clear input when deselecting/selecting null
      return;
    }
    try {
      const fetchedMessages = await api.fetchMessages(conversationId);
      // Find the system message if it exists
      const systemMsg =
        fetchedMessages.find((msg) => msg.sender === "system")?.text || "";
      // Filter out the system message from the main display list if desired,
      // or keep it if you want to show it explicitly in the chat log.
      // Let's filter it out for now from the main `messages` array for display.
      const displayMessages = fetchedMessages.filter(
        (msg) => msg.sender !== "system"
      );

      setCurrentConversation({
        id: conversationId,
        messages: displayMessages, // Only user and assistant messages for display
        systemMessage: systemMsg, // Store system message separately
      });
      setCurrentUserInput(""); // Clear input when selecting a conversation
    } catch (error) {
      console.error(
        `Error fetching messages for conversation ${conversationId}:`,
        error
      );
      // Handle error state, maybe clear the conversation view
      setCurrentConversation({ id: null, messages: [], systemMessage: "" });
      setCurrentUserInput("");
    }
  }, []); // Add useCallback

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        setConversations, // Keep if needed externally, e.g., after delete/rename
        currentConversation,
        setCurrentConversation, // You'll use this to update messages during streaming
        currentUserInput,
        setCurrentUserInput, // To update the text area
        fetchConversations,
        loadConversationMessages, // Expose the function to load messages
        selectedLLM, // Expose selectedLLM
        setSelectedLLM, // Expose setSelectedLLM
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};
export const useConversation = () => useContext(ConversationContext);
