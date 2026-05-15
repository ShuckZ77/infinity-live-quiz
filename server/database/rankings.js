/**
 * Compatibility wrapper for question/runtime rankings.
 *
 * Public API keeps timer/ranking names, while storage uses quiz_runs,
 * quiz_responses, and quiz_response_attempts.
 */

const { query } = require("./index");
const quiz = require("./quiz");

function generateTimerId() {
  return quiz.generateReadableId("Q");
}

function parseTimerId(timerId) {
  return quiz.parseReadableId(timerId);
}

async function createTimerRanking(timerId, sessionId, videoId, duration, questionType = "mcq") {
  return quiz.createQuizRun(sessionId, videoId, duration, questionType, timerId);
}

async function recordResponseAttempt(timerId, username, answer, receivedAt, startedAt) {
  return quiz.recordResponseAttempt(timerId, username, answer, receivedAt, startedAt);
}

async function saveAllUserResponses(timerId, responses) {
  return quiz.upsertResponseSnapshot(timerId, responses);
}

async function finalizeQuizRun(timerId, correctAnswer) {
  return quiz.finalizeQuizRun(timerId, correctAnswer);
}

async function getAnswerDistribution(timerId) {
  const rows = await query(
    `SELECT answer_count_a, answer_count_b, answer_count_c, answer_count_d
     FROM quiz_runs
     WHERE run_id = ?`,
    [timerId]
  );
  const row = rows[0] || {};
  const A = Number(row.answer_count_a || 0);
  const B = Number(row.answer_count_b || 0);
  const C = Number(row.answer_count_c || 0);
  const D = Number(row.answer_count_d || 0);
  return { A, B, C, D, total: A + B + C + D };
}

async function getTimerRanking(timerId) {
  const rows = await query(`SELECT * FROM quiz_runs WHERE run_id = ?`, [timerId]);
  return quiz.toLegacyRun(rows[0]);
}

async function getRankingsBySession(sessionId) {
  const rows = await query(
    `SELECT * FROM quiz_runs WHERE session_id = ? ORDER BY started_at DESC`,
    [sessionId]
  );
  return rows.map(quiz.toLegacyRun);
}

async function getRankingsByVideoId(videoId) {
  const rows = await query(
    `SELECT * FROM quiz_runs WHERE video_id = ? ORDER BY started_at DESC`,
    [videoId]
  );
  return rows.map(quiz.toLegacyRun);
}

async function getRankingsByDate(date) {
  const rows = await query(
    `SELECT * FROM quiz_runs WHERE date = ? ORDER BY started_at DESC`,
    [date]
  );
  return rows.map(quiz.toLegacyRun);
}

async function getRankingEntries(timerId, limit = 50) {
  return quiz.getQuestionLeaderboard(timerId, limit);
}

async function getAllTimerRankings(limit = 100) {
  const rows = await query(
    `SELECT * FROM quiz_runs ORDER BY started_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(quiz.toLegacyRun);
}

async function getTopRankingsByUser(username, limit = 10) {
  return query(
    `SELECT
       qr.run_id as timer_id,
       qr.question_rank as rank,
       qr.response_time_ms / 1000.0 as response_time_seconds,
       qr.raw_answer as message,
       q.video_id,
       q.date,
       q.duration_seconds as duration,
       q.correct_count as total_participants
     FROM quiz_responses qr
     JOIN quiz_runs q ON qr.run_id = q.run_id
     WHERE qr.username = ? AND qr.is_correct = 1
     ORDER BY qr.question_rank ASC, qr.response_time_ms ASC
     LIMIT ?`,
    [username, limit]
  );
}

async function getRankingStats() {
  const rows = await query(
    `SELECT
       COUNT(*) as total_timer_runs,
       SUM(correct_count) as total_participants,
       AVG(correct_count) as avg_participants,
       COUNT(DISTINCT video_id) as unique_videos,
       COUNT(DISTINCT date) as unique_days
     FROM quiz_runs
     WHERE finalized_at IS NOT NULL`
  );
  const stats = rows[0] || {};

  const durationRows = await query(
    `SELECT duration_seconds as duration, COUNT(*) as count
     FROM quiz_runs
     GROUP BY duration_seconds
     ORDER BY duration_seconds`
  );

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

async function getTimerRankingCount() {
  const rows = await query(`SELECT COUNT(*) as count FROM quiz_runs`);
  return Number(rows[0]?.count || 0);
}

async function getUserResponses(timerId, isCorrect = null) {
  const params = [timerId];
  let sql = `SELECT * FROM quiz_responses WHERE run_id = ?`;

  if (isCorrect !== null) {
    sql += ` AND is_correct = ?`;
    params.push(isCorrect ? 1 : 0);
  }

  sql += ` ORDER BY response_time_ms ASC, first_answered_at ASC`;
  const rows = await query(sql, params);
  return rows.map(quiz.toLegacyResponse);
}

async function getResponseStats(timerId) {
  const rows = await query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
       SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as wrong
     FROM quiz_responses
     WHERE run_id = ?`,
    [timerId]
  );
  const stats = rows[0] || {};
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

async function getUserAnswerHistory(username, limit = 50) {
  return query(
    `SELECT
       qr.run_id as timer_id,
       qr.response_time_ms / 1000.0 as response_time_seconds,
       qr.raw_answer as message,
       qr.is_correct,
       qr.first_answered_at as created_at,
       q.video_id,
       q.date,
       q.duration_seconds as duration,
       q.question_type,
       q.correct_answer
     FROM quiz_responses qr
     JOIN quiz_runs q ON qr.run_id = q.run_id
     WHERE qr.username = ?
     ORDER BY qr.first_answered_at DESC
     LIMIT ?`,
    [username, limit]
  );
}

async function getAllUserResponses(limit = 100) {
  const rows = await query(
    `SELECT * FROM quiz_responses ORDER BY first_answered_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(quiz.toLegacyResponse);
}

module.exports = {
  generateTimerId,
  parseTimerId,
  createTimerRanking,
  recordResponseAttempt,
  finalizeQuizRun,
  getTimerRanking,
  getRankingsBySession,
  getRankingsByVideoId,
  getRankingsByDate,
  getRankingEntries,
  getAllTimerRankings,
  getTopRankingsByUser,
  getRankingStats,
  getTimerRankingCount,
  saveAllUserResponses,
  getUserResponses,
  getResponseStats,
  getUserAnswerHistory,
  getAllUserResponses,
  getAnswerDistribution,
};
