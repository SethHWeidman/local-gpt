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

  // state to manage editing
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  // Function to fetch conversations from the server
  const fetchConversations = async () => {
    console.log("Fetching conversations...");
    const response = await fetch("http://localhost:5005/api/conversations");
    const data = await response.json();
    setConversations(data);
  };

  // Effect to fetch conversations initially and on trigger changes
  useEffect(() => {
    fetchConversations();
  }, [triggerFetch]);

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

  // handle double click
  const handleDoubleClick = (conv) => {
    setEditId(conv.id);
    setEditText(conv.topic);
  };

  // handle name change on enter
  const handleNameChange = async (e) => {
    if (e.key === "Enter") {
      // Call API to update the conversation topic
      await fetch(`http://localhost:5005/api/conversations/${editId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: editText }),
      });
      setEditId(null); // Stop editing model
      setTriggerFetch((prev) => !prev); // Toggle to re-fetch conversations
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
              onDoubleClick={() => handleDoubleClick(conv)}
            >
              {editId === conv.id ? (
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleNameChange}
                  autoFocus
                />
              ) : (
                conv.topic
              )}
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
