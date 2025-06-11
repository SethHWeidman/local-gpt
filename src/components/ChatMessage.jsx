import ReactMarkdown from "react-markdown";
import "./ChatMessage.css";
import { ANTHROPIC_MODELS } from "../constants";

const ChatMessage = ({ message }) => {
  const { text, sender, llm_model } = message;

  const isAnthropic =
    sender === "assistant" && ANTHROPIC_MODELS.includes(llm_model);
  const messageClass = `chat-message ${
    sender === "user" ? "user-message" : "assistant-message"
  }${isAnthropic ? " anthropic-message" : ""}`;

  if (sender === "system") {
    return null;
  }

  return (
    <div className={messageClass}>
      <div className="message-content">
        <ReactMarkdown>{text || "..."}</ReactMarkdown>{" "}
      </div>
    </div>
  );
};

export default ChatMessage;
