/**
 * SessionLeaderboard Component (v3.12)
 *
 * Footer-style leaderboard showing top 10 students by points.
 * Only visible after first quiz completes.
 *
 * Features:
 * - Glassmorphism design
 * - Avatars with initials
 * - Points display with animation
 * - Responsive layout
 */

import React from "react";
import PropTypes from "prop-types";

// Avatar gradient colors based on username hash
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #ff9a9e, #fecfef)",
  "linear-gradient(135deg, #ffecd2, #fcb69f)",
  "linear-gradient(135deg, #a1c4fd, #c2e9fb)",
  "linear-gradient(135deg, #d299c2, #fef9d7)",
];

// Get consistent gradient for username
const getAvatarGradient = (username) => {
  if (!username) return AVATAR_GRADIENTS[0];
  const hash = username.charCodeAt(0) + (username.charCodeAt(1) || 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

// Get initials from username (first 2 chars)
const getInitials = (username) => {
  if (!username) return "??";
  return username.slice(0, 2).toUpperCase();
};

// Rank badges
const getRankBadge = (rank) => {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `#${rank}`;
  }
};

const SessionLeaderboard = ({ leaderboard = [], questionsAsked = 0 }) => {
  if (!leaderboard || leaderboard.length === 0) {
    return null;
  }

  return (
    <footer className="session-leaderboard-footer">
      <div className="leaderboard-header">
        <span className="leaderboard-title">🏆 Video Leaderboard</span>
        <span className="leaderboard-subtitle">
          {questionsAsked > 0 ? `${questionsAsked} questions | ` : ""}+4 pts per
          correct
        </span>
      </div>
      <div className="leaderboard-grid">
        {leaderboard.map((user, index) => (
          <div
            key={user.username}
            className={`leaderboard-card ${index < 3 ? "top-three" : ""}`}
          >
            <div className="leaderboard-rank">{getRankBadge(index + 1)}</div>
            <div
              className="leaderboard-avatar"
              style={{ background: getAvatarGradient(user.username) }}
            >
              {getInitials(user.username)}
            </div>
            <div className="leaderboard-info">
              <span className="leaderboard-username" title={user.username}>
                {user.username.length > 12
                  ? user.username.slice(0, 12) + "..."
                  : user.username}
              </span>
              <span className="leaderboard-stats">
                {user.correct_answers}/{user.total_answers}
                {user.avg_response_time_ms > 0 && (
                  <> | ~{(user.avg_response_time_ms / 1000).toFixed(1)}s</>
                )}
              </span>
            </div>
            <div className="leaderboard-points">
              <span className="points-value">{user.total_points}</span>
              <span className="points-label">pts</span>
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
};

SessionLeaderboard.propTypes = {
  leaderboard: PropTypes.arrayOf(
    PropTypes.shape({
      username: PropTypes.string.isRequired,
      total_points: PropTypes.number.isRequired,
      correct_answers: PropTypes.number.isRequired,
      total_answers: PropTypes.number.isRequired,
      avg_response_time_ms: PropTypes.number,
    })
  ),
};

export default SessionLeaderboard;
