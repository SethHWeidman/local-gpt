import "./Modal.css"; // Import the CSS file

const Modal = ({ isVisible, message }) => {
  if (!isVisible) return null;

  return (
    <>
      <div className="modal-backdrop"></div>
      <div className="modal">{message}</div>
    </>
  );
};

export default Modal;
