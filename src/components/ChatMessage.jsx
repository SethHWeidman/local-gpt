/**
 * ChatMessage.jsx
 *
 * Renders a single chat message. System messages are not displayed.
 * Uses ReactMarkdown to render message text with Markdown support.
 */
import ReactMarkdown from "react-markdown";
import "./ChatMessage.css";
import { ANTHROPIC_MODELS } from "../constants";

const ChatMessage = ({ message }) => {
  const { text, sender, llm_model } = message;

  // Determine if the assistant message is from an Anthropic model.
  const isAnthropic =
    sender === "assistant" && ANTHROPIC_MODELS.includes(llm_model);
  // Compute CSS classes based on sender and model type.
  const messageClass = `chat-message ${
    sender === "user" ? "user-message" : "assistant-message"
  }${isAnthropic ? " anthropic-message" : ""}`;

  // Do not render system messages.
  if (sender === "system") {
    return null;
  }

  return (
    <div className={messageClass}>
      {sender === "assistant" && llm_model && (
        <div className="model-badge">{llm_model}</div>
      )}
      <div className="message-content">
        <ReactMarkdown>{text || "..."}</ReactMarkdown>{" "}
      </div>
    </div>
  );
};

export default ChatMessage;
