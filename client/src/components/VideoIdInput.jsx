import React, { useState } from "react";
import "./VideoIdInput.css";

export const VideoIdInput = ({ onSetVideoId, status, error }) => {
  const [inputVal, setInputVal] = useState("");
  const [isValid, setIsValid] = useState(false);

  // Auto-extract ID if user pastes a URL
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);

    // Regex for YouTube Video IDs
    // Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/live/ID
    const urlRegex = new RegExp(
      '(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^"&?\\/\\s]{11})'
    );
    const match = val.match(urlRegex);

    if (match && match[1]) {
      setInputVal(match[1]);
      setIsValid(true);
      // Optional: Auto-submit on valid paste?
      // onSetVideoId(match[1]);
    } else if (val.length === 11) {
      setIsValid(true);
    } else {
      setIsValid(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid && inputVal) {
      onSetVideoId(inputVal);
    }
  };

  return (
    <div className="video-id-container">
      <form onSubmit={handleSubmit} className="video-id-form">
        <div className="input-group">
          <input
            type="text"
            value={inputVal}
            onChange={handleInputChange}
            placeholder="Enter YouTube Video ID or URL"
            className="video-input"
            disabled={status === "connecting" || status === "live"}
          />
          <button
            type="submit"
            className={`connect-btn ${status}`}
            disabled={!isValid || status === "connecting" || status === "live"}
          >
            {status === "connecting"
              ? "Connecting..."
              : status === "live"
              ? "Connected"
              : "Connect"}
          </button>
        </div>
        {error && <div className="error-message">Error: {error}</div>}
        {status === "offline" && (
          <div className="status-message offline">Video is Offline</div>
        )}
      </form>
    </div>
  );
};
