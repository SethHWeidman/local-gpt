/**
 * ChatMessage.jsx
 *
 * Renders a single chat message. System messages are not displayed.
 * Uses ReactMarkdown to render message text with Markdown support.
 */
import ReactMarkdown from "react-markdown";
import "./ChatMessage.css";
import { ANTHROPIC_MODELS } from "../constants";
import { useConversation } from "../contexts/ConversationContext";

const ChatMessage = ({ message, showBranchButton = false }) => {
  const { text, sender, llm_model, id } = message;
  const { setSelectedParentMessageId, selectedParentMessageId } =
    useConversation();

  // Determine if the assistant message is from an Anthropic model.
  const isAnthropic =
    sender === "assistant" && ANTHROPIC_MODELS.includes(llm_model);

  // Check if this message is selected as parent for branching
  const isSelectedParent = selectedParentMessageId === id;

  // Compute CSS classes based on sender and model type.
  const messageClass = `chat-message ${
    sender === "user" ? "user-message" : "assistant-message"
  }${isAnthropic ? " anthropic-message" : ""}${
    isSelectedParent ? " selected-parent" : ""
  }`;

  // Do not render system messages.
  if (sender === "system") {
    return null;
  }

  const handleBranchClick = () => {
    setSelectedParentMessageId(id);
  };

  return (
    <div className={messageClass}>
      {sender === "assistant" && llm_model && (
        <div className="model-badge">{llm_model}</div>
      )}
      <div className="message-content">
        <ReactMarkdown>{text || "..."}</ReactMarkdown>
      </div>
      {showBranchButton && (
        <div className="message-actions">
          <button
            className="branch-button"
            onClick={handleBranchClick}
            title="Create branch from this message"
          >
            🌿 Branch
          </button>
        </div>
      )}
      {isSelectedParent && (
        <div className="selected-parent-indicator">Selected for branching</div>
      )}
    </div>
  );
};

export default ChatMessage;
