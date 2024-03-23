import React, { useState } from "react";
import LLMResponse from './components/LLMResponse';

const App = () => {
  const [userText, setUserText] = useState("");
  const [llmResponse, setLlmResponse] = useState(""); // State to hold the LLM response  

  const handleSubmit = async () => {
    try {
      const response = await fetch("http://localhost:5005/submit-interaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userText }),
      });
      const data = await response.json();
      console.log(data); // Log the response from the backend
      // Handle any post-submission logic here, like clearing the text area
      setLlmResponse(data['GPT-4 Response'])
      setUserText(""); // Clear the text area after successful submission
    } catch (error) {
      console.error("Error submitting text:", error);
    }
  };

  return (
    <React.Fragment>
      <div className="header-material">
        <h1 className="main-title">Local GPT</h1>
        <p>
          A way to interact with large language models locally on your laptop.
        </p>
      </div>
      <div className="app-container">
        <div className="past-chats-panel">
          This area will display a list of your prior chats.
        </div>
        <div className="current-llm-interaction">
          <LLMResponse message={llmResponse} />
          <textarea
            className="user-input"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="This is where you will type your query to the LLM"
          ></textarea>
          <button className="submit-button" onClick={handleSubmit}>Submit</button>
        </div>
        <div className="control-bar">
          This area will contain controls, such as the "temperature", for the
          LLM you are interacting with.
        </div>
      </div>
    </React.Fragment>
  );
};

export default App;
