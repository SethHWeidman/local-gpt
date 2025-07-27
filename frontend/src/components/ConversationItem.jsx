/**
 * ConversationItem.jsx
 *
 * Renders an item in the conversation list.
 * Supports editing and deletion of conversations.
 */
import "./ConversationItem.css";

const ConversationItem = ({
  conversation,
  // `onSelect` is a callback to handle conversation selection - receives conversation
  // ID from parent
  onSelect,
  // `onDoubleClick` is a callback to handle double-click for editing - receives
  // conversation object from parent
  onDoubleClick,
  isEditing,
  editText,
  // `onEditChange` is a callback to handle edit text changes - receives new text value
  // from parent
  onEditChange,
  // `onKeyDown` is a callback to handle keyboard events during editing - receives event
  // from parent
  onKeyDown,
  isDeleteMode,
  // `onDelete` is a callback to handle conversation deletion - receives conversation ID
  // from parent
  onDelete,
}) => {
  return (
    <div
      className={`conversation-item ${isDeleteMode ? "delete-mode" : ""}`}
      onClick={() => onSelect(conversation.id)} // Triggers conversation selection
      onDoubleClick={() => onDoubleClick(conversation)} // Triggers edit mode
    >
      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus // Automatically focus the input when entering edit mode
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
