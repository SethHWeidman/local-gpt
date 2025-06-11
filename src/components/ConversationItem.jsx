/**
 * ConversationItem.jsx
 *
 * Renders an item in the conversation list.
 * Supports editing, deletion, and displays a model indicator.
 */
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
  isDeleteMode,
  onDelete,
}) => {
  // Return the single-character indicator for the conversation's LLM.
  const getModelIndicator = (conversation) => {
    if (!conversation.llmId) return MODEL_INDICATORS.NONE;
    return MODEL_INDICATORS[conversation.llmId] || MODEL_INDICATORS.NONE;
  };

  return (
    <div
      className={`conversation-item ${isDeleteMode ? "delete-mode" : ""}`}
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
      {/* Show delete button when in delete mode. */}
      {isDeleteMode && (
        <button
          className="delete-button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
        >
          X
        </button>
      )}
    </div>
  );
};

export default ConversationItem;
