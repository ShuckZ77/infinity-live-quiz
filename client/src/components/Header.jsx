/**
 * Header Component
 *
 * App header with title, leaderboard toggle, and connection status.
 * v3.11: Now also displays video metadata when connected.
 *
 * PROPS:
 * - isConnected: Socket connection status
 * - showLeaderboard: Panel visibility state
 * - hasRankings: Whether rankings exist
 * - onToggleLeaderboard: Toggle callback
 * - videoTitle: Current video title (v3.11)
 * - channelName: Channel name (v3.11)
 * - viewCount: Current view count (v3.11)
 */

import PropTypes from "prop-types";
import brandLogo from "../assets/Brand-mark.png";

export const Header = ({
  isConnected,
  showLeaderboard,
  hasRankings,
  onToggleLeaderboard,
  videoTitle,
  channelName,
  viewCount,
}) => {
  // Format view count with commas
  const formatViewCount = (count) => {
    if (!count) return null;
    return count.toLocaleString();
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="app-logo">
          <img src={brandLogo} alt="Logo" />
        </div>
        <h1>Infinity Live Quiz</h1>
      </div>

      {/* Video Info Section (v3.11) */}
      {videoTitle && (
        <div className="header-video-info">
          <span className="video-title" title={videoTitle}>
            {videoTitle.length > 40
              ? videoTitle.substring(0, 40) + "..."
              : videoTitle}
          </span>
          {channelName && <span className="channel-name">{channelName}</span>}
          {viewCount !== null && viewCount !== undefined && (
            <span className="view-count">
              ~{formatViewCount(viewCount)} views
            </span>
          )}
        </div>
      )}

      <div className="header-controls">
        {/* Leaderboard toggle - only shown when rankings exist */}
        {hasRankings && (
          <button
            className={`toggle-leaderboard-btn ${
              showLeaderboard ? "active" : ""
            }`}
            onClick={onToggleLeaderboard}
            title={showLeaderboard ? "Hide Leaderboard" : "Show Leaderboard"}
          >
            {showLeaderboard ? "Hide Rankings" : "Show Rankings"}
          </button>
        )}

        {/* Connection status indicator */}
        <span
          className={`connection-status ${isConnected ? "online" : "offline"}`}
        >
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </header>
  );
};

Header.propTypes = {
  isConnected: PropTypes.bool.isRequired,
  showLeaderboard: PropTypes.bool.isRequired,
  hasRankings: PropTypes.bool.isRequired,
  onToggleLeaderboard: PropTypes.func.isRequired,
  videoTitle: PropTypes.string,
  channelName: PropTypes.string,
  viewCount: PropTypes.number,
};
