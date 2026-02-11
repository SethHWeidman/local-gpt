/**
 * InteractionArea.jsx
 *
 * Renders the message list, model selector, and input box for user interactions.
 */
import { useEffect, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import { useConversation } from "../contexts/ConversationContext";
import { OPENAI_MODELS, ANTHROPIC_MODELS } from "../constants";
import { useAuth } from "../contexts/AuthContext";
import "./InteractionArea.css";

const InteractionArea = ({
  onSubmit,
  messagesEndRef,
  isAuthenticated,
  onRequireAuth,
}) => {
  const {
    currentConversation,
    currentUserInput,
    setCurrentUserInput,
    selectedLLM,
    setSelectedLLM,
    selectedParentId,
    setSelectedParentId,
  } = useConversation();
  const { user } = useAuth();
  const { messages } = currentConversation;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [menuDirection, setMenuDirection] = useState("down");
  const [menuMaxHeight, setMenuMaxHeight] = useState(260);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  // collapsedNodes: a set of message IDs whose child branches are currently collapsed
  // (hidden)
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  // collapsedMessages: map of message IDs to boolean flags indicating whether each
  // message's own text content is collapsed (true=show truncated text)
  const [collapsedMessages, setCollapsedMessages] = useState(() => new Map());

  // Collapse all messages' text content in the current conversation.
  const handleCollapseAll = () => {
    const next = new Map();
    messages.forEach((m) => {
      if (m && m.id != null) {
        next.set(m.id, true);
      }
    });
    setCollapsedMessages(next);
  };

  /**
   * Build lookup maps for efficient tree traversal:
   * - messageByIdMap: maps each message ID to its message object.
   * - childrenByParentIdMap: groups messages by their parent_message_id.
   */
  const messageByIdMap = new Map(
    messages.map((message) => [message.id, message]),
  );
  const childrenByParentIdMap = new Map();
  messages.forEach((message) => {
    const parentId = message.parent_message_id;
    if (!childrenByParentIdMap.has(parentId)) {
      childrenByParentIdMap.set(parentId, []);
    }
    childrenByParentIdMap.get(parentId).push(message);
  });

  // Compute ancestor path IDs (from selected node up to the root message)
  const ancestorIds = new Set();
  {
    let currentId = selectedParentId;
    while (currentId != null && messageByIdMap.has(currentId)) {
      ancestorIds.add(currentId);
      currentId = messageByIdMap.get(currentId).parent_message_id;
    }
  }

  const INDENT_PER_LEVEL = 20;
  const renderNodes = (parentId = null, indent = 0, visited = new Set()) => {
    const nodes = [];
    (childrenByParentIdMap.get(parentId) || []).forEach((msg) => {
      const nextIndent =
        msg.sender === "assistant" ? indent + INDENT_PER_LEVEL : indent;
      const isSelected = msg.id === selectedParentId;
      const isAncestor = ancestorIds.has(msg.id);
      const hasChildren = (childrenByParentIdMap.get(msg.id) || []).length > 0;
      const isCollapsed = collapsedNodes.has(msg.id);
      // Default mnessages start uncollapsed; preserve any user-toggle overrides
      const initialCollapsed = false;
      // isTextCollapsed: whether this message's text content is collapsed (truncated)
      // or fully shown. Falls back to default if user has not toggled.
      const isTextCollapsed = collapsedMessages.has(msg.id)
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
          {/* ChatMessage props:
             - onToggleChildren: toggles collapse/expand of this message's child 
               branches;
             - collapsed: whether to render truncated vs full message text.
          */}
          <ChatMessage
            message={msg}
            hasChildren={hasChildren}
            collapsedChildren={isCollapsed}
            // onToggleChildren: toggle visibility of this message's child branch nodes
            onToggleChildren={() => {
              setCollapsedNodes((prev) => {
                const next = new Set(prev);
                if (next.has(msg.id)) next.delete(msg.id);
                else next.add(msg.id);
                return next;
              });
            }}
            collapsed={isTextCollapsed}
            // Update collapsedMessages map to toggle this message's text collapse
            // state, affecting whether ChatMessage renders shortened or full content.
            onToggleCollapse={() => {
              setCollapsedMessages((prev) => {
                // Copy previous collapse states and flip this message's collapse flag.
                const next = new Map(prev);
                next.set(msg.id, !isTextCollapsed);
                return next;
              });
            }}
          />
        </div>,
      );
      // If this node is expanded and not yet visited, recurse to render its children
      if (!isCollapsed && msg.id != null && !visited.has(msg.id)) {
        const nextVisited = new Set(visited);
        nextVisited.add(msg.id);
        nodes.push(...renderNodes(msg.id, nextIndent, nextVisited));
      }
    });
    return nodes;
  };

  const handleTextChange = (e) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setCurrentUserInput(e.target.value);
  };

  // Submit on Enter when Shift is not held.
  const handleKeyDown = (e) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const preferUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const available = preferUp ? spaceAbove : spaceBelow;
    const nextMaxHeight = Math.max(160, Math.min(320, available));
    setMenuDirection(preferUp ? "up" : "down");
    setMenuMaxHeight(nextMaxHeight);
  }, [isDropdownOpen]);

  return (
    <div className="current-llm-interaction">
      <div className="message-list">
        <div className="message-list-controls">
          <button
            className="collapse-all-button"
            onClick={handleCollapseAll}
            disabled={!messages || messages.length === 0}
            title="Collapse all messages"
          >
            Collapse all
          </button>
        </div>
        {/* Display messages or placeholder when no conversation is selected. */}
        {messages && messages.length > 0 ? (
          renderNodes()
        ) : (
          <div className="empty-chat-message">
            Select a conversation or start a new one.
          </div>
        )}
        {/**
         * An empty anchor div used as the scroll target for automatically
         * scrolling the chat message list to the bottom when new messages
         * are added. The parent component holds messagesEndRef pointing here
         * and calls messagesEndRef.current.scrollIntoView().
         */}
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
          <div className="llm-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`llm-selector llm-trigger${
                isDropdownOpen ? " open" : ""
              }`}
              ref={triggerRef}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
            >
              <span
                className={
                  selectedLLM ? "llm-trigger-label" : "llm-trigger-placeholder"
                }
              >
                {selectedLLM || "Select a model..."}
              </span>
              <span className="llm-trigger-icon" aria-hidden="true">
                ▾
              </span>
            </button>
            {isDropdownOpen && (
              <div
                className={`llm-menu${menuDirection === "up" ? " open-up" : ""}`}
                role="listbox"
                style={{ maxHeight: `${menuMaxHeight}px` }}
              >
                <div className="llm-group" role="group" aria-label="OpenAI">
                  <div className="llm-group-label">
                    OpenAI{user?.openai_api_key ? "" : " (API key missing)"}
                  </div>
                  {OPENAI_MODELS.map((model) => {
                    const isDisabled = !user?.openai_api_key;
                    const isSelected = selectedLLM === model;
                    return (
                      <button
                        type="button"
                        key={model}
                        className={`llm-option${isSelected ? " selected" : ""}`}
                        onClick={() => {
                          if (isDisabled) return;
                          setSelectedLLM(model);
                          setIsDropdownOpen(false);
                        }}
                        disabled={isDisabled}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {model}
                      </button>
                    );
                  })}
                </div>
                <div className="llm-group" role="group" aria-label="Anthropic">
                  <div className="llm-group-label">
                    Anthropic
                    {user?.anthropic_api_key ? "" : " (API key missing)"}
                  </div>
                  {ANTHROPIC_MODELS.map((model) => {
                    const isDisabled = !user?.anthropic_api_key;
                    const isSelected = selectedLLM === model;
                    return (
                      <button
                        type="button"
                        key={model}
                        className={`llm-option${isSelected ? " selected" : ""}`}
                        onClick={() => {
                          if (isDisabled) return;
                          setSelectedLLM(model);
                          setIsDropdownOpen(false);
                        }}
                        disabled={isDisabled}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {model}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Send the current message to the backend. */}
          <button
            className="submit-button"
            onClick={onSubmit}
            disabled={!currentUserInput.trim() || !selectedLLM}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteractionArea;
