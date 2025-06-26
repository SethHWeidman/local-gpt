/**
 * InteractionArea.jsx
 *
 * Renders the message list, model selector, and input box for user interactions.
 */
import ChatMessage from "./ChatMessage";
import { useConversation } from "../contexts/ConversationContext";
import { OPENAI_MODELS, ANTHROPIC_MODELS } from "../constants";
import "./InteractionArea.css";

const InteractionArea = ({ onSubmit, messagesEndRef }) => {
  const {
    currentConversation,
    currentUserInput,
    setCurrentUserInput,
    selectedLLM,
    setSelectedLLM,
  } = useConversation();
  const { messages } = currentConversation;

  const handleTextChange = (e) => {
    setCurrentUserInput(e.target.value);
  };

  // Submit on Enter when Shift is not held.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleLLMChange = (e) => {
    setSelectedLLM(e.target.value);
  };

  return (
    <div className="current-llm-interaction">
      <div className="message-list">
        {/* Display messages or placeholder when no conversation is selected. */}
        {messages && messages.length > 0 ? (
          messages.map((msg, index) => (
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
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        {" "}
        <textarea
          className="user-input"
          value={currentUserInput}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
        ></textarea>
        <div className="controls-container">
          {" "}
          {/* Allow selecting the language model for the conversation. */}
          <select
            className="llm-selector"
            value={selectedLLM}
            onChange={handleLLMChange}
          >
            <optgroup label="OpenAI">
              {OPENAI_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </optgroup>
            <optgroup label="Anthropic">
              {ANTHROPIC_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </optgroup>
          </select>
          {/* Send the current message to the backend. */}
          <button
            className="submit-button"
            onClick={onSubmit}
            disabled={!currentUserInput.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteractionArea;
