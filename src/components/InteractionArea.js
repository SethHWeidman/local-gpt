import React from "react";
import LLMResponse from "./LLMResponse";
import { useConversation } from "../contexts/ConversationContext";

const InteractionArea = ({ onSubmit }) => {
  const { currentConversation, setCurrentConversation } = useConversation();
  const { userText, llmResponse } = currentConversation;

  const handleTextChange = (e) => {
    setCurrentConversation((prev) => ({
      ...prev,
      userText: e.target.value,
    }));
  };

  return (
    <div className="current-llm-interaction">
      <LLMResponse message={llmResponse} />
      <textarea
        className="user-input"
        value={userText || ""} // Add default empty string
        onChange={handleTextChange}
        placeholder="This is where you will type your query to the LLM"
      ></textarea>
      <button className="submit-button" onClick={onSubmit}>
        Submit
      </button>
    </div>
  );
};

export default InteractionArea;
