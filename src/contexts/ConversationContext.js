import React, { createContext, useState, useContext, useEffect } from "react"; // Added useEffect here
import api from "../api";

const ConversationContext = createContext();

export const ConversationProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState({
    systemMessage: "",
    userText: "",
    llmResponse: "",
  });

  const fetchConversations = async () => {
    try {
      const data = await api.fetchConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        setConversations,
        currentConversation,
        setCurrentConversation,
        fetchConversations,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = () => useContext(ConversationContext);
