import React, { useEffect, useState } from "react";
import ControlPanel from "./components/ControlPanel";
import LLMResponse from "./components/LLMResponse";
import Modal from "./components/Modal";

const App = () => {
  const [conversations, setConversations] = useState([]);
  const [triggerFetch, setTriggerFetch] = useState(false); // This state will trigger re-fetching of conversations

  const [userText, setUserText] = useState("");
  const [systemMessage, setSystemMessage] = useState(""); // New state for text from ControlPanel
  const [llmResponse, setLlmResponse] = useState(""); // State to hold the LLM response
  const [isModalVisible, setIsModalVisible] = useState(false);

  // fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      console.log("here");
      const response = await fetch("http://localhost:5005/api/conversations");
      const data = await response.json();
      setConversations(data);
    };

    fetchConversations();
  }, [triggerFetch]); // Dependency on triggerFetch

  // Handle conversation selection
  const handleSelectConversation = async (conversationId) => {
    const response = await fetch(
      `http://localhost:5005/api/messages/${conversationId}`
    );
    const data = await response.json();
    const systemMessage =
      data.find((msg) => msg.sender === "system")?.text || "";
    const userMessage = data.find((msg) => msg.sender === "user")?.text || "";
    const assistantMessage =
      data.find((msg) => msg.sender === "assistant")?.text || "";

    setSystemMessage(systemMessage);
    setUserText(userMessage);
    setLlmResponse(assistantMessage);
  };

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

      // Assuming the response is successful, trigger a re-fetch of conversations
      setTriggerFetch((prev) => !prev); // Toggle the state to trigger useEffect
    } catch (error) {
      console.error("Error submitting text:", error);
    } finally {
      setIsModalVisible(false); // Hide the modal regardless of the request's outcome
      setTriggerFetch(!triggerFetch); // Toggle trigger to re-fetch conversations
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
          Past conversations:
          <br></br>
          <br></br>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
            >
              {conv.topic}
            </div>
          ))}
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
