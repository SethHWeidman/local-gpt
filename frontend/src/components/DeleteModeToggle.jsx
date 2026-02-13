/**
 * DeleteModeToggle.jsx
 *
 * Renders a toggle switch to enable delete mode for the conversation list.
 */
import "./DeleteModeToggle.css";

const DeleteModeToggle = ({ isDeleteMode, toggleDeleteMode }) => {
  const inputId = "delete-mode-toggle";

  return (
    <div className="delete-toggle">
      <input
        id={inputId}
        type="checkbox"
        checked={isDeleteMode}
        onChange={toggleDeleteMode}
      />
      <label htmlFor={inputId}>{`Delete Mode: ${isDeleteMode ? "On" : "Off"}`}</label>
    </div>
  );
};

export default DeleteModeToggle;
