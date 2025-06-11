/**
 * Modal.jsx
 *
 * Displays a modal overlay with a message when visible.
 */
import "./Modal.css";

const Modal = ({ isVisible, message }) => {
  // Do not render when the modal is hidden.
  if (!isVisible) return null;

  // Render the backdrop and message container.
  return (
    <>
      <div className="modal-backdrop"></div>
      <div className="modal">{message}</div>
    </>
  );
};

export default Modal;
