import React from 'react';
import './StreamingIndicator.css';

/**
 * StreamingIndicator.jsx
 *
 * Displays a small text indicator in the header when an LLM response is streaming.
 */
const StreamingIndicator = ({ isVisible }) => {
  if (!isVisible) return null;
  return <div className="streaming-indicator">Response streaming...</div>;
};

export default StreamingIndicator;