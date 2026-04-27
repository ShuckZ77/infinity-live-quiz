/**
 * Cross-Platform Cleanup Script
 *
 * Handles port cleanup and WAL file removal for both Windows and macOS/Linux.
 * Called as predev script in package.json.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const DATA_DIR = path.join(__dirname, "../server/data");
const STALE_DB_FILES = [
  "quiz.db-wal",
  "quiz.db-shm",
  "quiz.db-journal",
  "quiz.duckdb.wal",
].map((file) => path.join(DATA_DIR, file));

console.log("[Cleanup] Starting...");

// 1. Kill process on port 3001
try {
  if (process.platform === "win32") {
    // Windows: Use netstat and taskkill
    try {
      const result = execSync(`netstat -ano | findstr :${PORT}`, {
        encoding: "utf-8",
      });
      const lines = result
        .split("\n")
        .filter((line) => line.includes("LISTENING"));
      lines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          console.log(`[Cleanup] Killing PID ${pid} on port ${PORT}`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        }
      });
    } catch (e) {
      // No process on port - that's fine
    }
  } else {
    // macOS/Linux: Use lsof
    try {
      execSync(`lsof -ti :${PORT} | xargs kill -9 2>/dev/null`, {
        stdio: "ignore",
      });
      console.log(`[Cleanup] Killed process on port ${PORT}`);
    } catch (e) {
      // No process on port - that's fine
    }
  }
} catch (err) {
  console.log("[Cleanup] Port cleanup skipped:", err.message);
}

// 2. Remove stale database sidecar files
try {
  for (const file of STALE_DB_FILES) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`[Cleanup] Removed stale database file: ${path.basename(file)}`);
    }
  }
} catch (err) {
  console.log("[Cleanup] Database sidecar cleanup skipped:", err.message);
}

console.log("[Cleanup] Done");
