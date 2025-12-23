/**
 * Database Connection & Initialization
 *
 * Manages sql.js (pure JavaScript SQLite) connection and schema initialization.
 * Uses the ASM.js build for maximum compatibility (no WASM, no ESM).
 * Creates database file at server/data/quiz.db
 *
 * USAGE:
 *   const { initDatabase } = require('./database');
 *   await initDatabase();
 *   // db is now ready to use
 *
 * EXPORTS:
 *   - initDatabase(): Initialize/create tables
 *   - closeDatabase(): Graceful shutdown
 *   - query(): Execute SELECT queries
 *   - run(): Execute INSERT/UPDATE/DELETE statements
 */

const path = require("path");
const fs = require("fs");

// Use ASM build directly (CommonJS compatible, no WASM needed)
const initSqlJs = require("sql.js/dist/sql-asm.js");

// Database file path
// Use USER_DATA_PATH if provided (Electron prod), otherwise use local data dir (Dev)
const result = process.env.USER_DATA_PATH
  ? process.env.USER_DATA_PATH
  : path.join(__dirname, "../data");

// Ensure we don't accidentally write to root if path resolution fails
const DATA_DIR = path.resolve(result);
const DB_PATH = path.join(DATA_DIR, "quiz.db");

// sql.js database instance
let db = null;
let saveInterval = null;

/**
 * Save database to disk
 */
function saveDatabase() {
  if (db) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error("[Database] Error saving:", err.message);
    }
  }
}

/**
 * Initialize database connection and create tables
 *
 * @returns {Promise<void>}
 */
async function initDatabase() {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    console.log(`[Database] Initializing SQLite at: ${DB_PATH}`);

    // Initialize sql.js (ASM build is synchronous-style but returns promise)
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log("[Database] Loaded existing database");
    } else {
      db = new SQL.Database();
      console.log("[Database] Created new database");
    }

    // Read and execute schema
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    // Remove SQL comments and split into statements
    const cleanedSchema = schema
      .split("\n")
      .map((line) => {
        // Remove single-line comments
        const commentIndex = line.indexOf("--");
        return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
      })
      .join("\n");

    // Split by semicolon and filter empty statements
    const statements = cleanedSchema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[Database] Executing ${statements.length} statements...`);

    for (const statement of statements) {
      try {
        db.run(statement + ";");
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message.includes("already exists")) {
          console.error(`[Database] Error in statement:`, err.message);
        }
      }
    }

    // Save database after schema init
    saveDatabase();

    // Auto-save every 30 seconds
    saveInterval = setInterval(saveDatabase, 30000);

    console.log("[Database] Schema initialized successfully");
  } catch (error) {
    console.error("[Database] Initialization failed:", error);
    throw error;
  }
}

/**
 * Execute a query and return results
 *
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);

      const rows = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
      }
      stmt.free();
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 *
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters
 * @returns {Promise<void>}
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    try {
      db.run(sql, params);
      // Save after each write operation
      saveDatabase();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Close database connection gracefully
 *
 * @returns {Promise<void>}
 */
function closeDatabase() {
  return new Promise((resolve) => {
    if (saveInterval) {
      clearInterval(saveInterval);
      saveInterval = null;
    }
    if (db) {
      saveDatabase();
      db.close();
      console.log("[Database] Connection closed");
    }
    resolve();
  });
}

/**
 * Get database instance
 * @returns {Database}
 */
function getDb() {
  return db;
}

/**
 * Get connection instance (for compatibility, returns db)
 * @returns {Database}
 */
function getConnection() {
  return db;
}

module.exports = {
  initDatabase,
  closeDatabase,
  query,
  run,
  getDb,
  getConnection,
  DB_PATH,
};
