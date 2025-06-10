import { useState } from "react";
import ConversationItem from "./ConversationItem";
import { useConversation } from "../contexts/ConversationContext";
import "./ConversationPanel.css";

const ConversationPanel = ({
  editState,
  setEditState,
  onEditComplete,
  onDeleteConversation,
  onSelectConversation,
}) => {
  const { conversations } = useConversation();
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const handleDoubleClick = (conv) => {
    setEditState({ id: conv.id, text: conv.topic });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onEditComplete(editState.id, editState.text);
    }
  };

  const toggleDeleteMode = () => {
    setIsDeleteMode((prev) => !prev);
    setEditState({ id: null, text: "" }); // Exit edit mode when toggling
  };

  return (
    <div className="past-chats-panel">
      <div className="panel-header">
        <div className="past-chats-label">
          {isDeleteMode ? "Delete Conversations" : "Past Conversations"}
        </div>
        <label className="delete-toggle">
          <input
            type="checkbox"
            checked={isDeleteMode}
            onChange={toggleDeleteMode}
          />
          <span>{isDeleteMode ? "Off" : "On"}</span>
        </label>
      </div>
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
