/**
 * Quick terminal database viewer.
 *
 * Usage: node view-db.js
 */

const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js/dist/sql-asm.js");

const DB_PATH = path.join(__dirname, "data/quiz.db");

async function viewDatabase() {
  console.log("\nINFINITY QUIZ DATABASE\n");
  console.log("=".repeat(60));

  if (!fs.existsSync(DB_PATH)) {
    console.log("Database file not found at:", DB_PATH);
    return;
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  function query(sql) {
    try {
      const stmt = db.prepare(sql);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      console.error(`Query error: ${err.message}`);
      return [];
    }
  }

  const tables = query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  console.log("\nTABLES");
  console.table(tables);

  const stats = query(`
    SELECT
      (SELECT COUNT(*) FROM videos) as videos,
      (SELECT COUNT(*) FROM quiz_sessions) as sessions,
      (SELECT COUNT(*) FROM quiz_runs) as questions,
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM quiz_responses) as responses,
      (SELECT COUNT(*) FROM quiz_response_attempts) as attempts,
      (SELECT COUNT(*) FROM session_scores) as score_rows
  `);
  console.log("\nSUMMARY");
  console.table(stats);

  const recentSessions = query(`
    SELECT session_id, video_id, started_at, ended_at, total_runs, total_responses, total_correct
    FROM quiz_sessions
    ORDER BY started_at DESC
    LIMIT 10
  `);
  console.log("\nRECENT SESSIONS");
  console.table(recentSessions);

  const recentRuns = query(`
    SELECT run_id, session_id, duration_seconds, question_type, correct_answer,
           total_responses, correct_count, wrong_count, started_at, finalized_at
    FROM quiz_runs
    ORDER BY started_at DESC
    LIMIT 10
  `);
  console.log("\nRECENT QUESTIONS");
  console.table(recentRuns);

  const recentResponses = query(`
    SELECT run_id, username, raw_answer, is_correct, answer_count, response_time_ms, question_rank
    FROM quiz_responses
    ORDER BY first_answered_at DESC
    LIMIT 10
  `);
  console.log("\nRECENT RESPONSES");
  console.table(recentResponses);

  const latestSession = recentSessions[0]?.session_id;
  if (latestSession) {
    const leaderboard = query(`
      SELECT
        username,
        total_points,
        correct_answers,
        total_answers,
        CASE
          WHEN correct_answers > 0 THEN total_correct_response_time_ms / correct_answers
          ELSE 0
        END as avg_response_time_ms
      FROM session_scores
      WHERE session_id = '${latestSession.replace(/'/g, "''")}'
      ORDER BY total_points DESC, avg_response_time_ms ASC, correct_answers DESC, username ASC
      LIMIT 10
    `);
    console.log("\nLATEST SESSION LEADERBOARD");
    console.table(leaderboard);
  }

  db.close();
}

viewDatabase().catch(console.error);
