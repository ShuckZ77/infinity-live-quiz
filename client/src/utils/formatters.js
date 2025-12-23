/**
 * Formatting Utilities
 *
 * Pure functions for formatting data for display.
 * No side effects, easy to test.
 */

/**
 * Format seconds to MM:SS display (for countdown timer)
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string (e.g., "2:30")
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get current timestamp in HH:MM:SS format
 * @returns {string} Current time (e.g., "14:32:15")
 */
export const getCurrentTimestamp = () => {
  const now = new Date();
  return [
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0'),
  ].join(':');
};

/**
 * Get medal/rank badge text for leaderboard
 * @param {number} rank - User's rank (1-based)
 * @returns {string} Badge text (e.g., "1st", "2nd", "#4")
 */
export const getRankBadge = (rank) => {
  switch (rank) {
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return `#${rank}`;
  }
};

/**
 * Calculate bar width for leaderboard chart
 * Scales response time relative to the slowest responder
 * @param {number} responseTime - User's response time
 * @param {Array} rankings - All rankings array
 * @returns {number} Percentage width (0-100)
 */
export const getBarWidth = (responseTime, rankings) => {
  if (rankings.length === 0) return 0;
  const maxTime = rankings[rankings.length - 1]?.responseTime || 1;
  return Math.min(100, (responseTime / maxTime) * 100);
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 30) => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};
