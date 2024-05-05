import React, { useState } from "react";
import ControlPanel from "./components/ControlPanel";
import LLMResponse from "./components/LLMResponse";
import Modal from "./components/Modal";

const App = () => {
  const [userText, setUserText] = useState("");
  const [systemMessage, setSystemMessage] = useState(""); // New state for text from ControlPanel
  const [llmResponse, setLlmResponse] = useState(""); // State to hold the LLM response
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Callback function to update text from ControlPanel
  const handleSystemMessageChange = (event) => {
    setSystemMessage(event.target.value);
  };

  const handleSubmit = async () => {
    setIsModalVisible(true); // Show the modal

    try {
      const response = await fetch("http://localhost:5005/submit-interaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userText, systemMessage }),
      });
      const data = await response.json();
      setLlmResponse(data["GPT-4 Response"]);
    } catch (error) {
      console.error("Error submitting text:", error);
    } finally {
      setIsModalVisible(false); // Hide the modal regardless of the request's outcome
    }
  };

  return (
    <React.Fragment>
      <Modal
        isVisible={isModalVisible}
        message="Retrieving response from LLM, please wait..."
      />
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
          <button className="submit-button" onClick={handleSubmit}>
            Submit
          </button>
        </div>
        <ControlPanel
          onSystemMessageChange={handleSystemMessageChange}
          systemMessage={systemMessage}
        />
      </div>
    </React.Fragment>
  );
};

export default App;
