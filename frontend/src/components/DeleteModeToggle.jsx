/**
 * DeleteModeToggle.jsx
 *
 * Renders a toggle switch to enable delete mode for the conversation list.
 */
import "./DeleteModeToggle.css";

const DeleteModeToggle = ({ isDeleteMode, toggleDeleteMode }) => (
  <label className="delete-toggle">
    <input type="checkbox" checked={isDeleteMode} onChange={toggleDeleteMode} />
    <span>{isDeleteMode ? "Off" : "On"}</span>
  </label>
);

export default DeleteModeToggle;
