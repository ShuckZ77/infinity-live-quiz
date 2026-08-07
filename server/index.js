/**
 * YouTube Live Chat Quiz/Competition System - Server
 *
 * The app stores live quiz data locally first:
 * videos -> quiz_sessions -> quiz_runs -> quiz_responses -> session_scores.
 * Public socket events and API route names stay stable for the React client.
 */

// ==========================================
// SECTION 1: OUTPUT SUPPRESSION
// ==========================================
// Suppress noisy library warnings for clean terminal output

const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalEmitWarning = process.emitWarning;

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

process.emitWarning = function (warning, ...args) {
  const message = warning instanceof Error ? warning.message : String(warning);
  if (message.includes("[YOUTUBEJS]") || message.includes("TimeoutNaNWarning")) {
    return;
  }
  return originalEmitWarning.call(process, warning, ...args);
};

// ==========================================
// SECTION 2: IMPORTS & SETUP
// ==========================================
const { Innertube, UniversalCache } = require("youtubei.js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Database imports
const { initDatabase, closeDatabase } = require("./database");
const users = require("./database/users");
const sessions = require("./database/sessions");
const rankings = require("./database/rankings");
const videos = require("./database/videos");
const scores = require("./database/scores");
const { renderDatabaseViewer } = require("./database/viewer");

// Quiz response window: include near-miss answers around the visible timer.
const RESPONSE_BUFFER_SECONDS = 3;
const ALLOWED_TIMER_DURATIONS = new Set([15, 30, 45, 60, 90, 120, 180]);
const RECENT_CHAT_RETENTION_MS = RESPONSE_BUFFER_SECONDS * 1000 + 2000;
const PORT = 3001;
const LISTEN_HOST = "127.0.0.1";
const MAX_CORRECT_ANSWER_LENGTH = 200;
const MAX_CHAT_AUTHOR_LENGTH = 100;
const MAX_CHAT_MESSAGE_LENGTH = 500;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function isLoopbackHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    String(hostname || "").toLowerCase()
  );
}

function isAllowedHostHeader(hostHeader) {
  if (!hostHeader || typeof hostHeader !== "string") return false;
  try {
    return isLoopbackHostname(new URL(`http://${hostHeader}`).hostname);
  } catch {
    return false;
  }
}

function isAllowedSocketOrigin(origin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      isLoopbackHostname(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function parseBoundedLimit(value, fallback, maximum = 500) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function normalizeVideoId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return YOUTUBE_VIDEO_ID_PATTERN.test(normalized) ? normalized : null;
}

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
 * - timerId: Readable runtime/question ID (Q-YYYYMMDD-HHMMSS-001)
 * - questionType: 'mcq' | 'fill-blank'
 *
 * APPROACH:
 * We use a simple object to maintain state across socket connections.
 * The userResponses Map tracks:
 * - firstResponseTime: seconds since session start, clamped at 0 (for ranking)
 * - responseCount: how many times this user commented (for duplicate detection)
 */
let session = {
  status: "idle", // 'idle' = no active session, 'running' = timer active, 'ended' = showing results
  startTime: null, // Date object when timer started
  duration: 0, // Timer duration in seconds
  userResponses: new Map(), // Map<username, { firstResponseTime, responseCount, message }>
  timerId: null, // Readable runtime/question ID.
  questionType: "mcq",
  answerSubmitted: false, // Prevents duplicate scoring and refresh re-submits.
  collectingUntil: null, // Timestamp for the 3s post-timer answer buffer.
};

let activeTimerTimeout = null;
let activeBufferTimeout = null;
const recentChatMessages = [];

// Tracks the one answer finalization currently writing rankings/scores.
let activeSubmitTimerId = null;

// Current database session ID (for the YouTube video)
let currentDbSessionId = null;

// Current video ID (stored for rankings)
let currentVideoId = null;

function getResponseTimeSeconds(receivedAt, startedAt) {
  const elapsedMs = receivedAt.getTime() - startedAt.getTime();
  return Math.max(0, elapsedMs / 1000);
}

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
    answerSubmitted: false,
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

  // High-volume streams can exceed the time window before old entries age out.
  if (recentChatMessages.length > 500) {
    recentChatMessages.splice(0, recentChatMessages.length - 500);
  }
}

