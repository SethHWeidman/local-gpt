import React from "react";

const App = () => {
  return (
    <React.Fragment>
      <div className="header-material">
        <h1 className="main-title">Local GPT</h1>
        <p>
          A way to interact with large language models locally on your laptop.
        </p>
      </div>
      <div className="app-container">
        <div className="past-chats-panel">This area will display a list of your prior chats.</div>
        <div className="current-llm-interaction">
          <div className="llm-response-display">This will display the output from the LLM you are interacting with.</div>
          <textarea
            className="user-input"
            placeholder="This is where you will type your query to the LLM"
          ></textarea>          
        </div>
        <div className="control-bar">This area will contain controls, such as the "temperature", for the LLM you are interacting with.</div>
      </div>
    </React.Fragment>
  );
};

export default App;
