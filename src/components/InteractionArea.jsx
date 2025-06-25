/**
 * InteractionArea.jsx
 *
 * Renders the message list, model selector, and input box for user interactions.
 */
import ChatMessage from "./ChatMessage";
import { useConversation } from "../contexts/ConversationContext";
import { OPENAI_MODELS, ANTHROPIC_MODELS } from "../constants";
import "./InteractionArea.css";

const InteractionArea = ({ onSubmit, messagesEndRef }) => {
  const {
    currentConversation,
    currentUserInput,
    setCurrentUserInput,
    selectedLLM,
    setSelectedLLM,
    selectedParentId,
    setSelectedParentId,
  } = useConversation();
  const { messages } = currentConversation;
  // Build message tree structure by parent_message_id
  const messagesById = new Map(messages.map((m) => [m.id, m]));
  const childrenMap = new Map();
  messages.forEach((m) => {
    const pid = m.parent_message_id;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(m);
  });

  // Compute ancestor path IDs (from selected node up to root)
  const ancestorIds = new Set();
  {
    let curr = selectedParentId;
    while (curr != null && messagesById.has(curr)) {
      ancestorIds.add(curr);
      curr = messagesById.get(curr).parent_message_id;
    }
  }

  // Compute descendant IDs (all nodes under the selected node)
  const descendantIds = new Set();
  if (selectedParentId != null) {
    const stack = [selectedParentId];
    while (stack.length > 0) {
      const id = stack.pop();
      (childrenMap.get(id) || []).forEach((child) => {
        if (child.id != null && !descendantIds.has(child.id)) {
          descendantIds.add(child.id);
          stack.push(child.id);
        }
      });
    }
  }

  // Recursively render message nodes, expanding ancestor path and selected subtree
  const renderNodes = (parentId = null, depth = 0) =>
    (childrenMap.get(parentId) || []).map((msg) => {
      const indent = depth * (msg.sender === "assistant" ? 20 : 10);
      const isSelected = msg.id === selectedParentId;
      const isAncestor = ancestorIds.has(msg.id);
      const isDescendant = descendantIds.has(msg.id);
      return (
        <div
          key={msg.id}
          className={`message-node ${isSelected ? "selected-node" : ""}`}
          style={{ marginLeft: indent }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedParentId(msg.id);
          }}
        >
          <ChatMessage message={msg} />
          {(isAncestor || isSelected || isDescendant) &&
            renderNodes(msg.id, depth + 1)}
        </div>
      );
    });

  const handleTextChange = (e) => {
    setCurrentUserInput(e.target.value);
  };

  // Submit on Enter when Shift is not held.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleLLMChange = (e) => {
    setSelectedLLM(e.target.value);
  };

  return (
    <div className="current-llm-interaction">
      <div className="message-list">
        {/* Display messages or placeholder when no conversation is selected. */}
        {messages && messages.length > 0 ? (
          renderNodes()
        ) : (
          <div className="empty-chat-message">
            Select a conversation or start a new one.
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        {" "}
        <textarea
          className="user-input"
          value={currentUserInput}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
        ></textarea>
        <div className="controls-container">
          {" "}
          {/* Allow selecting the language model for the conversation. */}
          <select
            className="llm-selector"
            value={selectedLLM}
            onChange={handleLLMChange}
          >
            <optgroup label="OpenAI">
              {OPENAI_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </optgroup>
            <optgroup label="Anthropic">
              {ANTHROPIC_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </optgroup>
          </select>
          {/* Send the current message to the backend. */}
          <button
            className="submit-button"
            onClick={onSubmit}
            disabled={!currentUserInput.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteractionArea;
