/**
 * ChatMessage.jsx
 *
 * Renders a single chat message. System messages are not displayed.
 * Uses ReactMarkdown to render message text with Markdown support.
 */
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import "./ChatMessage.css";
import { ANTHROPIC_MODELS } from "../constants";

const ChatMessage = ({
  message,
  hasChildren = false,
  collapsedChildren = false,
  onToggleChildren = () => {},
  collapsed,
  onToggleCollapse = () => {},
}) => {
  const { text = "", sender, llm_model } = message;
  const lines = text.split(/\r?\n/);
  // Maximum number of lines to display before collapse toggle appears
  const COLLAPSE_THRESHOLD = 4;

  // CSS style for WebKit line clamping - truncates text to N lines
  const LINE_CLAMP_STYLE = {
    display: "-webkit-box", // Required for WebKit line clamp
    WebkitLineClamp: COLLAPSE_THRESHOLD, // Number of lines to show
    WebkitBoxOrient: "vertical", // Stack lines vertically
    overflow: "hidden", // Hide overflow text
  };

  // Determine if message content exceeds threshold when rendered (overflow)
  const contentRef = useRef(null);
  const [showToggle, setShowToggle] = useState(false);

  // Determine if the assistant message is from an Anthropic model.
  const isAnthropic =
    sender === "assistant" && ANTHROPIC_MODELS.includes(llm_model);
  // Compute CSS classes based on sender and model type.
  const messageClass = `chat-message ${
    sender === "user"
      ? "user-message"
      : `assistant-message${isAnthropic ? " anthropic-message" : " openai-message"}`
  }`;

  // Do not render system messages.
  if (sender === "system") {
    return null;
  }

  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggleCollapse();
  };
  const handleChildrenToggle = (e) => {
    e.stopPropagation();
    onToggleChildren();
  };

  // Determine if collapse toggle should be shown based on content height or line count
  useEffect(() => {
    let shouldShow = false;

    // Check if rendered content overflows its container (height-based detection)
    if (contentRef.current) {
      const { scrollHeight, clientHeight } = contentRef.current;
      if (scrollHeight > clientHeight) {
        shouldShow = true;
      }
    }

    // Also show toggle if text has more lines than threshold (line-based detection)
    if (lines.length > COLLAPSE_THRESHOLD) {
      shouldShow = true;
    }

    setShowToggle(shouldShow);
    // Dependencies: [text] - when text changes, we need to re-evaluate if toggle should
    // show
  }, [text]);
  return (
    <div className={messageClass}>
      {sender === "assistant" && llm_model && (
        <div className="model-badge">{llm_model}</div>
      )}
      <div
        className="message-content"
        ref={contentRef}
        style={collapsed ? LINE_CLAMP_STYLE : undefined}
      >
        <ReactMarkdown>{text || "..."}</ReactMarkdown>
      </div>
      {showToggle && (
        <div className="collapse-icon" onClick={handleToggleClick}>
          {collapsed ? "↓" : "↑"}
        </div>
      )}
      {hasChildren && (
        <div className="children-toggle-icon" onClick={handleChildrenToggle}>
          {collapsedChildren ? "+" : "-"}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
