/**
 * Quiz lifecycle storage for the optimized schema.
 *
 * This module is the source of truth for video sessions, question runs,
 * response attempts, first responses, and cumulative session scores.
 */

const { query, run, transaction } = require("./index");

const POINTS_PER_CORRECT = 4;
const idSequences = {
  S: 0,
  Q: 0,
};

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function formatLocalTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}

function generateReadableId(prefix, date = new Date()) {
  idSequences[prefix] = (idSequences[prefix] || 0) + 1;
  return `${prefix}-${formatLocalTimestamp(date)}-${pad(idSequences[prefix], 3)}`;
}

function parseReadableId(id) {
  const match = /^([A-Z])-([0-9]{8})-([0-9]{6})-([0-9]{3})$/.exec(id || "");
  if (!match) return null;

  const [, prefix, date, time, sequence] = match;
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const hours = time.slice(0, 2);
  const minutes = time.slice(2, 4);
  const seconds = time.slice(4, 6);

  return {
    prefix,
    sequence,
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`,
    display: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`,
  };
}

function normalizeAnswer(answer) {
  return String(answer || "").trim().toUpperCase();
}

function getMcqOption(answer) {
  const firstChar = normalizeAnswer(answer).charAt(0);
  return ["A", "B", "C", "D"].includes(firstChar) ? firstChar : null;
}

function getResponseTimeMs(receivedAt, startedAt) {
  const receivedTime = receivedAt instanceof Date ? receivedAt : new Date(receivedAt);
  const startTime = startedAt instanceof Date ? startedAt : new Date(startedAt);
  return Math.max(0, Math.round(receivedTime.getTime() - startTime.getTime()));
}

function toLegacyRun(row) {
  if (!row) return null;
  return {
    timer_id: row.run_id,
    run_id: row.run_id,
    session_id: row.session_id,
    video_id: row.video_id,
    date: row.date,
    duration: row.duration_seconds,
    duration_seconds: row.duration_seconds,
    question_type: row.question_type,
    correct_answer: row.correct_answer,
    started_at: row.started_at,
    ended_at: row.ended_at || row.finalized_at,
    finalized_at: row.finalized_at,
    total_participants: row.correct_count,
    total_responses: row.total_responses,
    correct_count: row.correct_count,
    wrong_count: row.wrong_count,
    answer_count_a: row.answer_count_a,
    answer_count_b: row.answer_count_b,
    answer_count_c: row.answer_count_c,
    answer_count_d: row.answer_count_d,
  };
}

function toLegacyResponse(row) {
  if (!row) return null;
  return {
    timer_id: row.run_id,
    run_id: row.run_id,
    username: row.username,
    response_time_seconds: Number(row.response_time_ms || 0) / 1000,
    response_time_ms: row.response_time_ms,
    message: row.raw_answer,
    raw_answer: row.raw_answer,
    normalized_answer: row.normalized_answer,
    mcq_option: row.mcq_option,
    is_correct: row.is_correct,
    answer_count: row.answer_count,
    rank: row.question_rank,
    question_rank: row.question_rank,
    created_at: row.first_answered_at,
    first_answered_at: row.first_answered_at,
    last_answered_at: row.last_answered_at,
  };
}

function toLeaderboardRow(row) {
  return {
    username: row.username,
    total_points: Number(row.total_points || 0),
    correct_answers: Number(row.correct_answers || 0),
    total_answers: Number(row.total_answers || 0),
    avg_response_time_ms: Number(row.avg_response_time_ms || 0),
  };
}

async function createQuizSession(videoId) {
  const sessionId = generateReadableId("S");
  const now = new Date().toISOString();

  await run(
    `INSERT INTO quiz_sessions (session_id, video_id, started_at, status)
     VALUES (?, ?, ?, 'active')`,
    [sessionId, videoId, now]
  );

  console.log(`[Database] Created quiz session ${sessionId} for video ${videoId}`);
  return sessionId;
}

