import React from "react";
import ConversationItem from "./ConversationItem";
import { useConversation } from "../contexts/ConversationContext";
import "./ConversationPanel.css";

const ConversationPanel = ({
  editState,
  setEditState,
  onEditComplete,
  onSelectConversation,
}) => {
  const { conversations } = useConversation();

  const handleDoubleClick = (conv) => {
    setEditState({ id: conv.id, text: conv.topic });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onEditComplete(editState.id, editState.text);
    }
  };

  return (
    <div className="past-chats-panel">
      <div className="past-chats-label">Past conversations:</div>
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
        />
      ))}
    </div>
  );
};

export default ConversationPanel;
