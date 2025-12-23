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
const WAL_FILE = path.join(DATA_DIR, "quiz.duckdb.wal");

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

// 2. Remove stale WAL file
try {
  if (fs.existsSync(WAL_FILE)) {
    fs.unlinkSync(WAL_FILE);
    console.log("[Cleanup] Removed stale WAL file");
  }
} catch (err) {
  console.log("[Cleanup] WAL cleanup skipped:", err.message);
}

console.log("[Cleanup] Done");