async function getQuizSession(sessionId) {
  const rows = await query(`SELECT * FROM quiz_sessions WHERE session_id = ?`, [
    sessionId,
  ]);
  return rows[0] || null;
}

async function getActiveSessionByVideoId(videoId) {
  const rows = await query(
    `SELECT * FROM quiz_sessions
     WHERE video_id = ? AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [videoId]
  );
  return rows[0] || null;
}

async function getOrCreateQuizSession(videoId) {
  const existing = await getActiveSessionByVideoId(videoId);
  if (existing) return existing.session_id;
  return createQuizSession(videoId);
}

async function getLatestSessionIdForVideo(videoId) {
  const rows = await query(
    `SELECT session_id FROM quiz_sessions
     WHERE video_id = ?
     ORDER BY started_at DESC
     LIMIT 1`,
    [videoId]
  );
  return rows[0]?.session_id || null;
}

async function resolveSessionId(idOrVideoId) {
  if (!idOrVideoId) return null;
  if (String(idOrVideoId).startsWith("S-")) return idOrVideoId;
  return getLatestSessionIdForVideo(idOrVideoId);
}

async function endQuizSession(sessionId) {
  await run(
    `UPDATE quiz_sessions
     SET ended_at = ?, status = 'ended'
     WHERE session_id = ?`,
    [new Date().toISOString(), sessionId]
  );
}

async function recordUserActivity(sessionId, username) {
  const now = new Date().toISOString();
  await run(
    `INSERT INTO user_sessions (username, session_id, message_count, first_message_at, last_message_at)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(username, session_id) DO UPDATE SET
       message_count = message_count + 1,
       last_message_at = excluded.last_message_at`,
    [username, sessionId, now, now]
  );
}

async function createQuizRun(sessionId, videoId, durationSeconds, questionType = "mcq", runId = null) {
  const now = new Date();
  const startedAt = now.toISOString();
  const id = runId || generateReadableId("Q", now);

  await transaction(async () => {
    await run(
      `INSERT INTO quiz_runs
       (run_id, session_id, video_id, date, duration_seconds, question_type, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        videoId,
        startedAt.split("T")[0],
        durationSeconds,
        questionType,
        startedAt,
      ]
    );

    await run(
      `UPDATE quiz_sessions
       SET total_runs = total_runs + 1
       WHERE session_id = ?`,
      [sessionId]
    );
  });

  console.log(`[Database] Created quiz run ${id} (${durationSeconds}s, ${questionType})`);
  return id;
}

