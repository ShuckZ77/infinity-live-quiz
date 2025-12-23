/**
 * ChatSection Component
 *
 * Displays live chat messages with timestamps.
 * Shows response time during quiz, real timestamp when idle.
 *
 * PROPS:
 * - messages: Array of chat messages
 * - sessionStatus: Current session state (for frozen styling)
 */

import PropTypes from 'prop-types';
import { SESSION_STATUS } from '../utils';

// Individual message item
const MessageItem = ({ message }) => {
  const { responseTime, realTimestamp, isDuplicate, author, message: text } = message;

  return (
    <div className={`message-item ${isDuplicate ? 'duplicate' : ''}`}>
      {/* Time badge: response time during quiz, real time when idle */}
      {responseTime ? (
        <span className="response-time">{responseTime}s</span>
      ) : (
        <span className="timestamp">{realTimestamp}</span>
      )}

      {/* Duplicate indicator */}
      {isDuplicate && <span className="duplicate-badge">DUP</span>}

      {/* Author name */}
      <span className="author">{author}</span>

      {/* Message text */}
      <span className="text">{text}</span>
    </div>
  );
};

MessageItem.propTypes = {
  message: PropTypes.shape({
    responseTime: PropTypes.number,
    realTimestamp: PropTypes.string,
    isDuplicate: PropTypes.bool,
    author: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
  }).isRequired,
};

// Empty state when no messages
const EmptyState = () => (
  <div className="empty-state">
    Waiting for chat messages...
  </div>
);

// Messages list
const MessagesList = ({ messages }) => (
  <div className="messages-list">
    {messages.length === 0 ? (
      <EmptyState />
    ) : (
      messages.map((msg, index) => (
        <MessageItem key={index} message={msg} />
      ))
    )}
  </div>
);

MessagesList.propTypes = {
  messages: PropTypes.array.isRequired,
};

// Main ChatSection component
export const ChatSection = ({ messages, sessionStatus }) => {
  const isFrozen = sessionStatus === SESSION_STATUS.ENDED;

  return (
    <div className={`chat-section ${isFrozen ? 'chat-frozen' : ''}`}>
      <div className="chat-header-row">
        <h2 className="section-title">Live Chat</h2>
        <span className="message-count">{messages.length} messages</span>
      </div>
      <MessagesList messages={messages} />
    </div>
  );
};

ChatSection.propTypes = {
  messages: PropTypes.array.isRequired,
  sessionStatus: PropTypes.oneOf(Object.values(SESSION_STATUS)).isRequired,
};
