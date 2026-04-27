/**
 * Rankings Database Operations
 *
 * Handles timer rankings storage and retrieval.
 * Each timer run is uniquely identified by a timer_id.
 * Stores top 50 users with their response times for each timer run.
 *
 * HIERARCHY:
 *   date -> video_id -> timer_id -> rankings (top 50 with response times)
 *
 * USAGE:
 *   const rankings = require('./database/rankings');
 *   const timerId = rankings.generateTimerId();
 *   await rankings.createTimerRanking(timerId, sessionId, videoId, 60);
 *   await rankings.saveRankingEntries(timerId, rankingsArray);
 *   await rankings.saveAllUserResponses(timerId, allResponses); // v3.8
 *
 * EXPORTS:
 *   - generateTimerId(): Generate unique timer ID (DDMMYYHHMMSS)
 *   - createTimerRanking(): Create a new timer ranking record
 *   - saveRankingEntries(): Save top 50 ranking entries
 *   - endTimerRanking(): Mark timer as ended with participant count
 *   - getTimerRanking(): Get single timer ranking by ID
 *   - getRankingsBySession(): Get all rankings for a session
 *   - getRankingsByVideoId(): Get all rankings for a video
 *   - getRankingsByDate(): Get all rankings for a date
 *   - getRankingEntries(): Get ranking entries for a timer
 *   - getAllTimerRankings(): Get all timer rankings
 *   - getTopRankingsByUser(): Get user's best rankings across all timers
 *
 * USER RESPONSE TRACKING (v3.8):
 *   - saveAllUserResponses(): Save all user responses (correct + wrong, max 200)
 *   - getUserResponses(): Get responses for a timer (filter by correct/wrong)
 *   - getResponseStats(): Get response stats { total, correct, wrong, correctRate }
 *   - getUserAnswerHistory(): Get user's answer history across all timers
 *   - getAllUserResponses(): Get all user responses (for db viewer)
 *
 * ANSWER DISTRIBUTION (v3.9):
 *   - saveAnswerDistribution(): Save MCQ answer counts { A, B, C, D }
 *   - getAnswerDistribution(): Get answer distribution for a timer
 */

const { query, run } = require("./index");

/**
 * Generate a unique timer ID based on current timestamp
 * Format: DDMMYYHHMMSSmmmcc
 *
 * Example: 1212251230004201 = December 12, 2025, 12:30:00.042
 *
 * @returns {string} Timer ID
 */
let timerSequence = 0;

function generateTimerId() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2); // Last 2 digits
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  timerSequence = (timerSequence + 1) % 100;
  const sequence = String(timerSequence).padStart(2, "0");

  return `${day}${month}${year}${hours}${minutes}${seconds}${milliseconds}${sequence}`;
}

/**
 * Parse a timer ID back to its components
 *
 * @param {string} timerId - Timer ID
 * @returns {Object} Parsed components { day, month, year, hours, minutes, seconds, date }
 */
function parseTimerId(timerId) {
  if (!timerId || timerId.length < 12) {
    return null;
  }

  const day = timerId.substring(0, 2);
  const month = timerId.substring(2, 4);
  const year = "20" + timerId.substring(4, 6);
  const hours = timerId.substring(6, 8);
  const minutes = timerId.substring(8, 10);
  const seconds = timerId.substring(10, 12);

  return {
    day,
    month,
    year,
    hours,
    minutes,
    seconds,
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`,
    display: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`,
  };
}

/**
 * Create a new timer ranking record
 * Called when a timer starts
 *
 * @param {string} timerId - Unique timer ID (DDMMYYHHMMSS)
 * @param {number} sessionId - Session ID from sessions table
 * @param {string} videoId - YouTube video ID
 * @param {number} duration - Timer duration in seconds (30, 60, 120, 180)
 * @param {string} questionType - Question type: 'mcq' or 'fill-blank' (v3.7)
 * @returns {Promise<string>} The created timer ID
 */
