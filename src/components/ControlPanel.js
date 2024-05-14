import React from "react";

const ControlPanel = ({ onSystemMessageChange, systemMessage }) => {
  return (
    <div className="control-panel">
      Type your "system message" to the LLM below. For context, the default
      system message for ChatGPT is "You are a helpful assistant."
      <br />
      <br />
      <textarea
        className="system-prompt"
        onChange={onSystemMessageChange}
        value={systemMessage}
      ></textarea>
    </div>
  );
};

export default ControlPanel;
