/**
 * InteractionArea.jsx
 *
 * Renders the message list and input box for user interactions.
 */
import { useState } from "react";
import ChatMessage from "./ChatMessage";
import { useConversation } from "../contexts/ConversationContext";
import "./InteractionArea.css";

const InteractionArea = ({ onSubmit, messagesEndRef }) => {
  const {
    currentConversation,
    currentUserInput,
    setCurrentUserInput,
    selectedParentId,
    setSelectedParentId,
  } = useConversation();
  const { messages } = currentConversation;
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  // Track per-message text collapse state to preserve across branch hide/show
  const [collapsedMessages, setCollapsedMessages] = useState(() => new Map());

  // Build message tree structure by parent_message_id
  const messagesById = new Map(messages.map((m) => [m.id, m]));
  const childrenMap = new Map();
  messages.forEach((m) => {
    const pid = m.parent_message_id;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(m);
  });

  // Compute ancestor path IDs (from selected node up to root)
  const ancestorIds = new Set();
  {
    let curr = selectedParentId;
    while (curr != null && messagesById.has(curr)) {
      ancestorIds.add(curr);
      curr = messagesById.get(curr).parent_message_id;
    }
  }

  // Compute descendant IDs (all nodes under the selected node)
  const descendantIds = new Set();
  if (selectedParentId != null) {
    const stack = [selectedParentId];
    while (stack.length > 0) {
      const id = stack.pop();
      (childrenMap.get(id) || []).forEach((child) => {
        if (child.id != null && !descendantIds.has(child.id)) {
          descendantIds.add(child.id);
          stack.push(child.id);
        }
      });
    }
  }
  const INDENT_PER_LEVEL = 20;
  const renderNodes = (parentId = null, indent = 0, visited = new Set()) => {
    const nodes = [];
    (childrenMap.get(parentId) || []).forEach((msg) => {
      const nextIndent =
        msg.sender === "assistant" ? indent + INDENT_PER_LEVEL : indent;
      const isSelected = msg.id === selectedParentId;
      const isAncestor = ancestorIds.has(msg.id);
      const hasChildren = (childrenMap.get(msg.id) || []).length > 0;
      const isCollapsed = collapsedNodes.has(msg.id);
      // Default messages start uncollapsed; preserve any user-toggle overrides
      const initialCollapsed = false;
      const collapsedText = collapsedMessages.has(msg.id)
        ? collapsedMessages.get(msg.id)
        : initialCollapsed;
      nodes.push(
        <div
          key={msg.key || msg.id}
          className={`message-node ${isSelected ? "selected-node" : ""} ${
            isAncestor ? "ancestor-node" : ""
          }`}
          style={{ "--indent": `${indent}px` }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedParentId(msg.id);
          }}
        >
          <ChatMessage
            message={msg}
            hasChildren={hasChildren}
            collapsedChildren={isCollapsed}
            onToggleChildren={() => {
              setCollapsedNodes((prev) => {
                const next = new Set(prev);
                if (next.has(msg.id)) next.delete(msg.id);
                else next.add(msg.id);
                return next;
              });
            }}
            collapsed={collapsedText}
            onToggleCollapse={() => {
              setCollapsedMessages((prev) => {
                const next = new Map(prev);
                next.set(msg.id, !collapsedText);
                return next;
              });
            }}
          />
        </div>
      );
      if (!isCollapsed && msg.id != null && !visited.has(msg.id)) {
        const nextVisited = new Set(visited);
        nextVisited.add(msg.id);
        nodes.push(...renderNodes(msg.id, nextIndent, nextVisited));
      }
    });
    return nodes;
  };

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

  return (
    <div className="current-llm-interaction">
      <div className="message-list">
        {/* Display messages or placeholder when no conversation is selected. */}
        {messages && messages.length > 0 ? (
          renderNodes()
        ) : (
          <div className="empty-chat-message">
            Select a conversation or start a new one.
          </div>
        )}
        {/* Anchor div for auto-scrolling to the latest message via messagesEndRef */}
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
