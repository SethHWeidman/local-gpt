/**
 * ConversationPanel.jsx
 *
 * Displays a list of past conversations and enables editing of titles.
 */
import ConversationItem from "./ConversationItem";
import { useConversation } from "../contexts/ConversationContext";
import "./ConversationPanel.css";

const ConversationPanel = ({
  editState,
  setEditState,
  onEditComplete,
  onDeleteConversation,
  onSelectConversation,
  isDeleteMode,
}) => {
  const { conversations } = useConversation();

  // Enter edit mode for a conversation title on double click.
  const handleDoubleClick = (conv) => {
    setEditState({ id: conv.id, text: conv.topic });
  };

  // Save edits when pressing Enter.
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onEditComplete(editState.id, editState.text);
    }
  };

  return (
    <div className="past-chats-panel">
      <div className="panel-header">
        <div className="past-chats-label">
          {isDeleteMode ? "Delete Conversations" : "Past Conversations"}
        </div>
      </div>
      {/* Render each conversation as a list item. */}
      {conversations?.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          onSelect={() => onSelectConversation(conv.id)}
          onDoubleClick={handleDoubleClick}
          isEditing={editState.id === conv.id}
          editText={editState.text}
          onEditChange={(text) => setEditState({ ...editState, text })}
          onKeyDown={handleKeyDown}
          isDeleteMode={isDeleteMode}
          onDelete={onDeleteConversation}
        />
      ))}
    </div>
  );
};

export default ConversationPanel;
