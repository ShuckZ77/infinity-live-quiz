/**
 * Session score compatibility wrapper.
 *
 * Scores now live in session_scores and are keyed by readable session_id.
 */

const quiz = require("./quiz");

async function getVideoLeaderboard(idOrVideoId, limit = 10) {
  return quiz.getSessionLeaderboard(idOrVideoId, limit);
}

async function getSessionLeaderboard(sessionId, limit = 100) {
  return quiz.getSessionLeaderboard(sessionId, limit);
}

module.exports = {
  getVideoLeaderboard,
  getSessionLeaderboard,
};