async function createTimerRanking(timerId, sessionId, videoId, duration, questionType = 'mcq') {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const startedAt = now.toISOString();

  await run(
    `INSERT INTO timer_rankings (timer_id, session_id, video_id, date, duration, question_type, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [timerId, sessionId, videoId, date, duration, questionType, startedAt]
  );

  console.log(
    `[Database] Created timer ranking: ${timerId} (${duration}s, ${questionType}, video: ${videoId})`
  );
  return timerId;
}

/**
 * Save ranking entries for a timer run
 * Stores up to 50 top users with their response times
 *
 * @param {string} timerId - Timer ID
 * @param {Array} rankings - Array of { author, responseTime, message } objects
 * @returns {Promise<number>} Number of entries saved
 */
async function saveRankingEntries(timerId, rankings) {
  if (!rankings || rankings.length === 0) {
    return 0;
  }

  // Take only top 50
  const top50 = rankings.slice(0, 50);

  let savedCount = 0;

  for (let i = 0; i < top50.length; i++) {
    const entry = top50[i];
    const rank = i + 1;

    try {
      await run(
        `INSERT INTO timer_ranking_entries (timer_id, rank, username, response_time_seconds, message)
         VALUES (?, ?, ?, ?, ?)`,
        [
          timerId,
          rank,
          entry.author,
          entry.responseTime,
          entry.message || "",
        ]
      );
      savedCount++;
    } catch (error) {
      console.error(
        `[Database] Failed to save ranking entry ${rank}:`,
        error.message
      );
    }
  }

  console.log(`[Database] Saved ${savedCount} ranking entries for timer ${timerId}`);
  return savedCount;
}

/**
 * Mark a timer ranking as ended and update participant count
 * Called when a timer ends
 *
 * @param {string} timerId - Timer ID
 * @param {number} totalParticipants - Number of unique users who responded (correct answers only in v3.7)
 * @param {string} correctAnswer - The correct answer submitted by host (v3.7)
 * @returns {Promise<void>}
 */
async function endTimerRanking(timerId, totalParticipants, correctAnswer = null) {
  const now = new Date().toISOString();

  await run(
    `UPDATE timer_rankings SET ended_at = ?, total_participants = ?, correct_answer = ? WHERE timer_id = ?`,
    [now, totalParticipants, correctAnswer, timerId]
  );

  console.log(
    `[Database] Ended timer ranking: ${timerId} (${totalParticipants} correct, answer: ${correctAnswer || 'N/A'})`
  );
}

/**
 * Save answer distribution for MCQ questions (v3.9)
 * Stores count of users who chose each option (A, B, C, D)
 *
 * @param {string} timerId - Timer ID
 * @param {Object} distribution - Object with counts { A: n, B: n, C: n, D: n }
 * @returns {Promise<void>}
 */
async function saveAnswerDistribution(timerId, distribution) {
  const countA = distribution.A || 0;
  const countB = distribution.B || 0;
  const countC = distribution.C || 0;
  const countD = distribution.D || 0;

  await run(
    `UPDATE timer_rankings
     SET answer_count_a = ?, answer_count_b = ?, answer_count_c = ?, answer_count_d = ?
     WHERE timer_id = ?`,
    [countA, countB, countC, countD, timerId]
  );

  console.log(
    `[Database] Saved answer distribution for ${timerId}: A=${countA}, B=${countB}, C=${countC}, D=${countD}`
  );
}

/**
 * Get answer distribution for a timer (v3.9)
 *
 * @param {string} timerId - Timer ID
 * @returns {Promise<Object>} Distribution object { A, B, C, D, total }
 */
async function getAnswerDistribution(timerId) {
  const rows = await query(
    `SELECT answer_count_a, answer_count_b, answer_count_c, answer_count_d
     FROM timer_rankings
     WHERE timer_id = ?`,
    [timerId]
  );

  if (rows.length === 0) {
    return { A: 0, B: 0, C: 0, D: 0, total: 0 };
  }

  const row = rows[0];
  const A = Number(row.answer_count_a || 0);
  const B = Number(row.answer_count_b || 0);
  const C = Number(row.answer_count_c || 0);
  const D = Number(row.answer_count_d || 0);
  const total = A + B + C + D;

  return { A, B, C, D, total };
}

/**
 * Get a single timer ranking by ID
 *
 * @param {string} timerId - Timer ID
 * @returns {Promise<Object|null>} Timer ranking object or null
 */
async function getTimerRanking(timerId) {
  const rows = await query(
    `SELECT * FROM timer_rankings WHERE timer_id = ?`,
    [timerId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all timer rankings for a session
 *
 * @param {number} sessionId - Session ID
 * @returns {Promise<Array>} Array of timer rankings
 */
async function getRankingsBySession(sessionId) {
  return await query(
    `SELECT * FROM timer_rankings WHERE session_id = ? ORDER BY started_at DESC`,
    [sessionId]
  );
}

/**
 * Get all timer rankings for a video ID
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Array>} Array of timer rankings
 */
async function getRankingsByVideoId(videoId) {
  return await query(
    `SELECT * FROM timer_rankings WHERE video_id = ? ORDER BY started_at DESC`,
    [videoId]
  );
}

/**
 * Get all timer rankings for a specific date
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of timer rankings
 */
async function getRankingsByDate(date) {
  return await query(
    `SELECT * FROM timer_rankings WHERE date = ? ORDER BY started_at DESC`,
    [date]
  );
}

/**
 * Get ranking entries for a timer
 *
 * @param {string} timerId - Timer ID
 * @param {number} limit - Max entries to return (default: 50)
 * @returns {Promise<Array>} Array of ranking entries
 */
async function getRankingEntries(timerId, limit = 50) {
  return await query(
    `SELECT * FROM timer_ranking_entries WHERE timer_id = ? ORDER BY rank ASC LIMIT ?`,
    [timerId, limit]
  );
}

/**
 * Get all timer rankings
 *
 * @param {number} limit - Max results (default: 100)
 * @returns {Promise<Array>} Array of timer rankings
 */
async function getAllTimerRankings(limit = 100) {
  return await query(
    `SELECT * FROM timer_rankings ORDER BY started_at DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Get user's best rankings across all timers
 *
 * @param {string} username - YouTube username
 * @param {number} limit - Max results (default: 10)
 * @returns {Promise<Array>} Array of user's best rankings
 */
async function getTopRankingsByUser(username, limit = 10) {
  return await query(
    `SELECT
       tre.timer_id,
       tre.rank,
       tre.response_time_seconds,
       tre.message,
       tr.video_id,
       tr.date,
       tr.duration,
       tr.total_participants
     FROM timer_ranking_entries tre
     JOIN timer_rankings tr ON tre.timer_id = tr.timer_id
     WHERE tre.username = ?
     ORDER BY tre.rank ASC, tre.response_time_seconds ASC
     LIMIT ?`,
    [username, limit]
  );
}

/**
 * Get ranking statistics
 *
 * @returns {Promise<Object>} Stats object
 */
async function getRankingStats() {
  const rows = await query(`
    SELECT
      COUNT(*) as total_timer_runs,
      SUM(total_participants) as total_participants,
      AVG(total_participants) as avg_participants,
      COUNT(DISTINCT video_id) as unique_videos,
      COUNT(DISTINCT date) as unique_days
    FROM timer_rankings
    WHERE ended_at IS NOT NULL
  `);

  const stats = rows[0] || {};

  // Get duration breakdown
  const durationRows = await query(`
    SELECT
      duration,
      COUNT(*) as count
    FROM timer_rankings
    GROUP BY duration
    ORDER BY duration
  `);

  const durationBreakdown = {};
  for (const row of durationRows) {
    durationBreakdown[`timer_${row.duration}s`] = Number(row.count || 0);
  }

  return {
    total_timer_runs: Number(stats.total_timer_runs || 0),
    total_participants: Number(stats.total_participants || 0),
    avg_participants: Number(stats.avg_participants || 0),
    unique_videos: Number(stats.unique_videos || 0),
    unique_days: Number(stats.unique_days || 0),
    ...durationBreakdown,
  };
}

/**
 * Get timer ranking count
 *
 * @returns {Promise<number>} Total number of timer rankings
 */
async function getTimerRankingCount() {
  const rows = await query(`SELECT COUNT(*) as count FROM timer_rankings`);
  return Number(rows[0]?.count || 0);
}

/**
 * Delete a timer ranking and its entries
 *
 * @param {string} timerId - Timer ID to delete
 * @returns {Promise<void>}
 */
async function deleteTimerRanking(timerId) {
  await run(`DELETE FROM timer_ranking_entries WHERE timer_id = ?`, [timerId]);
  await run(`DELETE FROM timer_rankings WHERE timer_id = ?`, [timerId]);
  console.log(`[Database] Deleted timer ranking: ${timerId}`);
}

// ============================================
// USER RESPONSE TRACKING (v3.8)
// ============================================
// Functions for storing and querying ALL user responses (correct and wrong)

/**
 * Save all user responses for a timer run
 * Stores both correct and wrong answers (max 200 entries)
 *
 * @param {string} timerId - Timer ID
 * @param {Array} responses - Array of { author, responseTime, message, isCorrect } objects
 * @returns {Promise<number>} Number of entries saved
 */
async function saveAllUserResponses(timerId, responses) {
  if (!responses || responses.length === 0) {
    return 0;
  }

  // Limit to 200 entries (sorted by response time to keep fastest responders)
  const limitedResponses = responses
    .sort((a, b) => a.responseTime - b.responseTime)
    .slice(0, 200);

  let savedCount = 0;

  for (const entry of limitedResponses) {
    try {
      await run(
        `INSERT INTO timer_user_responses (timer_id, username, response_time_seconds, message, is_correct)
         VALUES (?, ?, ?, ?, ?)`,
        [
          timerId,
          entry.author,
          entry.responseTime,
          entry.message || "",
          entry.isCorrect,
        ]
      );
      savedCount++;
    } catch (error) {
      // Skip duplicates (same user already recorded)
      if (!error.message.includes("Duplicate") && !error.message.includes("PRIMARY KEY")) {
        console.error(`[Database] Failed to save user response:`, error.message);
      }
    }
  }

  console.log(`[Database] Saved ${savedCount} user responses for timer ${timerId}`);
  return savedCount;
}

/**
 * Get all user responses for a timer
 *
 * @param {string} timerId - Timer ID
 * @param {boolean|null} isCorrect - Filter by correct (true), wrong (false), or all (null)
 * @returns {Promise<Array>} Array of user responses
 */
async function getUserResponses(timerId, isCorrect = null) {
  if (isCorrect === null) {
    return await query(
      `SELECT * FROM timer_user_responses WHERE timer_id = ? ORDER BY response_time_seconds ASC`,
      [timerId]
    );
  }
  return await query(
    `SELECT * FROM timer_user_responses WHERE timer_id = ? AND is_correct = ? ORDER BY response_time_seconds ASC`,
    [timerId, isCorrect]
  );
}

/**
 * Get response statistics for a timer
 *
 * @param {string} timerId - Timer ID
 * @returns {Promise<Object>} Stats object { total, correct, wrong, correctRate }
 */
async function getResponseStats(timerId) {
  const rows = await query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
       SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) as wrong
     FROM timer_user_responses
     WHERE timer_id = ?`,
    [timerId]
  );

  const stats = rows[0] || { total: 0, correct: 0, wrong: 0 };
  const total = Number(stats.total || 0);
  const correct = Number(stats.correct || 0);
  const wrong = Number(stats.wrong || 0);

  return {
    total,
    correct,
    wrong,
    correctRate: total > 0 ? ((correct / total) * 100).toFixed(1) : "0.0",
  };
}

/**
 * Get user's answer history across all timers
 *
 * @param {string} username - YouTube username
 * @param {number} limit - Max results (default: 50)
 * @returns {Promise<Array>} Array of user's responses with timer info
 */
async function getUserAnswerHistory(username, limit = 50) {
  return await query(
    `SELECT
       tur.timer_id,
       tur.response_time_seconds,
       tur.message,
       tur.is_correct,
       tur.created_at,
       tr.video_id,
       tr.date,
       tr.duration,
       tr.question_type,
       tr.correct_answer
     FROM timer_user_responses tur
     JOIN timer_rankings tr ON tur.timer_id = tr.timer_id
     WHERE tur.username = ?
     ORDER BY tur.created_at DESC
     LIMIT ?`,
    [username, limit]
  );
}

/**
 * Get all user responses (for database viewer)
 *
 * @param {number} limit - Max results (default: 100)
 * @returns {Promise<Array>} Array of all user responses
 */
async function getAllUserResponses(limit = 100) {
  return await query(
    `SELECT * FROM timer_user_responses ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

module.exports = {
  generateTimerId,
  parseTimerId,
  createTimerRanking,
  saveRankingEntries,
  endTimerRanking,
  getTimerRanking,
  getRankingsBySession,
  getRankingsByVideoId,
  getRankingsByDate,
  getRankingEntries,
  getAllTimerRankings,
  getTopRankingsByUser,
  getRankingStats,
  getTimerRankingCount,
  deleteTimerRanking,
  // User response tracking (v3.8)
  saveAllUserResponses,
  getUserResponses,
  getResponseStats,
  getUserAnswerHistory,
  getAllUserResponses,
  // Answer distribution (v3.9)
  saveAnswerDistribution,
  getAnswerDistribution,
};