async function recordResponseAttempt(runId, username, answer, receivedAt, startedAt) {
  if (!runId || !username || !answer || !startedAt) return;

  const runRows = await query(
    `SELECT finalized_at FROM quiz_runs WHERE run_id = ?`,
    [runId]
  );
  const shouldUpdateFirstResponse = runRows.length > 0 && !runRows[0].finalized_at;
  if (runRows.length === 0) return;

  const rawAnswer = String(answer).trim();
  const normalizedAnswer = normalizeAnswer(rawAnswer);
  const mcqOption = getMcqOption(rawAnswer);
  const answeredAt = (receivedAt instanceof Date ? receivedAt : new Date(receivedAt)).toISOString();
  const responseTimeMs = getResponseTimeMs(receivedAt, startedAt);

  await transaction(async () => {
    await run(
      `INSERT INTO quiz_response_attempts
       (run_id, username, raw_answer, normalized_answer, mcq_option, attempted_at, response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [runId, username, rawAnswer, normalizedAnswer, mcqOption, answeredAt, responseTimeMs]
    );

    if (!shouldUpdateFirstResponse) {
      return;
    }

    await run(
      `INSERT INTO quiz_responses
       (run_id, username, raw_answer, normalized_answer, mcq_option, first_answered_at,
        last_answered_at, answer_count, response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(run_id, username) DO UPDATE SET
         answer_count = answer_count + 1,
         last_answered_at = excluded.last_answered_at`,
      [
        runId,
        username,
        rawAnswer,
        normalizedAnswer,
        mcqOption,
        answeredAt,
        answeredAt,
        responseTimeMs,
      ]
    );
  });
}

async function upsertResponseSnapshot(runId, responses) {
  if (!responses || responses.length === 0) return 0;

  const runRows = await query(`SELECT started_at FROM quiz_runs WHERE run_id = ?`, [runId]);
  const startedAt = runRows[0]?.started_at || new Date().toISOString();
  let saved = 0;

  await transaction(async () => {
    for (const response of responses) {
      const responseTimeSeconds = Number(response.responseTime || 0);
      const responseTimeMs = Number.isFinite(responseTimeSeconds)
        ? Math.max(0, Math.round(responseTimeSeconds * 1000))
        : 0;
      const answeredAt = new Date(new Date(startedAt).getTime() + responseTimeMs).toISOString();
      const rawAnswer = String(response.message || "").trim();
      const normalizedAnswer = normalizeAnswer(rawAnswer);
      const answerCount = Number(response.responseCount || response.answerCount || 1);

      await run(
        `INSERT INTO quiz_responses
         (run_id, username, raw_answer, normalized_answer, mcq_option, first_answered_at,
          last_answered_at, answer_count, response_time_ms, is_correct)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id, username) DO UPDATE SET
           answer_count = MAX(answer_count, excluded.answer_count),
           is_correct = excluded.is_correct`,
        [
          runId,
          response.author,
          rawAnswer,
          normalizedAnswer,
          getMcqOption(rawAnswer),
          answeredAt,
          answeredAt,
          answerCount,
          responseTimeMs,
          response.isCorrect ? 1 : 0,
        ]
      );
      saved += 1;
    }
  });

  return saved;
}

async function finalizeQuizRun(runId, correctAnswer) {
  const runRows = await query(`SELECT * FROM quiz_runs WHERE run_id = ?`, [runId]);
  const quizRun = runRows[0];
  if (!quizRun) {
    throw new Error(`Quiz run not found: ${runId}`);
  }

  const responses = await query(
    `SELECT * FROM quiz_responses
     WHERE run_id = ?
     ORDER BY response_time_ms ASC, first_answered_at ASC, username ASC`,
    [runId]
  );

  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer);
  const isMCQ = quizRun.question_type === "mcq";
  let rank = 0;
  let correctCount = 0;
  let wrongCount = 0;
  const counts = { A: 0, B: 0, C: 0, D: 0 };

  await transaction(async () => {
    for (const response of responses) {
      const isCorrect = isMCQ
        ? response.mcq_option === normalizedCorrectAnswer.charAt(0)
        : response.normalized_answer === normalizedCorrectAnswer;
      const questionRank = isCorrect ? ++rank : null;
      const points = isCorrect ? POINTS_PER_CORRECT : 0;

      if (response.mcq_option && counts[response.mcq_option] !== undefined) {
        counts[response.mcq_option] += 1;
      }
      if (isCorrect) correctCount += 1;
      else wrongCount += 1;

      await run(
        `UPDATE quiz_responses
         SET is_correct = ?,
             question_rank = ?,
             points_awarded = ?
         WHERE run_id = ? AND username = ?`,
        [isCorrect ? 1 : 0, questionRank, points, runId, response.username]
      );

      await run(
        `INSERT INTO session_scores
         (session_id, video_id, username, total_points, correct_answers, total_answers,
          total_correct_response_time_ms, last_updated)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(session_id, username) DO UPDATE SET
           total_points = total_points + excluded.total_points,
           correct_answers = correct_answers + excluded.correct_answers,
           total_answers = total_answers + 1,
           total_correct_response_time_ms =
             total_correct_response_time_ms + excluded.total_correct_response_time_ms,
           last_updated = excluded.last_updated`,
        [
          quizRun.session_id,
          quizRun.video_id,
          response.username,
          points,
          isCorrect ? 1 : 0,
          isCorrect ? Number(response.response_time_ms || 0) : 0,
          new Date().toISOString(),
        ]
      );
    }

    const finalizedAt = new Date().toISOString();
    await run(
      `UPDATE quiz_runs
       SET ended_at = COALESCE(ended_at, ?),
           finalized_at = ?,
           correct_answer = ?,
           total_responses = ?,
           correct_count = ?,
           wrong_count = ?,
           answer_count_a = ?,
           answer_count_b = ?,
           answer_count_c = ?,
           answer_count_d = ?
       WHERE run_id = ?`,
      [
        finalizedAt,
        finalizedAt,
        normalizedCorrectAnswer,
        responses.length,
        correctCount,
        wrongCount,
        counts.A,
        counts.B,
        counts.C,
        counts.D,
        runId,
      ]
    );

    await run(
      `UPDATE quiz_sessions
       SET total_responses = total_responses + ?,
           total_correct = total_correct + ?
       WHERE session_id = ?`,
      [responses.length, correctCount, quizRun.session_id]
    );

    await run(
      `UPDATE videos
       SET questions_asked = questions_asked + 1
       WHERE video_id = ?`,
      [quizRun.video_id]
    );
  });

  return {
    runId,
    sessionId: quizRun.session_id,
    videoId: quizRun.video_id,
    totalResponses: responses.length,
    correctCount,
    wrongCount,
    answerDistribution: {
      A: counts.A,
      B: counts.B,
      C: counts.C,
      D: counts.D,
      total: counts.A + counts.B + counts.C + counts.D,
      correctAnswer: normalizedCorrectAnswer,
    },
  };
}

async function getQuestionLeaderboard(runId, limit = 50) {
  const rows = await query(
    `SELECT *
     FROM quiz_responses
     WHERE run_id = ? AND is_correct = 1
     ORDER BY question_rank ASC, response_time_ms ASC
     LIMIT ?`,
    [runId, limit]
  );

  return rows.map(toLegacyResponse);
}

async function getSessionLeaderboard(idOrVideoId, limit = 100) {
  const sessionId = await resolveSessionId(idOrVideoId);
  if (!sessionId) return [];

  const rows = await query(
    `SELECT
       username,
       total_points,
       correct_answers,
       total_answers,
       CASE
         WHEN correct_answers > 0 THEN total_correct_response_time_ms / correct_answers
         ELSE 0
       END AS avg_response_time_ms
     FROM session_scores
     WHERE session_id = ?
     ORDER BY
       total_points DESC,
       avg_response_time_ms ASC,
       correct_answers DESC,
       username ASC
     LIMIT ?`,
    [sessionId, limit]
  );

  return rows.map(toLeaderboardRow);
}

async function getSessionQuestionCount(idOrVideoId) {
  const sessionId = await resolveSessionId(idOrVideoId);
  if (!sessionId) return 0;
  const rows = await query(
    `SELECT COUNT(*) as count FROM quiz_runs WHERE session_id = ? AND finalized_at IS NOT NULL`,
    [sessionId]
  );
  return Number(rows[0]?.count || 0);
}

module.exports = {
  POINTS_PER_CORRECT,
  generateReadableId,
  parseReadableId,
  normalizeAnswer,
  getMcqOption,
  toLegacyRun,
  toLegacyResponse,
  createQuizSession,
  getQuizSession,
  getOrCreateQuizSession,
  getLatestSessionIdForVideo,
  resolveSessionId,
  endQuizSession,
  recordUserActivity,
  createQuizRun,
  recordResponseAttempt,
  upsertResponseSnapshot,
  finalizeQuizRun,
  getQuestionLeaderboard,
  getSessionLeaderboard,
  getSessionQuestionCount,
};
