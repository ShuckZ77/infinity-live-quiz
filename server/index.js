/**
 * YouTube Live Chat Quiz/Competition System - Server
 * v3.7.0 - Quiz Enhancement: Countdown, Question Types, Answer Filtering
 *
 * FEATURES:
 * 1. Timer-based quiz sessions (30s, 60s, 120s, 180s)
 * 2. Tracks first response time for each user
 * 3. Detects duplicate comments from same user
 * 4. Calculates rankings based on response speed
 * 5. Real-time chat display with Socket.io
 * 6. Persistent user profiles with SQLite (sql.js)
 * 7. Session tracking with timer usage stats
 * 8. Timer rankings with unique timer_id (DDMMYYHHMMSS)
 * 9. NEW v3.7: Question types (MCQ, Fill-in-blanks)
 * 10. NEW v3.7: Answer filtering (show only correct answers)
 *
 * DATABASE:
 * - Users: username, first_seen, last_active, total_comment_count
 * - Sessions: video_id, started_at, timer counts per duration
 * - User_Sessions: Links users to sessions with activity stats
 * - Timer_Rankings: Unique timer_id per quiz, stores top 50 with response times
 */

// ==========================================
// SECTION 1: OUTPUT SUPPRESSION
// ==========================================
// Suppress noisy library warnings for clean terminal output

const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

process.stdout.write = function (chunk, encoding, callback) {
  const str = chunk.toString();
  if (str.includes("[YOUTUBEJS]") || str.includes("TimeoutNaNWarning")) {
    return true;
  }
  return originalStdoutWrite.call(process.stdout, chunk, encoding, callback);
};

process.stderr.write = function (chunk, encoding, callback) {
  const str = chunk.toString();
  if (
    str.includes("[YOUTUBEJS]") ||
    str.includes("TimeoutNaNWarning") ||
    str.includes("InnertubeError")
  ) {
    return true;
  }
  return originalStderrWrite.call(process.stderr, chunk, encoding, callback);
};

process.emitWarning = () => {};

