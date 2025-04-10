import React from "react";
// Rename LLMResponse to ChatMessage for clarity
import ChatMessage from "./ChatMessage"; // Assuming you rename LLMResponse.js
import { useConversation } from "../contexts/ConversationContext";
import "./InteractionArea.css";

// Accept messagesEndRef prop for scrolling
const InteractionArea = ({ onSubmit, messagesEndRef }) => {
  // Get messages array and current input state from context
  const { currentConversation, currentUserInput, setCurrentUserInput } =
    useConversation();
  const { messages } = currentConversation;

  // Handle changes in the text area
  const handleTextChange = (e) => {
    setCurrentUserInput(e.target.value);
  };

  // Handle Enter key press for submission (optional UX improvement)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Submit on Enter, allow Shift+Enter for newline
      e.preventDefault(); // Prevent default newline behavior
      onSubmit();
    }
  };

  return (
    <div className="interaction-area">
      {/* Renamed class for clarity */}
      <div className="message-list">
        {messages && messages.length > 0 ? (
          messages.map((msg, index) => (
            // Use a unique key, message id from DB would be best if available, otherwise index+sender
            <ChatMessage
              key={`${currentConversation.id}-${index}-${msg.sender}`}
              message={msg}
            />
          ))
        ) : (
          <div className="empty-chat-message">
            Select a conversation or start a new one.
          </div>
        )}
        {/* Add a div at the end to scroll to */}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        {" "}
        {/* Wrapper for input + button */}
        <textarea
          className="user-input"
          value={currentUserInput} // Bind to currentUserInput from context
          onChange={handleTextChange}
          onKeyDown={handleKeyDown} // Add keydown listener
          placeholder="Type your message here..." // Updated placeholder
        ></textarea>
        <button
          className="submit-button"
          onClick={onSubmit}
          disabled={!currentUserInput.trim()} // Disable if input is empty
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default InteractionArea;
