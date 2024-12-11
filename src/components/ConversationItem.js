import React from "react";
import { MODEL_INDICATORS } from "../constants";
import "./ConversationItem.css";

const ConversationItem = ({
  conversation,
  onSelect,
  onDoubleClick,
  isEditing,
  editText,
  onEditChange,
  onKeyDown,
}) => {
  // Determine which model indicator to show
  const getModelIndicator = (conversation) => {
    if (!conversation.llmId) return MODEL_INDICATORS.NONE;
    return MODEL_INDICATORS[conversation.llmId] || MODEL_INDICATORS.NONE;
  };

  return (
    <div
      className="conversation-item"
      onClick={() => onSelect(conversation.id)}
      onDoubleClick={() => onDoubleClick(conversation)}
    >
      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
      ) : (
        <div className="conversation-content">
          <span className="conversation-topic">{conversation.topic}</span>
          <span className="model-indicator">
            {getModelIndicator(conversation)}
          </span>
        </div>
      )}
    </div>
  );
};

export default ConversationItem;
