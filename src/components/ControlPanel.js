import React from "react";
import { useConversation } from "../contexts/ConversationContext";

const ControlPanel = () => {
  const { currentConversation, setCurrentConversation } = useConversation();

  const handleSystemMessageChange = (event) => {
    setCurrentConversation((prev) => ({
      ...prev,
      systemMessage: event.target.value,
    }));
  };

  return (
    <div className="control-panel">
      Type your "system message" to the LLM below. For context, the default
      system message for ChatGPT is "You are a helpful assistant."
      <br />
      <br />
      <textarea
        className="system-prompt"
        onChange={handleSystemMessageChange}
        value={currentConversation.systemMessage || ""} // Add default empty string
      ></textarea>
    </div>
  );
};

export default ControlPanel;
