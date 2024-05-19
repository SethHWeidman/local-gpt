import React from "react";
import LLMResponse from "./LLMResponse";

const InteractionArea = ({
  llmResponse,
  userText,
  setUserText,
  handleSubmit,
}) => {
  return (
    <div className="current-llm-interaction">
      <LLMResponse message={llmResponse} />
      <textarea
        className="user-input"
        value={userText}
        onChange={(e) => setUserText(e.target.value)}
        placeholder="This is where you will type your query to the LLM"
      ></textarea>
      <button className="submit-button" onClick={handleSubmit}>
        Submit
      </button>
    </div>
  );
};

export default InteractionArea;
