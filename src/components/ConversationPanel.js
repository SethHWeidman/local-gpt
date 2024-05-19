import React from "react";
import "./ConversationPanel.css";

const ConversationPanel = ({
  conversations,
  handleSelectConversation,
  handleDoubleClick,
  editId,
  editText,
  setEditText,
  handleNameChange,
}) => {
  return (
    <div className="past-chats-panel">
      <div className="past-chats-label">Past conversations:</div>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => handleSelectConversation(conv.id)}
          onDoubleClick={() => handleDoubleClick(conv)}
        >
          {editId === conv.id ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleNameChange}
              autoFocus
            />
          ) : (
            conv.topic
          )}
        </div>
      ))}
    </div>
  );
};

export default ConversationPanel;
