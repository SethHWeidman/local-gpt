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
  // `setEditState` is a callback to update edit state - receives new edit state object
  // from parent
  setEditState,
  // `onEditComplete` is a callback to handle completion of conversation title editing -
  // receives conversation ID and new title from parent
  onEditComplete,
  // `onDeleteConversation` is a callback to handle conversation deletion - receives
  // conversation ID from parent
  onDeleteConversation,
  // `onSelectConversation` is a callback to handle conversation selection - receives
  // conversation ID from parent to load messages and manage state
  onSelectConversation,
  isDeleteMode,
  // Trigger starting a brand new conversation
  onNewConversation,
}) => {
  const { conversations } = useConversation();

  // Enter edit mode for a conversation title on double click.
  const handleDoubleClick = (conv) => {
    setEditState({ id: conv.id, text: conv.topic });
  };

  // Save edits when pressing Enter. Uses editState from props to get current edit data.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && editState) {
      onEditComplete(editState.id, editState.text);
    }
  };

  return (
    <div className="past-chats-panel">
      <div className="new-conversation-container">
        <button className="new-conversation-button" onClick={onNewConversation}>
          New Conversation
        </button>
      </div>
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
          // `onSelect Wraps the selection handler with the specific conversation ID
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
