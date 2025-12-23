/**
 * Quick Database Viewer
 *
 * Usage: node view-db.js
 */

const path = require("path");
const fs = require("fs");

// Use ASM build directly (CommonJS compatible)
const initSqlJs = require("sql.js/dist/sql-asm.js");

const DB_PATH = path.join(__dirname, "data/quiz.db");

async function viewDatabase() {
  console.log("\n📊 DATABASE VIEWER\n");
  console.log("=".repeat(50));

  if (!fs.existsSync(DB_PATH)) {
    console.log("❌ Database file not found at:", DB_PATH);
    return;
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Helper to run query and return results
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

  // Show tables
  console.log("\n📋 TABLES:");
  const tables = query(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  console.table(tables);

  // Show users
  console.log("\n👥 USERS (Top 10 by message count):");
  const users = query(
    "SELECT * FROM users ORDER BY total_comment_count DESC LIMIT 10"
  );
  if (users.length > 0) {
    console.table(users);
  } else {
    console.log("   (no users yet)");
  }

  // Show sessions
  console.log("\n📺 SESSIONS (Last 5):");
  const sessions = query("SELECT * FROM sessions ORDER BY id DESC LIMIT 5");
  if (sessions.length > 0) {
    console.table(sessions);
  } else {
    console.log("   (no sessions yet)");
  }

  // Show user_sessions
  console.log("\n🔗 USER_SESSIONS (Top 10 by message count):");
  const userSessions = query(
    "SELECT * FROM user_sessions ORDER BY message_count DESC LIMIT 10"
  );
  if (userSessions.length > 0) {
    console.table(userSessions);
  } else {
    console.log("   (no user sessions yet)");
  }

  // Stats
  console.log("\n📈 STATS:");
  const stats = query(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM sessions) as total_sessions,
      (SELECT COALESCE(SUM(total_comment_count), 0) FROM users) as total_messages
  `);
  console.table(stats);

  db.close();
}

viewDatabase().catch(console.error);
