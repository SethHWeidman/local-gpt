/**
 * ChatMessage.jsx
 *
 * Renders a single chat message. System messages are not displayed.
 * Uses ReactMarkdown to render message text with Markdown support.
 */
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import "./ChatMessage.css";
import { ANTHROPIC_MODELS } from "../constants";

const ChatMessage = ({ message }) => {
  const { text = "", sender, llm_model } = message;
  const lines = text.split(/\r?\n/);
  // Only collapse assistant messages longer than threshold lines
  const COLLAPSE_THRESHOLD = 4;
  const [collapsed, setCollapsed] = useState(false);
  // Determine if message content exceeds threshold when rendered (overflow)
  const contentRef = useRef(null);
  const [showToggle, setShowToggle] = useState(false);

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

  const handleToggleClick = (e) => {
    e.stopPropagation();
    setCollapsed((prev) => !prev);
  };
  const displayText = collapsed
    ? lines.slice(0, COLLAPSE_THRESHOLD).join("\n")
    : text;
  useEffect(() => {
    if (contentRef.current) {
      const style = getComputedStyle(contentRef.current);
      const lineHeight = parseFloat(style.lineHeight);
      if (contentRef.current.scrollHeight > lineHeight * COLLAPSE_THRESHOLD + 1) {
        setShowToggle(true);
      }
    }
  }, [text]);
  return (
    <div className={messageClass}>
      {sender === "assistant" && llm_model && (
        <div className="model-badge">{llm_model}</div>
      )}
      <div
        className="message-content"
        ref={contentRef}
        style={
          collapsed
            ? {
                display: "-webkit-box",
                WebkitLineClamp: COLLAPSE_THRESHOLD,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        <ReactMarkdown>{displayText || "..."}</ReactMarkdown>
      </div>
      {showToggle && (
        <div className="collapse-icon" onClick={handleToggleClick}>
          {collapsed ? "↓" : "↑"}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
