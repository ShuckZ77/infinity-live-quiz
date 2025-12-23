/**
 * Session Database Operations
 *
 * Handles YouTube live session tracking and user-session relationships.
 * Tracks timer usage statistics per session.
 *
 * USAGE:
 *   const sessions = require('./database/sessions');
 *   const sessionId = await sessions.createSession('VIDEO_ID');
 *   await sessions.incrementTimerCount(sessionId, 60);
 *   await sessions.recordUserActivity(sessionId, 'username');
 *
 * EXPORTS:
 *   - createSession(videoId): Create new session record
 *   - getSession(id): Get session by ID
 *   - getSessionByVideoId(videoId): Get active session for video
 *   - endSession(id): Mark session as ended
 *   - incrementTimerCount(id, duration): Increment timer counter
 *   - recordUserActivity(sessionId, username): Track user in session
 *   - getSessionStats(id): Get session statistics
 */

const { query, run } = require("./index");

/**
 * Create a new session for a YouTube video
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<number>} New session ID
 */
async function createSession(videoId) {
  const now = new Date().toISOString();

  await run(
    `INSERT INTO sessions (video_id, started_at) VALUES (?, ?)`,
    [videoId, now]
  );

  // Get the created session ID
  const rows = await query(
    `SELECT id FROM sessions WHERE video_id = ? ORDER BY id DESC LIMIT 1`,
    [videoId]
  );

  const sessionId = rows[0]?.id;
  console.log(`[Database] Created session ${sessionId} for video ${videoId}`);
  return sessionId;
}

/**
 * Get session by ID
 *
 * @param {number} id - Session ID
 * @returns {Promise<Object|null>} Session object or null
 */
async function getSession(id) {
  const rows = await query(`SELECT * FROM sessions WHERE id = ?`, [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get the most recent active session for a video
 * (where ended_at is NULL)
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object|null>} Active session or null
 */
async function getSessionByVideoId(videoId) {
  const rows = await query(
    `SELECT * FROM sessions WHERE video_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1`,
    [videoId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get or create session for a video
 * Returns existing active session or creates new one
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<number>} Session ID
 */
async function getOrCreateSession(videoId) {
  const existing = await getSessionByVideoId(videoId);
  if (existing) {
    return existing.id;
  }
  return await createSession(videoId);
}

/**
 * Mark a session as ended
 *
 * @param {number} id - Session ID
 * @returns {Promise<void>}
 */
async function endSession(id) {
  const now = new Date().toISOString();
  await run(
    `UPDATE sessions SET ended_at = ? WHERE id = ?`,
    [now, id]
  );
  console.log(`[Database] Ended session ${id}`);
}

/**
 * Increment timer count for a specific duration
 *
 * @param {number} sessionId - Session ID
 * @param {number} duration - Timer duration (30, 60, 120, or 180)
 * @returns {Promise<void>}
 */
async function incrementTimerCount(sessionId, duration) {
  const columnMap = {
    30: "timer_count_30s",
    60: "timer_count_60s",
    120: "timer_count_120s",
    180: "timer_count_180s",
  };

  const column = columnMap[duration];
  if (!column) {
    console.warn(`[Database] Unknown timer duration: ${duration}`);
    return;
  }

  await run(
    `UPDATE sessions SET ${column} = ${column} + 1, total_timer_runs = total_timer_runs + 1 WHERE id = ?`,
    [sessionId]
  );

  console.log(`[Database] Incremented ${column} for session ${sessionId}`);
}

/**
 * Record user activity in a session
 * Called when a user sends a message during a session
 *
 * @param {number} sessionId - Session ID
 * @param {string} username - YouTube username
 * @returns {Promise<void>}
 */
async function recordUserActivity(sessionId, username) {
  const now = new Date().toISOString();

  await run(
    `
    INSERT INTO user_sessions (username, session_id, message_count, first_message_at, last_message_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT (username, session_id) DO UPDATE SET
      message_count = message_count + 1,
      last_message_at = ?
    `,
    [username, sessionId, now, now, now]
  );
}

/**
 * Get session statistics including user participation
 *
 * @param {number} sessionId - Session ID
 * @returns {Promise<Object>} Session stats
 */
async function getSessionStats(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const userStats = await query(
    `
    SELECT
      COUNT(DISTINCT username) as unique_users,
      SUM(message_count) as total_messages,
      AVG(message_count) as avg_messages_per_user
    FROM user_sessions
    WHERE session_id = ?
    `,
    [sessionId]
  );

  // Convert BigInt to Number for JSON serialization
  return {
    ...session,
    unique_users: Number(userStats[0]?.unique_users || 0),
    total_messages: Number(userStats[0]?.total_messages || 0),
    avg_messages_per_user: Number(userStats[0]?.avg_messages_per_user || 0),
  };
}

/**
 * Get all sessions
 *
 * @param {number} limit - Max results (default: 50)
 * @returns {Promise<Array>} Array of sessions
 */
async function getAllSessions(limit = 50) {
  return await query(
    `SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Get users who participated in a session
 *
 * @param {number} sessionId - Session ID
 * @returns {Promise<Array>} Array of user activity records
 */
async function getSessionUsers(sessionId) {
  return await query(
    `
    SELECT
      us.*,
      u.total_comment_count as lifetime_messages
    FROM user_sessions us
    JOIN users u ON us.username = u.username
    WHERE us.session_id = ?
    ORDER BY us.message_count DESC
    `,
    [sessionId]
  );
}

/**
 * Get timer usage summary across all sessions
 *
 * @returns {Promise<Object>} Timer usage stats
 */
async function getTimerStats() {
  const rows = await query(`
    SELECT
      SUM(timer_count_30s) as total_30s,
      SUM(timer_count_60s) as total_60s,
      SUM(timer_count_120s) as total_120s,
      SUM(timer_count_180s) as total_180s,
      SUM(total_timer_runs) as total_runs,
      COUNT(*) as total_sessions
    FROM sessions
  `);
  const stats = rows[0] || {};
  // Convert BigInt to Number for JSON serialization
  return {
    total_30s: Number(stats.total_30s || 0),
    total_60s: Number(stats.total_60s || 0),
    total_120s: Number(stats.total_120s || 0),
    total_180s: Number(stats.total_180s || 0),
    total_runs: Number(stats.total_runs || 0),
    total_sessions: Number(stats.total_sessions || 0),
  };
}

/**
 * Get session count
 *
 * @returns {Promise<number>} Total number of sessions
 */
async function getSessionCount() {
  const rows = await query(`SELECT COUNT(*) as count FROM sessions`);
  return Number(rows[0]?.count || 0);
}

module.exports = {
  createSession,
  getSession,
  getSessionByVideoId,
  getOrCreateSession,
  endSession,
  incrementTimerCount,
  recordUserActivity,
  getSessionStats,
  getAllSessions,
  getSessionUsers,
  getTimerStats,
  getSessionCount,
};