function emitSessionError(io, type, message) {
  io.emit("session-error", { type, message });
}

function recordSessionResponse(author, message, receivedAt) {
  if (!session.startTime) return { isDuplicate: false, responseTime: null };

  const responseTime = getResponseTimeSeconds(receivedAt, session.startTime);

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
  return seeded;
}

function beginAnswerBuffer(io, duration) {
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
  const io = new Server(server, {
    maxHttpBufferSize: 64 * 1024,
    allowRequest: (request, callback) => {
      callback(null, isAllowedSocketOrigin(request.headers.origin));
    },
  });
  const clientDistPath = path.join(__dirname, "../client/dist");
  const clientIndexPath = path.join(clientDistPath, "index.html");

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (!isAllowedHostHeader(req.headers.host)) {
      return res.status(403).send("Forbidden");
    }

    const cspNonce = crypto.randomBytes(16).toString("base64");
    res.locals.cspNonce = cspNonce;
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'none'",
        "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "object-src 'none'",
        `script-src 'self' 'nonce-${cspNonce}'`,
        "style-src 'self' 'unsafe-inline'",
      ].join("; ")
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    if (req.path === "/db" || req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }

    next();
  });

  // Serve React build from client/dist (relative to project root)
  app.use(express.static(clientDistPath, { dotfiles: "deny", index: false }));

  app.get("/", (req, res, next) => {
    if (fs.existsSync(clientIndexPath)) {
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
      const limit = parseBoundedLimit(req.query.limit, 25);
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
    // 4.1.2: Rankings API Endpoints
    // ----------------------------------------

  // Get all timer rankings
  app.get("/api/rankings", async (req, res) => {
    try {
      const limit = parseBoundedLimit(req.query.limit, 100);
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
      const limit = parseBoundedLimit(req.query.limit, 10);
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
    // 4.1.2b: User Responses API Endpoints
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
      const limit = parseBoundedLimit(req.query.limit, 50);
      const history = await rankings.getUserAnswerHistory(
        req.params.username,
        limit
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

    // Get answer distribution for a timer
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
      res.send(await renderDatabaseViewer(res.locals.cspNonce));
    } catch (error) {
      console.error("[Database Viewer] Failed to render:", error);
      res.status(500).send("<h1>Database viewer unavailable</h1>");
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
    // If the answer was already submitted, send "idle" to prevent a stale modal on refresh.
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

    // Send existing video leaderboard on connect for page refresh.
    if (currentDbSessionId || currentVideoId) {
      scores
        .getVideoLeaderboard(currentDbSessionId || currentVideoId, 100)
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
     * 5. Generate a readable runtime/question ID
     * 6. Broadcast to all clients
     * 7. Set timeout to end session when timer completes
     * 8. Create the question/runtime record
     */
    socket.on("start-timer", async (data) => {
      const { duration, questionType } = data || {}; // duration in seconds, questionType: 'mcq' | 'fill-blank'
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

      // Generate readable runtime/question ID.
      const timerId = rankings.generateTimerId();

      // Set new session state
      session.status = "running";
      session.startTime = new Date();
      session.duration = normalizedDuration;
      session.timerId = timerId;
      session.questionType = normalizedQuestionType;

      console.log(
        `[Timer] Generated timer_id: ${timerId}, questionType: ${session.questionType}`
      );

      // Database operations
      if (currentDbSessionId) {
        try {
          // Create the question/runtime row before seeding buffered answers.
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

      const seededResponses = seedPreStartResponses();
      for (const entry of seededResponses) {
        rankings
          .recordResponseAttempt(
            timerId,
            entry.author,
            entry.message,
            entry.receivedAt,
            session.startTime
          )
          .catch((err) => {
            console.error("[Database] Failed to record buffered answer:", err.message);
          });
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
          beginAnswerBuffer(io, normalizedDuration);
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
        beginAnswerBuffer(io, session.duration);
      }
    });

    // ----------------------------------------
    // Handle: SUBMIT ANSWER
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

      const correctAnswer = answer.toUpperCase().trim();
      const isMCQ = session.questionType === "mcq";
      const isValidAnswer = isMCQ
        ? ["A", "B", "C", "D"].includes(correctAnswer)
        : correctAnswer.length > 0 &&
          correctAnswer.length <= MAX_CORRECT_ANSWER_LENGTH;

      if (!isValidAnswer) {
        socket.emit("session-error", {
          type: "invalid-answer",
          message: isMCQ
            ? "Select A, B, C, or D."
            : `Answers must be ${MAX_CORRECT_ANSWER_LENGTH} characters or fewer.`,
        });
        return;
      }

      if (session.status !== "ended") {
        console.log("[Submit] Ignoring - session not ended");
        return;
      }

      if (activeSubmitTimerId) {
        console.log(
          `[Submit] Already processing timer ${activeSubmitTimerId}; rejecting duplicate`
        );
        socket.emit("session-error", {
          type: "answer-submit-in-progress",
          message: "Answer submission is already being processed.",
        });
        return;
      }

      // Prevent refreshes or duplicate clicks from scoring the same timer twice.
      if (session.answerSubmitted) {
        console.log("[Submit] Ignoring - answer already submitted");
        socket.emit("session-error", {
          type: "answer-already-submitted",
          message: "This answer was already submitted.",
        });
        return;
      }

      const submitTimerId = session.timerId;
      activeSubmitTimerId = submitTimerId || "unknown";
      session.answerSubmitted = true;

      try {
        console.log(`\n========== CORRECT ANSWER: ${answer} ==========`);
        console.log(`[Submit] Question type: ${session.questionType}`);
        console.log(`[Submit] Total participants: ${session.userResponses.size}`);

        const allResponses = [];
        const correctUsers = [];

        session.userResponses.forEach((data, author) => {
          if (!data || !data.message) return;

          const userAnswer = data.message.toUpperCase().trim();
          const isCorrect = isMCQ
            ? userAnswer.charAt(0) === correctAnswer
            : userAnswer === correctAnswer;

          allResponses.push({
            author,
            responseTime: data.firstResponseTime,
            responseCount: data.responseCount,
            message: data.message,
            isCorrect,
          });

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

        correctUsers.sort((a, b) => a.responseTime - b.responseTime);
        const filteredRankings = correctUsers.slice(0, 25).map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

        console.log("Filtered Rankings:", filteredRankings);

        if (session.timerId) {
          // Snapshot in-memory first answers in case a background attempt write is still pending.
          await rankings.saveAllUserResponses(session.timerId, allResponses);

          const finalizedQuestion = await rankings.finalizeQuizRun(
            session.timerId,
            correctAnswer
          );

          if (finalizedQuestion?.answerDistribution) {
            answerDistribution = {
              ...finalizedQuestion.answerDistribution,
              correctAnswer,
            };
          }

          console.log(
            `[Database] Finalized ${session.timerId}: ${finalizedQuestion.correctCount}/${finalizedQuestion.totalResponses} correct`
          );
        }

        io.emit("rankings", filteredRankings);

        if (answerDistribution) {
          io.emit("answer-distribution", answerDistribution);
        }

        if (currentDbSessionId || currentVideoId) {
          const scoreScopeId = currentDbSessionId || currentVideoId;
          try {
            const leaderboard = await scores.getVideoLeaderboard(scoreScopeId, 100);
            const video = currentVideoId ? await videos.getVideo(currentVideoId) : null;

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
            emitSessionError(
              io,
              "score-update-failed",
              "Failed to save scores. Please submit the answer again."
            );
            return;
          }
        }
      } catch (error) {
        console.error("[Submit] Failed to finalize answer:", error.message);
        session.answerSubmitted = false;
        emitSessionError(
          io,
          "answer-submit-failed",
          "Failed to submit the answer. Scores were not finalized."
        );
      } finally {
        activeSubmitTimerId = null;
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
      const normalizedVideoId = normalizeVideoId(videoId);
      if (!normalizedVideoId) {
        socket.emit("video-status", {
          status: "error",
          error: "Enter a valid 11-character YouTube video ID.",
        });
        return;
      }

      console.log(`[Socket] Request to set Video ID: ${normalizedVideoId}`);

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

      currentVideoId = normalizedVideoId;

      // Create new DB session
      try {
        currentDbSessionId = await sessions.getOrCreateSession(normalizedVideoId);
        console.log(`[Server] Database session ID: ${currentDbSessionId}`);
      } catch (error) {
        console.error("[Server] Failed to create database session:", error);
        io.emit("video-status", { status: "error", error: "Database Error" });
        return;
      }

      // Start Polling
      activePoller = await fetchLiveChat(
        yt,
        normalizedVideoId,
        serverStartTime,
        io
      );
    });
  });

  console.log("[Server] Ready. Waiting for Video ID...");

  // Listen only after every socket handler is registered so early UI events
  // cannot be dropped during YouTube client initialization.
  server.listen(PORT, LISTEN_HOST, () => {
    console.log(`Web UI running at http://localhost:${PORT}`);
  });

  // ----------------------------------------
  // 4.5: Optional CLI Usage (Auto-Start)
  // ----------------------------------------
  const cliVideoId = process.argv[2];
  if (cliVideoId) {
    const normalizedCliVideoId = normalizeVideoId(cliVideoId);
    if (!normalizedCliVideoId) {
      throw new Error("CLI video ID must be an 11-character YouTube video ID.");
    }
    console.log(`[CLI] Video ID provided: ${normalizedCliVideoId}`);
    currentVideoId = normalizedCliVideoId;

    // Create DB session
    try {
      currentDbSessionId = await sessions.getOrCreateSession(normalizedCliVideoId);
      console.log(`[Server] Database session ID: ${currentDbSessionId}`);
    } catch (error) {
      console.error("[Server] Failed to create database session:", error);
    }

    // Start Polling immediately
    activePoller = await fetchLiveChat(
      yt,
      normalizedCliVideoId,
      serverStartTime,
      io
    );
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

    // Extract video metadata for the UI and local database.
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

    // Refresh video metadata periodically while the poller is active.
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
        videos.upsertVideo(videoId, { view_count: approxViews }).catch((err) => {
          console.error("[Video] Metadata database update failed:", err.message);
        });

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
          controller.stop();
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
          if (!action) continue;
          const actionType = action.type || action.constructor?.name;
          if (actionType === "AddChatItemAction") {
            const item = action.item;
            if (!item) continue;

            const author = String(
              item.author?.name?.text || item.author?.name || "Unknown"
            )
              .trim()
              .slice(0, MAX_CHAT_AUTHOR_LENGTH);
            const message = String(item.message?.text || "").slice(
              0,
              MAX_CHAT_MESSAGE_LENGTH
            );

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

              rankings
                .recordResponseAttempt(
                  session.timerId,
                  author,
                  finalMessage,
                  now,
                  session.startTime
                )
                .catch((err) => {
                  console.error(
                    "[Database] Failed to record response attempt:",
                    err.message
                  );
                });

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
              responseTime:
                responseTime !== null
                  ? Number(responseTime.toFixed(3))
                  : null,
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
    const errorMessage =
      error instanceof Error ? error.message : String(error || "Unknown error");
    if (errorMessage.includes("Live Chat is not available")) {
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
        error: "Unable to connect to this live chat.",
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