// ==========================================
// SECTION 2: IMPORTS & SETUP
// ==========================================
const { Innertube, UniversalCache } = require("youtubei.js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Database imports
const { initDatabase, closeDatabase } = require("./database");
const users = require("./database/users");
const sessions = require("./database/sessions");
const rankings = require("./database/rankings");
const videos = require("./database/videos");
const scores = require("./database/scores");

// Quiz response window: include near-miss answers around the visible timer.
const RESPONSE_BUFFER_SECONDS = 3;
const ALLOWED_TIMER_DURATIONS = new Set([15, 30, 45, 60, 90, 120, 180]);
const RECENT_CHAT_RETENTION_MS = RESPONSE_BUFFER_SECONDS * 1000 + 2000;

// ==========================================
// SECTION 3: SESSION STATE MANAGEMENT
// ==========================================
/**
 * SESSION STATE OBJECT
 *
 * This object tracks the current quiz session:
 * - status: 'idle' | 'running' | 'ended'
 * - startTime: When the timer was started (Date object)
 * - duration: How long the timer runs (in seconds)
 * - userResponses: Map of username -> { firstResponseTime, responseCount }
 * - timerId: Unique ID for this timer run (DDMMYYHHMMSS format)
 * - questionType: 'mcq' | 'fill-blank' (NEW v3.7)
 *
 * APPROACH:
 * We use a simple object to maintain state across socket connections.
 * The userResponses Map tracks:
 * - firstResponseTime: milliseconds since session start (for ranking)
 * - responseCount: how many times this user commented (for duplicate detection)
 */
let session = {
  status: "idle", // 'idle' = no active session, 'running' = timer active, 'ended' = showing results
  startTime: null, // Date object when timer started
  duration: 0, // Timer duration in seconds
  userResponses: new Map(), // Map<username, { firstResponseTime, responseCount, message }>
  timerId: null, // Unique timer ID (DDMMYYHHMMSS format)
  questionType: "mcq", // 'mcq' | 'fill-blank' (NEW v3.7)
  answerSubmitted: false, // v3.9.1: Track if answer was already submitted (prevents modal on refresh)
  collectingUntil: null, // Timestamp for the 3s post-timer answer buffer.
};

let activeTimerTimeout = null;
let activeBufferTimeout = null;
const recentChatMessages = [];

// Current database session ID (for the YouTube video)
let currentDbSessionId = null;

// Current video ID (stored for rankings)
let currentVideoId = null;

/**
 * Reset session to initial state
 * Called when starting a new timer
 */
function resetSession() {
  if (activeTimerTimeout) {
    clearTimeout(activeTimerTimeout);
    activeTimerTimeout = null;
  }
  if (activeBufferTimeout) {
    clearTimeout(activeBufferTimeout);
    activeBufferTimeout = null;
  }

  session = {
    status: "idle",
    startTime: null,
    duration: 0,
    userResponses: new Map(),
    timerId: null,
    questionType: "mcq",
    answerSubmitted: false, // v3.9.1
    collectingUntil: null,
  };
}

function addRecentChatMessage(author, message, receivedAt) {
  recentChatMessages.push({ author, message, receivedAt });

  // Keep only enough chat history to seed the 3s pre-start buffer.
  const cutoff = receivedAt.getTime() - RECENT_CHAT_RETENTION_MS;
  while (
    recentChatMessages.length > 0 &&
    recentChatMessages[0].receivedAt.getTime() < cutoff
  ) {
    recentChatMessages.shift();
  }
}

function recordSessionResponse(author, message, receivedAt) {
  if (!session.startTime) return { isDuplicate: false, responseTime: null };

  const responseTime = (receivedAt - session.startTime) / 1000;

  if (session.userResponses.has(author)) {
    const existing = session.userResponses.get(author);
    existing.responseCount += 1;
    session.userResponses.set(author, existing);
    return { isDuplicate: true, responseTime };
  }

  session.userResponses.set(author, {
    firstResponseTime: responseTime,
    responseCount: 1,
    message,
  });

  return { isDuplicate: false, responseTime };
}

function seedPreStartResponses() {
  const cutoff = session.startTime.getTime() - RESPONSE_BUFFER_SECONDS * 1000;
  const seeded = recentChatMessages.filter(
    (entry) =>
      entry.receivedAt.getTime() >= cutoff &&
      entry.receivedAt.getTime() < session.startTime.getTime()
  );

  seeded.forEach((entry) =>
    recordSessionResponse(entry.author, entry.message, entry.receivedAt)
  );

  console.log(`[Timer] Seeded ${seeded.length} pre-start buffered responses`);
}

function beginAnswerBuffer(io, duration, endedNaturally) {
  session.status = "buffering";
  session.collectingUntil = Date.now() + RESPONSE_BUFFER_SECONDS * 1000;

  console.log(
    `[Timer] Collecting final answers for ${RESPONSE_BUFFER_SECONDS}s buffer...`
  );

  io.emit("session-update", {
    status: "buffering",
    duration,
    timeRemaining: 0,
  });

  activeBufferTimeout = setTimeout(async () => {
    activeBufferTimeout = null;
    session.status = "ended";
    session.collectingUntil = null;

    console.log(`\n========== TIMER ENDED ==========`);
    console.log(`[Timer] Waiting for correct answer selection...`);
    console.log(`[Timer] Total participants: ${session.userResponses.size}`);

    io.emit("session-update", {
      status: "ended",
      duration,
      timeRemaining: 0,
    });
  }, RESPONSE_BUFFER_SECONDS * 1000);
}

// Note: calculateRankings() removed in v3.7 - rankings are now calculated
// in submit-answer handler after filtering by correct answer

// ==========================================
// SECTION 4: MAIN EXECUTION
// ==========================================
async function main() {
  const serverStartTime = new Date();
  console.log(`Server started at: ${serverStartTime.toLocaleString()}`);

  // ----------------------------------------
  // 4.0: Initialize Database
  // ----------------------------------------
  try {
    await initDatabase();
    console.log("[Server] Database ready");
  } catch (error) {
    console.error("[Server] Database initialization failed:", error);
    process.exit(1);
  }

  // ----------------------------------------
  // 4.1: Setup Web Server & Socket.io
  // ----------------------------------------
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = 3001;
  const clientDistPath = path.join(__dirname, "../client/dist");
  const clientIndexPath = path.join(clientDistPath, "index.html");

  // Serve React build from client/dist (relative to project root)
  app.use(express.static(clientDistPath));

  app.get("/", (req, res, next) => {
    if (require("fs").existsSync(clientIndexPath)) {
      return res.sendFile(clientIndexPath);
    }

    res.status(503).send(`
      <h1>Infinity Quiz UI is not built yet</h1>
      <p>Run <code>npm run install:all</code> and then <code>npm run build</code>, then restart the app.</p>
    `);
  });

  // ----------------------------------------
  // 4.1.1: API Endpoints for Database Stats
  // ----------------------------------------
  app.get("/api/stats", async (req, res) => {
    try {
      const userStats = await users.getUserStats();
      const timerStats = await sessions.getTimerStats();
      const userCount = await users.getUserCount();
      const sessionCount = await sessions.getSessionCount();

      res.json({
        users: {
          total: userCount,
          ...userStats,
        },
        sessions: {
          total: sessionCount,
          ...timerStats,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await users.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/top", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 25;
      const topUsers = await users.getTopUsers(limit);
      res.json(topUsers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sessions", async (req, res) => {
    try {
      const allSessions = await sessions.getAllSessions();
      res.json(allSessions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ----------------------------------------
  // 4.1.2: Rankings API Endpoints (NEW v3.6)
  // ----------------------------------------

  // Get all timer rankings
  app.get("/api/rankings", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const allRankings = await rankings.getAllTimerRankings(limit);
      res.json(allRankings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get ranking statistics
  app.get("/api/rankings/stats", async (req, res) => {
    try {
      const stats = await rankings.getRankingStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get rankings by video ID
  app.get("/api/rankings/video/:videoId", async (req, res) => {
    try {
      const videoRankings = await rankings.getRankingsByVideoId(
        req.params.videoId
      );
      res.json(videoRankings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get rankings by date (YYYY-MM-DD format)
  app.get("/api/rankings/date/:date", async (req, res) => {
    try {
      const dateRankings = await rankings.getRankingsByDate(req.params.date);
      res.json(dateRankings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's ranking history
  app.get("/api/rankings/user/:username", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const userRankings = await rankings.getTopRankingsByUser(
        req.params.username,
        limit
      );
      res.json(userRankings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific timer ranking with entries
  app.get("/api/rankings/:timerId", async (req, res) => {
    try {
      const timerRanking = await rankings.getTimerRanking(req.params.timerId);
      if (!timerRanking) {
        return res.status(404).json({ error: "Timer ranking not found" });
      }
      const entries = await rankings.getRankingEntries(req.params.timerId);
      res.json({
        ...timerRanking,
        entries,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ----------------------------------------
  // 4.1.2b: User Responses API Endpoints (v3.8)
  // ----------------------------------------

  // Get all user responses for a timer (correct and wrong)
  app.get("/api/rankings/:timerId/responses", async (req, res) => {
    try {
      // Filter by correct/wrong if specified
      let isCorrect = null;
      if (req.query.correct === "true") isCorrect = true;
      else if (req.query.correct === "false") isCorrect = false;

      const responses = await rankings.getUserResponses(
        req.params.timerId,
        isCorrect
      );
      const stats = await rankings.getResponseStats(req.params.timerId);
      res.json({ responses, stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's answer history across all timers
  app.get("/api/users/:username/answers", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const history = await rankings.getUserAnswerHistory(
        req.params.username,
        limit
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get answer distribution for a timer (v3.9)
  app.get("/api/rankings/:timerId/distribution", async (req, res) => {
    try {
      const distribution = await rankings.getAnswerDistribution(
        req.params.timerId
      );
      const timer = await rankings.getTimerRanking(req.params.timerId);
      res.json({
        distribution,
        correctAnswer: timer?.correct_answer || null,
        questionType: timer?.question_type || "mcq",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ----------------------------------------
  // 4.1.3: Database Viewer Endpoint
  // ----------------------------------------
  app.get("/db", async (req, res) => {
    try {
      const allUsers = await users.getAllUsers();
      const allSessions = await sessions.getAllSessions();
      const userStats = await users.getUserStats();
      const timerStats = await sessions.getTimerStats();
      const allTimerRankings = await rankings.getAllTimerRankings(50);
      const rankingStats = await rankings.getRankingStats();
      const allUserResponses = await rankings.getAllUserResponses(100); // v3.8
      const allVideos = await videos.getAllVideos(50); // v3.11

      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Database Viewer</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    h2 { color: #555; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #4a90d9; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    tr:hover { background: #f1f1f1; }
    .stats { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
    .stat-card { background: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .stat-card h3 { margin: 0 0 5px 0; color: #666; font-size: 14px; }
    .stat-card .value { font-size: 24px; font-weight: bold; color: #4a90d9; }
    .refresh { margin-bottom: 20px; }
    .refresh a { background: #4a90d9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
    .refresh a:hover { background: #357abd; }
    .timer-id { font-family: monospace; background: #e8e8e8; padding: 2px 6px; border-radius: 3px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold; }
    .badge-30 { background: #dcfce7; color: #166534; }
    .badge-60 { background: #dbeafe; color: #1e40af; }
    .badge-120 { background: #fef3c7; color: #92400e; }
    .badge-180 { background: #fce7f3; color: #9d174d; }
    .nav { margin-bottom: 20px; }
    .nav a { margin-right: 15px; color: #4a90d9; text-decoration: none; }
    .nav a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>📊 Database Viewer</h1>
  <div class="refresh"><a href="/db">🔄 Refresh</a></div>
  <div class="nav">
    <a href="#stats">Statistics</a>
    <a href="#videos">Videos</a>
    <a href="#users">Users</a>
    <a href="#sessions">Sessions</a>
    <a href="#rankings">Timer Rankings</a>
    <a href="#responses">User Responses</a>
    <a href="#timer-usage">Timer Usage</a>
  </div>

  <h2 id="stats">📈 Statistics</h2>
  <div class="stats">
    <div class="stat-card">
      <h3>Total Users</h3>
      <div class="value">${userStats.total_users}</div>
    </div>
    <div class="stat-card">
      <h3>Total Messages</h3>
      <div class="value">${userStats.total_messages}</div>
    </div>
    <div class="stat-card">
      <h3>Total Sessions</h3>
      <div class="value">${timerStats.total_sessions}</div>
    </div>
    <div class="stat-card">
      <h3>Timer Runs</h3>
      <div class="value">${timerStats.total_runs}</div>
    </div>
    <div class="stat-card">
      <h3>Ranked Timers</h3>
      <div class="value">${rankingStats.total_timer_runs}</div>
    </div>
    <div class="stat-card">
      <h3>Total Participants</h3>
      <div class="value">${rankingStats.total_participants}</div>
    </div>
  </div>

  <h2 id="videos">🎬 Videos (${allVideos.length})</h2>
  <table>
    <tr>
      <th>Video ID</th>
      <th>Channel</th>
      <th>Title</th>
      <th>Approx Views</th>
      <th>First Seen</th>
      <th>Last Seen</th>
    </tr>
    ${allVideos
      .map(
        (v) => `
    <tr>
      <td><a href="https://youtube.com/watch?v=${v.video_id}" target="_blank">${
          v.video_id
        }</a></td>
      <td>${v.channel_name || "-"}</td>
      <td>${
        v.title
          ? v.title.length > 50
            ? v.title.substring(0, 50) + "..."
            : v.title
          : "-"
      }</td>
      <td>${(v.approx_views || 0).toLocaleString()}</td>
      <td>${v.first_seen_at || "-"}</td>
      <td>${v.last_seen_at || "-"}</td>
    </tr>
    `
      )
      .join("")}
  </table>

  <h2 id="users">👥 Users (${allUsers.length})</h2>
  <table>
    <tr>
      <th>Username</th>
      <th>First Seen</th>
      <th>Last Active</th>
      <th>Total Messages</th>
    </tr>
    ${allUsers
      .map(
        (u) => `
    <tr>
      <td>${u.username}</td>
      <td>${u.first_seen || "-"}</td>
      <td>${u.last_active || "-"}</td>
      <td>${u.total_comment_count}</td>
    </tr>
    `
      )
      .join("")}
  </table>

  <h2 id="sessions">🎬 Sessions (${allSessions.length})</h2>
  <table>
    <tr>
      <th>ID</th>
      <th>Video ID</th>
      <th>Started</th>
      <th>Ended</th>
      <th>15s</th>
      <th>30s</th>
      <th>45s</th>
      <th>60s</th>
      <th>90s</th>
      <th>120s</th>
      <th>180s</th>
      <th>Total Runs</th>
    </tr>
    ${allSessions
      .map(
        (s) => `
    <tr>
      <td>${s.id}</td>
      <td>${s.video_id}</td>
      <td>${s.started_at || "-"}</td>
      <td>${s.ended_at || "<em>Active</em>"}</td>
      <td>${s.timer_count_15s || 0}</td>
      <td>${s.timer_count_30s || 0}</td>
      <td>${s.timer_count_45s || 0}</td>
      <td>${s.timer_count_60s || 0}</td>
      <td>${s.timer_count_90s || 0}</td>
      <td>${s.timer_count_120s || 0}</td>
      <td>${s.timer_count_180s || 0}</td>
      <td>${s.total_timer_runs}</td>
    </tr>
    `
      )
      .join("")}
  </table>

  <h2 id="rankings">🏆 Timer Rankings (${allTimerRankings.length})</h2>
  <table>
    <tr>
      <th>Timer ID</th>
      <th>Date</th>
      <th>Video ID</th>
      <th>Duration</th>
      <th>Type</th>
      <th>Answer</th>
      <th>Started</th>
      <th>Ended</th>
      <th>Correct</th>
      <th>Details</th>
    </tr>
    ${allTimerRankings
      .map(
        (r) => `
    <tr>
      <td><span class="timer-id">${r.timer_id}</span></td>
      <td>${r.date || "-"}</td>
      <td>${r.video_id}</td>
      <td><span class="badge badge-${r.duration}">${r.duration}s</span></td>
      <td>${r.question_type || "mcq"}</td>
      <td>${r.correct_answer || "-"}</td>
      <td>${r.started_at || "-"}</td>
      <td>${r.ended_at || "<em>Running</em>"}</td>
      <td>${r.total_participants || 0}</td>
      <td><a href="/api/rankings/${r.timer_id}">View</a></td>
    </tr>
    `
      )
      .join("")}
  </table>

  <h2 id="responses">📝 User Responses (${allUserResponses.length})</h2>
  <table>
    <tr>
      <th>Timer ID</th>
      <th>Username</th>
      <th>Response Time</th>
      <th>Message</th>
      <th>Correct</th>
      <th>Created At</th>
    </tr>
    ${allUserResponses
      .map(
        (r) => `
    <tr>
      <td><span class="timer-id">${r.timer_id}</span></td>
      <td>${r.username}</td>
      <td>${
        r.response_time_seconds
          ? Number(r.response_time_seconds).toFixed(3)
          : "-"
      }s</td>
      <td>${r.message || "-"}</td>
      <td>${r.is_correct ? "✅" : "❌"}</td>
      <td>${r.created_at || "-"}</td>
    </tr>
    `
      )
      .join("")}
  </table>

  <h2 id="timer-usage">⏱️ Timer Usage</h2>
  <div class="stats">
    <div class="stat-card">
      <h3>15s Timers</h3>
      <div class="value">${timerStats.total_15s}</div>
    </div>
    <div class="stat-card">
      <h3>30s Timers</h3>
      <div class="value">${timerStats.total_30s}</div>
    </div>
    <div class="stat-card">
      <h3>45s Timers</h3>
      <div class="value">${timerStats.total_45s}</div>
    </div>
    <div class="stat-card">
      <h3>60s Timers</h3>
      <div class="value">${timerStats.total_60s}</div>
    </div>
    <div class="stat-card">
      <h3>90s Timers</h3>
      <div class="value">${timerStats.total_90s}</div>
    </div>
    <div class="stat-card">
      <h3>120s Timers</h3>
      <div class="value">${timerStats.total_120s}</div>
    </div>
    <div class="stat-card">
      <h3>180s Timers</h3>
      <div class="value">${timerStats.total_180s}</div>
    </div>
  </div>
</body>
</html>
      `;

      res.send(html);
    } catch (error) {
      res.status(500).send(`<h1>Error</h1><pre>${error.message}</pre>`);
    }
  });

  // ----------------------------------------
  // 4.2: Socket.io Event Handlers
  // ----------------------------------------
  /**
   * SOCKET EVENTS:
   *
   * Client -> Server:
   * - 'start-timer': { duration: 30|60|120|180 } - Start a new quiz session
   * - 'stop-timer': Stop current session early
   * - 'reset-session': Reset to idle state
   *
   * Server -> Client:
   * - 'session-update': { status, timeRemaining, duration } - Session state changed
   * - 'chat-message': { timeString, author, message, isDuplicate, responseTime } - New chat message
   * - 'rankings': [{ rank, author, responseTime, responseCount, message }] - Final rankings
   */
  io.on("connection", (socket) => {
    console.log("Client connected");

    // Send current session state to newly connected client
    // v3.9.1: If answer was already submitted, send "idle" to prevent modal on refresh
    const effectiveStatus =
      session.status === "ended" && session.answerSubmitted
        ? "idle"
        : session.status;

    socket.emit("session-update", {
      status: effectiveStatus,
      duration: session.duration,
      timeRemaining: session.startTime
        ? Math.max(
            0,
            session.duration - (Date.now() - session.startTime.getTime()) / 1000
          )
        : session.duration,
    });

    // v3.12.1: Send existing video leaderboard on connect (for page refresh)
    if (currentVideoId) {
      scores
        .getVideoLeaderboard(currentVideoId, 100)
        .then((leaderboard) => {
          if (leaderboard && leaderboard.length > 0) {
            // Get questions_asked from videos table
            videos.getVideo(currentVideoId).then((video) => {
              socket.emit("session-leaderboard", {
                leaderboard,
                questionsAsked: video?.questions_asked || 0,
              });
            });
          }
        })
        .catch(() => {});
    }

    // ----------------------------------------
    // Handle: START TIMER
    // ----------------------------------------
    /**
     * When client requests to start a timer:
     * 1. Reset any previous session data
     * 2. Set status to 'running'
     * 3. Record start time
     * 4. Set duration
     * 5. Generate unique timer_id (DDMMYYHHMMSS)
     * 6. Broadcast to all clients
     * 7. Set timeout to end session when timer completes
     * 8. Increment timer count in database
     * 9. NEW v3.6: Create timer ranking record
     */
    socket.on("start-timer", async (data) => {
      const { duration, questionType } = data; // duration in seconds, questionType: 'mcq' | 'fill-blank'
      const normalizedDuration = Number(duration);
      const normalizedQuestionType =
        questionType === "fill-blank" ? "fill-blank" : "mcq";

      if (!ALLOWED_TIMER_DURATIONS.has(normalizedDuration)) {
        console.log("[Timer] Ignoring invalid duration:", duration);
        return;
      }

      console.log(
        `\n========== STARTING ${normalizedDuration}s QUIZ (${
          normalizedQuestionType
        }) ==========`
      );

      // Reset previous session
      resetSession();

      // Generate unique timer ID (DDMMYYHHMMSS format)
      const timerId = rankings.generateTimerId();

      // Set new session state
      session.status = "running";
      session.startTime = new Date();
      session.duration = normalizedDuration;
      session.timerId = timerId;
      session.questionType = normalizedQuestionType; // NEW v3.7
      seedPreStartResponses();

      console.log(
        `[Timer] Generated timer_id: ${timerId}, questionType: ${session.questionType}`
      );

      // Database operations
      if (currentDbSessionId) {
        try {
          // Increment timer count
          await sessions.incrementTimerCount(currentDbSessionId, normalizedDuration);

          // NEW v3.6: Create timer ranking record (v3.7: includes questionType)
          await rankings.createTimerRanking(
            timerId,
            currentDbSessionId,
            currentVideoId,
            normalizedDuration,
            session.questionType
          );
        } catch (error) {
          console.error("[Database] Failed to create timer ranking:", error);
        }
      }

      // Broadcast session start to ALL connected clients
      io.emit("session-update", {
        status: "running",
        duration: normalizedDuration,
        timeRemaining: normalizedDuration,
      });

      // Set timeout to enter the 3s post-timer response buffer.
      const expectedTimerId = timerId;
      activeTimerTimeout = setTimeout(async () => {
        activeTimerTimeout = null;
        // Only buffer if this exact timer is still running (not manually stopped/replaced)
        if (session.status === "running" && session.timerId === expectedTimerId) {
          beginAnswerBuffer(io, normalizedDuration, true);
        }
      }, normalizedDuration * 1000);
    });

    // ----------------------------------------
    // Handle: STOP TIMER (Manual stop)
    // ----------------------------------------
    socket.on("stop-timer", async () => {
      if (session.status === "running") {
        if (activeTimerTimeout) {
          clearTimeout(activeTimerTimeout);
          activeTimerTimeout = null;
        }
        console.log(`\n========== TIMER STOPPED MANUALLY ==========`);
        beginAnswerBuffer(io, session.duration, false);
      }
    });

    // ----------------------------------------
    // Handle: SUBMIT ANSWER (NEW v3.7)
    // ----------------------------------------
    /**
     * When host submits the correct answer:
     * 1. Filter userResponses for users who answered correctly
     * 2. Calculate rankings from filtered users
     * 3. Save to database
     * 4. Broadcast filtered rankings
     *
     * For MCQ: User's message should start with the correct option (A, B, C, D)
     * For Fill-in-blanks: Exact case-insensitive match
     */
    socket.on("submit-answer", async (data) => {
      const { answer } = data || {};

      // CRITICAL: Null check to prevent crash during live session
      if (!answer || typeof answer !== "string") {
        console.log("[Submit] Ignoring - invalid answer:", answer);
        return;
      }

      if (session.status !== "ended") {
        console.log("[Submit] Ignoring - session not ended");
        return;
      }

      // Prevent refreshes or duplicate clicks from scoring the same timer twice.
      if (session.answerSubmitted) {
        console.log("[Submit] Ignoring - answer already submitted");
        return;
      }
      session.answerSubmitted = true;

      console.log(`\n========== CORRECT ANSWER: ${answer} ==========`);
      console.log(`[Submit] Question type: ${session.questionType}`);
      console.log(`[Submit] Total participants: ${session.userResponses.size}`);

      const correctAnswer = answer.toUpperCase().trim();
      const isMCQ = session.questionType === "mcq";

      // v3.8: Build array of ALL responses with isCorrect flag
      const allResponses = [];
      const correctUsers = [];

      session.userResponses.forEach((data, author) => {
        // Safety check - skip if message is missing
        if (!data || !data.message) return;

        const userAnswer = data.message.toUpperCase().trim();

        let isCorrect = false;
        if (isMCQ) {
          // For MCQ: Check if message starts with the correct letter (A, B, C, D)
          // Also accept: "A", "A.", "A)", "A is correct", etc.
          const firstChar = userAnswer.charAt(0);
          isCorrect = firstChar === correctAnswer;
        } else {
          // For Fill-in-blanks: Exact match (case-insensitive)
          isCorrect = userAnswer === correctAnswer;
        }

        // v3.8: Add ALL responses to the array
        allResponses.push({
          author,
          responseTime: data.firstResponseTime,
          message: data.message,
          isCorrect,
        });

        // Add to correct users for rankings (existing logic)
        if (isCorrect) {
          correctUsers.push({
            author,
            responseTime: data.firstResponseTime,
            responseCount: data.responseCount,
            message: data.message,
          });
        }
      });

      console.log(`[Submit] Correct answers: ${correctUsers.length}`);
      console.log(
        `[Submit] Wrong answers: ${allResponses.length - correctUsers.length}`
      );

      // v3.9: Calculate answer distribution for MCQ questions
      let answerDistribution = null;
      if (isMCQ) {
        answerDistribution = { A: 0, B: 0, C: 0, D: 0 };
        session.userResponses.forEach((data) => {
          const firstChar = data.message.toUpperCase().trim().charAt(0);
          if (firstChar === "A") answerDistribution.A++;
          else if (firstChar === "B") answerDistribution.B++;
          else if (firstChar === "C") answerDistribution.C++;
          else if (firstChar === "D") answerDistribution.D++;
        });
        answerDistribution.total =
          answerDistribution.A +
          answerDistribution.B +
          answerDistribution.C +
          answerDistribution.D;
        answerDistribution.correctAnswer = correctAnswer;
        console.log(
          `[Submit] Answer distribution: A=${answerDistribution.A}, B=${answerDistribution.B}, C=${answerDistribution.C}, D=${answerDistribution.D}`
        );
      }

      // Sort by response time (fastest first) and add rank
      correctUsers.sort((a, b) => a.responseTime - b.responseTime);
      const filteredRankings = correctUsers
        .slice(0, 25)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

      console.log("Filtered Rankings:", filteredRankings);

      // Save to database
      if (session.timerId) {
        try {
          // v3.8: Save ALL user responses (max 200 entries)
          await rankings.saveAllUserResponses(session.timerId, allResponses);

          // Existing: Save top 50 correct answers for leaderboard
          const top50 = correctUsers.slice(0, 50).map((entry, index) => ({
            ...entry,
            rank: index + 1,
          }));
          await rankings.saveRankingEntries(session.timerId, top50);

          // v3.7: Save correct answer along with participant count
          await rankings.endTimerRanking(
            session.timerId,
            correctUsers.length,
            correctAnswer
          );

          // v3.9: Save answer distribution for MCQ questions
          if (answerDistribution) {
            await rankings.saveAnswerDistribution(
              session.timerId,
              answerDistribution
            );
          }

          console.log(
            `[Database] Saved ${top50.length} correct answers for timer ${session.timerId} (answer: ${correctAnswer})`
          );
        } catch (error) {
          console.error("[Database] Failed to save rankings:", error);
        }
      }

      // Broadcast filtered rankings to all clients
      io.emit("rankings", filteredRankings);

      // v3.9: Broadcast answer distribution for MCQ (separate event for pie chart)
      if (answerDistribution) {
        io.emit("answer-distribution", answerDistribution);
      }

      // v3.12.1: Update video scores and emit leaderboard (video_id based)
      if (currentVideoId) {
        try {
          // Build participants array from allResponses with response time
          const participants = allResponses.map((r) => ({
            username: r.author,
            isCorrect: r.isCorrect,
            responseTimeMs: r.responseTime * 1000, // Convert seconds to ms
          }));

          // Batch update all user scores
          await scores.batchUpdateScores(currentVideoId, participants);

          // Count finalized scored questions only after the answer is submitted.
          await scores.incrementQuestionsAsked(currentVideoId);

          // Get top 100 leaderboard
          const leaderboard = await scores.getVideoLeaderboard(
            currentVideoId,
            100
          );

          // Get questions_asked count
          const video = await videos.getVideo(currentVideoId);

          // Emit to all clients with questionsAsked
          io.emit("session-leaderboard", {
            leaderboard,
            questionsAsked: video?.questions_asked || 0,
          });
          console.log(
            `[Video] Emitted leaderboard with ${leaderboard.length} entries, ${
              video?.questions_asked || 0
            } questions`
          );
        } catch (error) {
          console.error("[Video] Failed to update scores:", error.message);
          session.answerSubmitted = false;
        }
      }
    });

    // ----------------------------------------
    // Handle: RESET SESSION
    // ----------------------------------------
    socket.on("reset-session", () => {
      console.log(`\n========== SESSION RESET ==========`);
      resetSession();

      io.emit("session-update", {
        status: "idle",
        duration: 0,
        timeRemaining: 0,
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  server.listen(PORT, () => {
    console.log(`Web UI running at http://localhost:${PORT}`);
  });

  // ----------------------------------------
  // 4.3: Initialize YouTube Client
  // ----------------------------------------
  const yt = await Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
    client_type: "WEB",
  });

  // Track active poller
  let activePoller = null;

  // ----------------------------------------
  // 4.4: Handle Video ID Selection via Socket
  // ----------------------------------------
  io.on("connection", (socket) => {
    // Send current video status to new client
    if (currentVideoId) {
      socket.emit("video-status", { status: "live", videoId: currentVideoId });
    } else {
      socket.emit("video-status", { status: "idle", videoId: null });
    }

    // Handle Setting Video ID
    socket.on("set-video-id", async (videoId) => {
      console.log(`[Socket] Request to set Video ID: ${videoId}`);

      // Stop existing poller
      if (activePoller) {
        activePoller.stop();
        activePoller = null;
      }

      // End previous DB session
      if (currentDbSessionId) {
        try {
          await sessions.endSession(currentDbSessionId);
        } catch (e) {
          console.error("Error ending previous session", e);
        }
        currentDbSessionId = null;
      }

      currentVideoId = videoId;

      // Create new DB session
      try {
        currentDbSessionId = await sessions.getOrCreateSession(videoId);
        console.log(`[Server] Database session ID: ${currentDbSessionId}`);
      } catch (error) {
        console.error("[Server] Failed to create database session:", error);
        io.emit("video-status", { status: "error", error: "Database Error" });
        return;
      }

      // Start Polling
      activePoller = await fetchLiveChat(yt, videoId, serverStartTime, io);
    });
  });

  console.log("[Server] Ready. Waiting for Video ID...");

  // ----------------------------------------
  // 4.5: Optional CLI Usage (Auto-Start)
  // ----------------------------------------
  const cliVideoId = process.argv[2];
  if (cliVideoId) {
    console.log(`[CLI] Video ID provided: ${cliVideoId}`);
    currentVideoId = cliVideoId;

    // Create DB session
    try {
      currentDbSessionId = await sessions.getOrCreateSession(cliVideoId);
      console.log(`[Server] Database session ID: ${currentDbSessionId}`);
    } catch (error) {
      console.error("[Server] Failed to create database session:", error);
    }

    // Start Polling immediately
    activePoller = await fetchLiveChat(yt, cliVideoId, serverStartTime, io);
  }
}

// ==========================================
// SECTION 5: LIVE CHAT POLLING
// ==========================================
/**
 * Fetches live chat messages and processes them
 *
 * APPROACH FOR QUIZ TRACKING:
 * 1. For each incoming message, calculate response time from session start
 * 2. Check if user has responded before (duplicate detection)
 * 3. If first response, record in userResponses Map
 * 4. If duplicate, increment count but don't update response time
 * 5. Emit message with isDuplicate flag
 * 6. NEW: Update user profile in database
 * 7. NEW: Record user activity in current session
 */
async function fetchLiveChat(yt, videoId, serverStartTime, io) {
  let isRunning = true;

  // Values exposed for the stop function
  const controller = {
    stop: () => {
      console.log(`[Poller] Stopping chat fetch for ${videoId}`);
      isRunning = false;
    },
  };

  try {
    console.log(`Fetching info for video: ${videoId}...`);
    // Emit connecting status
    io.emit("video-status", { status: "connecting", videoId });

    const info = await yt.getInfo(videoId);
    console.log("Basic Info Title:", info.basic_info.title);

    if (!info.basic_info.is_live && !info.basic_info.is_live_content) {
      console.log("This video is not live.");
      io.emit("video-status", {
        status: "offline",
        videoId,
        error: "Not a live video",
      });
      return controller;
    }

    // ========================================
    // EXTRACT VIDEO METADATA (v3.11)
    // ========================================
    const videoMetadata = {
      channel_id: info.basic_info.channel?.id || null,
      channel_name:
        info.basic_info.author || info.basic_info.channel?.name || "Unknown",
      title: info.basic_info.title || "Untitled",
      thumbnail_url: info.basic_info.thumbnail?.[0]?.url || null,
      live_start_timestamp: info.basic_info.start_timestamp
        ? new Date(info.basic_info.start_timestamp)
        : null,
      view_count: info.basic_info.view_count || 0,
    };

    console.log(`[Video] Channel: ${videoMetadata.channel_name}`);
    console.log(`[Video] View Count: ${videoMetadata.view_count}`);

    // Store metadata in database (fire-and-forget)
    videos.upsertVideo(videoId, videoMetadata).catch((err) => {
      console.error("[Video] Failed to upsert video metadata:", err.message);
    });

    console.log("Video is live! Starting low-latency polling...");
    io.emit("video-status", {
      status: "live",
      videoId,
      title: videoMetadata.title,
      channelName: videoMetadata.channel_name,
      approxViews: videoMetadata.view_count,
      thumbnail: videoMetadata.thumbnail_url,
      liveStartTimestamp:
        videoMetadata.live_start_timestamp?.toISOString() || null,
    });

    let continuation = info.livechat?.continuation;

    if (!continuation) {
      console.error("No continuation token found. Cannot fetch chat.");
      io.emit("video-status", {
        status: "error",
        videoId,
        error: "Live chat disabled/unavailable",
      });
      return controller;
    }

    // ========================================
    // METADATA REFRESH INTERVAL (v3.11)
    // ========================================
    // Note: basic_info.view_count shows TOTAL views, not live viewers
    // Future: Implement live viewer count via getLiveChat().on('update-metadata')
    let metadataRefreshInterval = null;

    const refreshMetadata = async () => {
      if (!isRunning) return;
      try {
        const freshInfo = await yt.getInfo(videoId);

        // Use view_count as approx_views (total views, not live viewers)
        const approxViews = freshInfo.basic_info.view_count || 0;

        // Extract metadata
        const refreshedMetadata = {
          title: freshInfo.basic_info.title || "Untitled",
          channelName: freshInfo.basic_info.author || "Unknown",
          approxViews: approxViews,
        };

        console.log(
          `[Video] Metadata Refresh: ${refreshedMetadata.channelName} | approx_views: ${approxViews}`
        );

        // Update database
        videos
          .upsertVideo(videoId, { view_count: approxViews })
          .catch(() => {});

        // Emit to clients
        io.emit("video-status", {
          status: "live",
          videoId,
          title: refreshedMetadata.title,
          channelName: refreshedMetadata.channelName,
          approxViews: refreshedMetadata.approxViews,
        });
      } catch (err) {
        console.warn("[Video] Metadata refresh failed:", err.message);
      }
    };

    // Start refresh interval (every 60 seconds)
    metadataRefreshInterval = setInterval(refreshMetadata, 60000);

    // Add cleanup to controller
    const originalStop = controller.stop;
    controller.stop = () => {
      // Clear refresh interval
      if (metadataRefreshInterval) {
        clearInterval(metadataRefreshInterval);
        metadataRefreshInterval = null;
      }
      originalStop();
    };

    const poll = async () => {
      if (!isRunning) return;

      try {
        // console.log("[DEBUG] Poll cycle start. Fetching chat...");

        // Create a timeout promise to prevent indefinite hanging
        const fetchPromise = yt.actions.execute("live_chat/get_live_chat", {
          continuation,
          parse: true,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Fetch timeout")), 5000)
        );

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (!isRunning) return;

        // console.log("[DEBUG] Fetch returned. Processing...");
        const contents = response.continuation_contents;

        if (!contents) {
          // console.log("[DEBUG] No continuation contents, stopping.");
          isRunning = false;
          io.emit("video-status", { status: "ended", videoId });
          return;
        }

        continuation =
          contents.continuation?.token ||
          contents.live_chat_continuation?.continuation?.token;

        const actions = contents.actions || [];
        const actionsArray = Array.isArray(actions) ? actions : [];

        // console.log(`[DEBUG] Received ${actionsArray.length} actions.`);

        // ----------------------------------------
        // Process each chat action
        // ----------------------------------------
        for (const action of actionsArray) {
          if (
            action.type === "AddChatItemAction" ||
            action.constructor.name === "AddChatItemAction"
          ) {
            const item = action.item;
            if (!item) continue;

            const author =
              item.author?.name?.text || item.author?.name || "Unknown";
            const message = item.message?.text || "";

            if (!message) continue;

            const finalMessage = message.toLowerCase().trim();
            const now = new Date();
            addRecentChatMessage(author, finalMessage, now);

            // ----------------------------------------
            // Calculate time strings
            // ----------------------------------------
            // Time since server start (for display)
            const elapsedFromServer = (now - serverStartTime) / 1000;
            const timeString = elapsedFromServer.toFixed(3) + "s";

            // ----------------------------------------
            // DATABASE: Update user profile
            // ----------------------------------------
            // OPTIMIZATION: Fire-and-forget (Non-blocking)
            // We catch errors to prevent unhandled promise rejections
            users
              .upsertUser(author)
              .then(() => {
                if (currentDbSessionId) {
                  return sessions.recordUserActivity(
                    currentDbSessionId,
                    author
                  );
                }
              })
              .catch((err) => {
                console.error("[Database] Background update failed:", err.message);
              });

            // ----------------------------------------
            // QUIZ LOGIC: Track user responses
            // ----------------------------------------
            /**
             * If a quiz session is running:
             * 1. Calculate response time from session start
             * 2. Check if this user already responded
             * 3. If new user: record their first response
             * 4. If existing user: mark as duplicate, increment count
             */
            let isDuplicate = false;
            let responseTime = null;

            if (
              (session.status === "running" || session.status === "buffering") &&
              session.startTime
            ) {
              // Track first answers inside the visible timer plus 3s after it ends.
              const tracked = recordSessionResponse(author, finalMessage, now);
              isDuplicate = tracked.isDuplicate;
              responseTime = tracked.responseTime;

              console.log(
                `[${isDuplicate ? "DUPLICATE" : "NEW"}] [${responseTime.toFixed(
                  3
                )}s] ${author}: ${finalMessage}`
              );
            } else {
              // No active session, just log normally
              console.log(`[${timeString}] ${author}: ${finalMessage}`);
            }

            // ----------------------------------------
            // Emit message to all clients
            // ----------------------------------------
            /**
             * Message object includes:
             * - timeString: Display time from server start
             * - author: Username
             * - message: Chat text
             * - isDuplicate: Boolean flag for styling
             * - responseTime: Seconds from quiz start (or null if no quiz)
             */
            io.emit("chat-message", {
              timeString,
              author,
              message: finalMessage,
              isDuplicate,
              responseTime: responseTime !== null ? responseTime.toFixed(3) : null,
            });
          }
        }

        const pollDelay = getNextPollDelay(contents);
        setTimeout(poll, pollDelay);
      } catch (err) {
        console.error("Polling error:", err);
        setTimeout(poll, 2000);
      }
    };

    poll();
  } catch (error) {
    if (error.message.includes("Live Chat is not available")) {
      console.error("Error: Live chat not reachable.");
      io.emit("video-status", {
        status: "offline",
        videoId,
        error: "Chat unreachable",
      });
    } else {
      console.error("Error fetching live chat:", error);
      io.emit("video-status", {
        status: "error",
        videoId,
        error: error.message,
      });
    }
  }

  return controller;
}

function getNextPollDelay(contents) {
  const continuations =
    contents?.live_chat_continuation?.continuations ||
    contents?.continuations ||
    [];

  for (const item of continuations) {
    const timeoutMs =
      item?.timed_continuation_data?.timeout_ms ||
      item?.invalidation_continuation_data?.timeout_ms ||
      item?.timeout_ms;

    const parsed = Number(timeoutMs);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(250, Math.min(parsed, 5000));
    }
  }

  return 750;
}

// ==========================================
// SECTION 6: GRACEFUL SHUTDOWN
// ==========================================
// Shared shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  // End current database session
  if (currentDbSessionId) {
    try {
      await sessions.endSession(currentDbSessionId);
    } catch (error) {
      console.error("[Database] Error ending session:", error);
    }
  }

  // Close database connection
  try {
    await closeDatabase();
  } catch (error) {
    console.error("[Database] Error closing database:", error);
  }

  process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Global error handlers to capture crashes
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Execute with error handling
main().catch((err) => {
  console.error("[FATAL] Main function failed:", err);
  process.exit(1);
});
