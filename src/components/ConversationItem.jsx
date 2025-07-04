/**
 * ConversationItem.jsx
 *
 * Renders an item in the conversation list.
 * Supports editing and deletion of conversations.
 */
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
