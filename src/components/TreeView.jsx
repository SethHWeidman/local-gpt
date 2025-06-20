/**
 * TreeView.jsx
 *
 * Component for displaying and interacting with the conversation tree structure.
 * Shows branching conversations and allows switching between branches.
 */
import { useState } from "react";
import { useConversation } from "../contexts/ConversationContext";
import "./TreeView.css";

const TreeMessage = ({
  message,
  isActive,
  isSelected,
  onSelect,
  onBranch,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleClick = () => {
    onSelect(message.id);
  };

  const handleBranchClick = (e) => {
    e.stopPropagation();
    onBranch(message.id);
  };

  const messagePreview =
    message.text.length > 50
      ? message.text.substring(0, 50) + "..."
      : message.text;

  return (
    <div
      className={`tree-message ${isActive ? "active" : ""} ${
        isSelected ? "selected" : ""
      }`}
    >
      <div className="tree-message-content" onClick={handleClick}>
        <div className="tree-message-header">
          <span className={`tree-message-sender ${message.sender}`}>
            {message.sender}
          </span>
          {children && children.length > 0 && (
            <button
              className="tree-expand-button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? "−" : "+"}
            </button>
          )}
        </div>
        <div className="tree-message-text">{messagePreview}</div>
        <div className="tree-message-actions">
          <button
            className="tree-branch-button"
            onClick={handleBranchClick}
            title="Create branch from this message"
          >
            🌿
          </button>
        </div>
      </div>

      {children && children.length > 0 && isExpanded && (
        <div className="tree-message-children">
          {children.map((child, index) => (
            <TreeMessage
              key={child.id}
              message={child}
              isActive={isActive}
              isSelected={isSelected}
              onSelect={onSelect}
              onBranch={onBranch}
              children={child.children}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeView = () => {
  const {
    currentConversation,
    switchToBranch,
    setSelectedParentMessageId,
    selectedParentMessageId,
  } = useConversation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!currentConversation.tree || currentConversation.tree.length === 0) {
    return (
      <div className="tree-view">
        <div className="tree-view-header">
          <h3>Conversation Tree</h3>
          <div className="tree-view-header-buttons">
            <button
              className="tree-collapse-button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              title={isCollapsed ? "Expand tree view" : "Collapse tree view"}
            >
              {isCollapsed ? "▶" : "▼"}
            </button>
          </div>
        </div>
        {!isCollapsed && (
          <div className="tree-view-empty">No conversation tree available</div>
        )}
      </div>
    );
  }

  const handleMessageSelect = async (messageId) => {
    await switchToBranch(messageId);
  };

  const handleBranchSelect = (messageId) => {
    setSelectedParentMessageId(messageId);
  };

  // Helper function to check if a message is in the active path
  const isInActivePath = (messageId) => {
    // This would need to be implemented based on the active path
    // For now, we'll use a simple check
    return currentConversation.messages.some((msg) => msg.id === messageId);
  };

  return (
    <div className="tree-view">
      <div className="tree-view-header">
        <h3>Conversation Tree</h3>
        <div className="tree-view-header-buttons">
          <button
            className="tree-collapse-button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? "Expand tree view" : "Collapse tree view"}
          >
            {isCollapsed ? "▶" : "▼"}
          </button>
          {currentConversation.serverActiveMessageId && (
            <button
              className="reset-branch-button"
              onClick={() =>
                handleMessageSelect(currentConversation.serverActiveMessageId)
              }
              title="Reset to latest branch"
            >
              ↺ Latest
            </button>
          )}
          {selectedParentMessageId && (
            <div className="selected-parent-info">
              Branching from message #{selectedParentMessageId}
              <button
                onClick={() => setSelectedParentMessageId(null)}
                className="clear-selection-button"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
      {!isCollapsed && (
        <div className="tree-view-content">
          {currentConversation.tree.map((rootMessage) => (
            <TreeMessage
              key={rootMessage.id}
              message={rootMessage}
              isActive={isInActivePath(rootMessage.id)}
              isSelected={selectedParentMessageId === rootMessage.id}
              onSelect={handleMessageSelect}
              onBranch={handleBranchSelect}
              children={rootMessage.children}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeView;
