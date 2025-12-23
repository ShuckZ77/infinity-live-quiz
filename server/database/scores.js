/**
 * Video Scores Database Operations (v3.12.1)
 *
 * Manages cumulative points per user per VIDEO for leaderboard.
 * Points are awarded for correct answers (+4 per correct).
 * Response time tracked only for correct answers (for avg calculation).
 *
 * USAGE:
 *   const scores = require('./scores');
 *   await scores.updateUserScore(videoId, username, true, 2500);
 *   const leaderboard = await scores.getVideoLeaderboard(videoId, 10);
 */

const { query, run } = require("./index");

const POINTS_PER_CORRECT = 4;

/**
 * Update user's score for a video
 * Adds points and increments counters
 * Response time only added for correct answers
 *
 * @param {string} videoId - YouTube video ID
 * @param {string} username - YouTube username
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {number} responseTimeMs - Response time in milliseconds
 * @returns {Promise<void>}
 */
async function updateUserScore(
  videoId,
  username,
  isCorrect,
  responseTimeMs = 0
) {
  const pointsToAdd = isCorrect ? POINTS_PER_CORRECT : 0;
  const correctIncrement = isCorrect ? 1 : 0;
  const timeToAdd = isCorrect ? Math.round(responseTimeMs) : 0;

  try {
    // Check if user has existing score for this video
    const existing = await query(
      "SELECT total_points FROM video_scores WHERE video_id = ? AND username = ?",
      [videoId, username]
    );

    if (existing.length === 0) {
      // Insert new score record
      await run(
        `INSERT INTO video_scores 
         (video_id, username, total_points, correct_answers, total_answers, total_response_time_ms, last_updated)
         VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`,
        [videoId, username, pointsToAdd, correctIncrement, timeToAdd]
      );
    } else {
      // Update existing score
      await run(
        `UPDATE video_scores 
         SET total_points = total_points + ?,
             correct_answers = correct_answers + ?,
             total_answers = total_answers + 1,
             total_response_time_ms = total_response_time_ms + ?,
             last_updated = datetime('now')
         WHERE video_id = ? AND username = ?`,
        [pointsToAdd, correctIncrement, timeToAdd, videoId, username]
      );
    }
  } catch (error) {
    console.error(
      `[Scores] Error updating score for ${username}:`,
      error.message
    );
  }
}

/**
 * Batch update scores for multiple users after quiz ends
 *
 * @param {string} videoId - YouTube video ID
 * @param {Array} participants - Array of { username, isCorrect, responseTimeMs }
 * @returns {Promise<void>}
 */
async function batchUpdateScores(videoId, participants) {
  for (const p of participants) {
    await updateUserScore(
      videoId,
      p.username,
      p.isCorrect,
      p.responseTimeMs || 0
    );
  }
  console.log(
    `[Scores] Updated ${participants.length} user scores for video ${videoId}`
  );
}

/**
 * Get video leaderboard (top users by points)
 * Includes average response time (only for correct answers)
 *
 * @param {string} videoId - YouTube video ID
 * @param {number} limit - Max users to return (default: 10)
 * @returns {Promise<Array>} Array of { username, total_points, correct_answers, total_answers, avg_response_time_ms }
 */
async function getVideoLeaderboard(videoId, limit = 10) {
  try {
    const rows = await query(
      `SELECT 
         username, 
         total_points, 
         correct_answers, 
         total_answers,
         CASE 
           WHEN correct_answers > 0 THEN total_response_time_ms / correct_answers 
           ELSE 0 
         END as avg_response_time_ms
       FROM video_scores
       WHERE video_id = ?
       ORDER BY total_points DESC, correct_answers DESC
       LIMIT ?`,
      [videoId, limit]
    );
    return rows;
  } catch (error) {
    console.error("[Scores] Error getting leaderboard:", error.message);
    return [];
  }
}

/**
 * Increment questions asked count for a video
 * Called when timer ends naturally (not aborted)
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<void>}
 */
async function incrementQuestionsAsked(videoId) {
  try {
    await run(
      `UPDATE videos SET questions_asked = questions_asked + 1 WHERE video_id = ?`,
      [videoId]
    );
    console.log(`[Scores] Incremented questions_asked for video ${videoId}`);
  } catch (error) {
    console.error(
      "[Scores] Error incrementing questions_asked:",
      error.message
    );
  }
}

/**
 * Get a user's score for a video
 *
 * @param {string} videoId - YouTube video ID
 * @param {string} username - YouTube username
 * @returns {Promise<Object|null>} User's score or null
 */
async function getUserScore(videoId, username) {
  try {
    const rows = await query(
      "SELECT * FROM video_scores WHERE video_id = ? AND username = ?",
      [videoId, username]
    );
    return rows[0] || null;
  } catch (error) {
    console.error(
      `[Scores] Error getting score for ${username}:`,
      error.message
    );
    return null;
  }
}

/**
 * Reset all scores for a video (used for cleanup)
 *
 * @param {string} videoId - Video ID to reset
 * @returns {Promise<void>}
 */
async function resetVideoScores(videoId) {
  try {
    await run("DELETE FROM video_scores WHERE video_id = ?", [videoId]);
    console.log(`[Scores] Reset scores for video ${videoId}`);
  } catch (error) {
    console.error("[Scores] Error resetting video scores:", error.message);
  }
}

/**
 * Get score statistics for a video
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Stats object
 */
async function getScoreStats(videoId) {
  try {
    const rows = await query(
      `SELECT 
         COUNT(*) as total_participants,
         SUM(total_points) as total_points_awarded,
         SUM(correct_answers) as total_correct,
         SUM(total_answers) as total_answers,
         MAX(total_points) as highest_score
       FROM video_scores
       WHERE video_id = ?`,
      [videoId]
    );
    return rows[0] || {};
  } catch (error) {
    console.error("[Scores] Error getting stats:", error.message);
    return {};
  }
}

module.exports = {
  POINTS_PER_CORRECT,
  updateUserScore,
  batchUpdateScores,
  getVideoLeaderboard,
  incrementQuestionsAsked,
  getUserScore,
  resetVideoScores,
  getScoreStats,
};
