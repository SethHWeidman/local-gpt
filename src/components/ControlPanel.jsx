/**
 * ControlPanel.jsx
 *
 * Allows the user to edit the system message sent to the language model.
 */
import { useConversation } from "../contexts/ConversationContext";

const ControlPanel = () => {
  const { currentConversation, setCurrentConversation } = useConversation();

  // Update the systemMessage field in the current conversation state.
  const handleSystemMessageChange = (event) => {
    setCurrentConversation((prev) => ({
      ...prev,
      systemMessage: event.target.value,
    }));
  };

  // Render the text area for editing the system message.
  return (
    <div className="control-panel">
      Type your "system message" to the LLM below. For context, the default
      system message for ChatGPT is "You are a helpful assistant."
      <br />
      <br />
      <textarea
        className="system-prompt"
        onChange={handleSystemMessageChange}
        value={currentConversation.systemMessage || ""}
      ></textarea>
    </div>
  );
};

export default ControlPanel;
