import React from "react";
import ReactMarkdown from "react-markdown";

// Define the component that accepts props
const LLMResponse = (props) => {
  // Access the message passed as a prop
  const { message } = props;

  // Render the message inside a div
  return (
    <div className="llm-response">
      <ReactMarkdown>{message}</ReactMarkdown>
    </div>
  );
};

export default LLMResponse;
