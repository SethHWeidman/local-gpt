import React, { useState } from "react";

const App = () => {
  const [text, setText] = useState("");

  const handleSubmit = async () => {
    try {
      const response = await fetch("http://localhost:5005/submit-interaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      console.log(data); // Log the response from the backend
      // Handle any post-submission logic here, like clearing the text area
      setText(""); // Clear the text area after successful submission
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
          <div className="llm-response-display">
            This will display the output from the LLM you are interacting with.
          </div>
          <textarea
            className="user-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="This is where you will type your query to the LLM"
          ></textarea>
          <button onClick={handleSubmit}>Submit</button>
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
