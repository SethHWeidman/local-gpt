import ReactMarkdown from "react-markdown";
import "./ChatMessage.css"; // Create this CSS file for styling
import { ANTHROPIC_MODELS } from "../constants";

// Accepts a single message object: { text: string, sender: 'user' | 'assistant' | 'system' }
const ChatMessage = ({ message }) => {
  const { text, sender, llm_model } = message;

  const isAnthropic =
    sender === "assistant" && ANTHROPIC_MODELS.includes(llm_model);
  const messageClass = `chat-message ${
    sender === "user" ? "user-message" : "assistant-message"
  }${isAnthropic ? " anthropic-message" : ""}`;

  // Don't render empty messages (e.g., placeholder before stream starts)
  // Or render them differently if needed. Let's just skip empty ones for now.
  //if (!text && sender === 'assistant') {
  //    return null; // Or return a typing indicator?
  //}

  // You might not want to display system messages directly in the chat log
  if (sender === "system") {
    return null; // Or display them differently, e.g., in a dedicated info box
  }

  return (
    <div className={messageClass}>
      <div className="message-content">
        {/* Render message content using Markdown */}
        <ReactMarkdown>{text || "..."}</ReactMarkdown>{" "}
        {/* Show ellipsis if text is empty */}
      </div>
    </div>
  );
};

export default ChatMessage;
