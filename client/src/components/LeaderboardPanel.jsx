/**
 * LeaderboardPanel Component
 *
 * Right panel displaying top 25 fastest responders.
 * Features bar chart visualization and medal badges.
 *
 * PROPS:
 * - visible: Panel visibility state
 * - rankings: Array of ranked users
 * - onClose: Close panel callback
 */

import PropTypes from 'prop-types';
import { getRankBadge, getBarWidth, truncateText } from '../utils';

// Rank badge component
const RankBadge = ({ rank }) => (
  <div className={`rank-badge rank-${rank}`}>
    {getRankBadge(rank)}
  </div>
);

RankBadge.propTypes = {
  rank: PropTypes.number.isRequired,
};

// User info with bar chart
const UserInfo = ({ entry, barWidth }) => (
  <div className="user-info">
    <div className="user-header">
      <span className="username">{entry.author}</span>
      <span className="time">{entry.responseTime.toFixed(3)}s</span>
    </div>

    {/* Bar chart visualization */}
    <div className="bar-container">
      <div
        className="bar"
        style={{
          width: `${barWidth}%`,
          animationDelay: `${entry.rank * 0.05 + 0.2}s`,
        }}
      />
    </div>

    {/* Meta info */}
    <div className="user-meta">
      <span className="message-preview" title={entry.message}>
        "{truncateText(entry.message, 30)}"
      </span>
      {entry.responseCount > 1 && (
        <span className="comment-count">
          ({entry.responseCount} comments)
        </span>
      )}
    </div>
  </div>
);

UserInfo.propTypes = {
  entry: PropTypes.shape({
    rank: PropTypes.number.isRequired,
    author: PropTypes.string.isRequired,
    responseTime: PropTypes.number.isRequired,
    message: PropTypes.string.isRequired,
    responseCount: PropTypes.number,
  }).isRequired,
  barWidth: PropTypes.number.isRequired,
};

// Individual leaderboard entry
const LeaderboardItem = ({ entry, rankings }) => {
  const barWidth = getBarWidth(entry.responseTime, rankings);

  return (
    <div
      className={`leaderboard-item rank-${entry.rank}`}
      style={{ animationDelay: `${entry.rank * 0.05}s` }}
    >
      <RankBadge rank={entry.rank} />
      <UserInfo entry={entry} barWidth={barWidth} />
    </div>
  );
};

LeaderboardItem.propTypes = {
  entry: PropTypes.object.isRequired,
  rankings: PropTypes.array.isRequired,
};

// Empty state
const EmptyState = () => (
  <div className="empty-state">No responses recorded</div>
);

// Leaderboard list
const LeaderboardList = ({ rankings }) => (
  <div className="leaderboard">
    {rankings.map((entry) => (
      <LeaderboardItem key={entry.rank} entry={entry} rankings={rankings} />
    ))}
  </div>
);

LeaderboardList.propTypes = {
  rankings: PropTypes.array.isRequired,
};

// Main LeaderboardPanel component
export const LeaderboardPanel = ({ visible, rankings, onClose }) => {
  return (
    <div className={`right-panel ${visible ? 'visible' : ''}`}>
      <div className="leaderboard-section">
        <div className="leaderboard-header">
          <h2 className="section-title">Top 25 Fastest Responders</h2>
          <button
            className="close-panel-btn"
            onClick={onClose}
            title="Hide Panel"
          >
            ✕
          </button>
        </div>

        {rankings.length === 0 ? (
          <EmptyState />
        ) : (
          <LeaderboardList rankings={rankings} />
        )}
      </div>
    </div>
  );
};

LeaderboardPanel.propTypes = {
  visible: PropTypes.bool.isRequired,
  rankings: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
};
