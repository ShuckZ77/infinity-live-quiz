/**
 * Compatibility wrapper for quiz session storage.
 *
 * Public callers still use "sessions", but rows now live in quiz_sessions.
 */

const { query } = require("./index");
const quiz = require("./quiz");

async function createSession(videoId) {
  return quiz.createQuizSession(videoId);
}

async function getSession(id) {
  return quiz.getQuizSession(id);
}

async function getSessionByVideoId(videoId) {
  const rows = await query(
    `SELECT * FROM quiz_sessions
     WHERE video_id = ? AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [videoId]
  );
  return rows[0] || null;
}

async function getOrCreateSession(videoId) {
  return quiz.getOrCreateQuizSession(videoId);
}

async function endSession(id) {
  await quiz.endQuizSession(id);
  console.log(`[Database] Ended quiz session ${id}`);
}

async function recordUserActivity(sessionId, username) {
  await quiz.recordUserActivity(sessionId, username);
}

async function getSessionStats(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const rows = await query(
    `SELECT
       COUNT(DISTINCT username) as unique_users,
       SUM(message_count) as total_messages,
       AVG(message_count) as avg_messages_per_user
     FROM user_sessions
     WHERE session_id = ?`,
    [sessionId]
  );
  const stats = rows[0] || {};

  return {
    ...session,
    id: session.session_id,
    unique_users: Number(stats.unique_users || 0),
    total_messages: Number(stats.total_messages || 0),
    avg_messages_per_user: Number(stats.avg_messages_per_user || 0),
  };
}

async function getAllSessions(limit = 50) {
  return query(
    `SELECT
       session_id as id,
       session_id,
       video_id,
       started_at,
       ended_at,
       status,
       total_runs as total_timer_runs,
       total_responses,
       total_correct
     FROM quiz_sessions
     ORDER BY started_at DESC
     LIMIT ?`,
    [limit]
  );
}

async function getSessionUsers(sessionId) {
  return query(
    `SELECT
       us.*,
       u.total_comment_count as lifetime_messages
     FROM user_sessions us
     JOIN users u ON us.username = u.username
     WHERE us.session_id = ?
     ORDER BY us.message_count DESC`,
    [sessionId]
  );
}

async function getTimerStats() {
  const durationRows = await query(
    `SELECT duration_seconds, COUNT(*) as count
     FROM quiz_runs
     GROUP BY duration_seconds
     ORDER BY duration_seconds`
  );
  const totals = await query(
    `SELECT
       COUNT(*) as total_runs,
       COUNT(DISTINCT session_id) as total_sessions
     FROM quiz_runs`
  );

  const stats = {
    total_15s: 0,
    total_30s: 0,
    total_45s: 0,
    total_60s: 0,
    total_90s: 0,
    total_120s: 0,
    total_180s: 0,
    total_runs: Number(totals[0]?.total_runs || 0),
    total_sessions: Number(totals[0]?.total_sessions || 0),
  };

  for (const row of durationRows) {
    stats[`total_${row.duration_seconds}s`] = Number(row.count || 0);
  }

  return stats;
}

async function getSessionCount() {
  const rows = await query(`SELECT COUNT(*) as count FROM quiz_sessions`);
  return Number(rows[0]?.count || 0);
}

module.exports = {
  createSession,
  getSession,
  getSessionByVideoId,
  getOrCreateSession,
  endSession,
  recordUserActivity,
  getSessionStats,
  getAllSessions,
  getSessionUsers,
  getTimerStats,
  getSessionCount,
};
