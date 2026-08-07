/**
 * End-to-end smoke test for the extracted Windows release directory.
 */

const assert = require("assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const RELEASE_ROOT = path.join(ROOT, "dist-portable", "InfinityQuiz");
const SERVER_URL = "http://127.0.0.1:3001";
const { io } = require(path.join(
  ROOT,
  "client",
  "node_modules",
  "socket.io-client"
));

function waitFor(check, description, timeoutMs = 10000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${description}`));
      }
    }, 50);
  });
}

function request(pathname, host = "127.0.0.1:3001") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3001,
        path: pathname,
        method: "GET",
        headers: { Host: host },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function waitForSocketEvent(socket, event, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for socket event ${event}`));
    }, timeoutMs);

    function onEvent(data) {
      if (!predicate(data)) return;
      clearTimeout(timeout);
      socket.off(event, onEvent);
      resolve(data);
    }

    socket.on(event, onEvent);
  });
}

async function testDatabaseLifecycle(tempRoot) {
  const dataRoot = path.join(tempRoot, "database-lifecycle");
  process.env.USER_DATA_PATH = dataRoot;

  const database = require(path.join(RELEASE_ROOT, "server", "database"));
  const videos = require(path.join(RELEASE_ROOT, "server", "database", "videos"));
  const sessions = require(path.join(RELEASE_ROOT, "server", "database", "sessions"));
  const rankings = require(path.join(RELEASE_ROOT, "server", "database", "rankings"));
  const scores = require(path.join(RELEASE_ROOT, "server", "database", "scores"));

  await database.initDatabase();
  try {
    const videoId = "dQw4w9WgXcQ";
    await videos.upsertVideo(videoId, {
      channel_name: "Release Test",
      title: "Release Test Video",
      view_count: 1,
    });
    const sessionId = await sessions.getOrCreateSession(videoId);
    const runId = rankings.generateTimerId();
    const startedAt = new Date();
    await rankings.createTimerRanking(runId, sessionId, videoId, 15, "mcq");
    await rankings.recordResponseAttempt(
      runId,
      "correct-user",
      "A",
      new Date(startedAt.getTime() + 500),
      startedAt
    );
    await rankings.recordResponseAttempt(
      runId,
      "wrong-user",
      "B",
      new Date(startedAt.getTime() + 800),
      startedAt
    );

    const result = await rankings.finalizeQuizRun(runId, "A");
    assert.equal(result.totalResponses, 2);
    assert.equal(result.correctCount, 1);
    assert.equal(result.wrongCount, 1);

    const leaderboard = await scores.getSessionLeaderboard(sessionId, 10);
    assert.equal(leaderboard[0].username, "correct-user");
    assert.equal(leaderboard[0].total_points, 4);
  } finally {
    await database.closeDatabase();
    delete process.env.USER_DATA_PATH;
  }
}

async function testBlockedSocketOrigin() {
  await new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      extraHeaders: { Origin: "https://evil.example" },
      reconnection: false,
      timeout: 1500,
    });
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Disallowed socket origin was not rejected"));
    }, 2500);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error("Disallowed socket origin connected"));
    });
    socket.once("connect_error", () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    });
  });
}

async function testAllowedSocketFlow() {
  const socket = io(SERVER_URL, {
    transports: ["websocket"],
    extraHeaders: { Origin: "http://localhost:3001" },
    reconnection: false,
    timeout: 2000,
  });

  try {
    await waitForSocketEvent(socket, "connect", () => true, 3000);

    const invalidVideo = waitForSocketEvent(
      socket,
      "video-status",
      (data) => data?.status === "error"
    );
    socket.emit("set-video-id", { invalid: true });
    assert.match((await invalidVideo).error, /valid 11-character/i);

    socket.emit("start-timer", null);
    const running = waitForSocketEvent(
      socket,
      "session-update",
      (data) => data?.status === "running"
    );
    socket.emit("start-timer", { duration: 15, questionType: "mcq" });
    await running;

    const buffering = waitForSocketEvent(
      socket,
      "session-update",
      (data) => data?.status === "buffering"
    );
    socket.emit("stop-timer");
    await buffering;

    const reset = waitForSocketEvent(
      socket,
      "session-update",
      (data) => data?.status === "idle"
    );
    socket.emit("reset-session");
    await reset;
  } finally {
    socket.close();
  }
}

async function main() {
  assert.ok(fs.existsSync(path.join(RELEASE_ROOT, "server", "index.js")));
  assert.ok(fs.existsSync(path.join(RELEASE_ROOT, "client", "dist", "index.html")));
  assert.ok(fs.existsSync(path.join(RELEASE_ROOT, "MANUAL-START.txt")));

  const launcher = fs.readFileSync(
    path.join(RELEASE_ROOT, "START-INFINITY-QUIZ.bat"),
    "utf8"
  );
  assert.doesNotMatch(launcher, /powershell|start\s+""/i);
  assert.match(launcher, /http:\/\/localhost:3001/);
  assert.match(launcher, /node server\\index\.js/);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "infinity-release-test-"));
  await testDatabaseLifecycle(tempRoot);

  const serverData = path.join(tempRoot, "server-data");
  let serverOutput = "";
  const serverProcess = spawn(process.execPath, ["server/index.js"], {
    cwd: RELEASE_ROOT,
    env: { ...process.env, USER_DATA_PATH: serverData },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitFor(
      () => serverOutput.includes("Web UI running at http://localhost:3001"),
      "release server startup"
    );

    const root = await request("/");
    assert.equal(root.status, 200);
    assert.match(root.body, /<div id="root"><\/div>/);
    assert.equal(root.headers["x-powered-by"], undefined);
    assert.equal(root.headers["x-content-type-options"], "nosniff");

    const db = await request("/db");
    assert.equal(db.status, 200);
    const nonce = /script-src 'self' 'nonce-([^']+)'/.exec(
      db.headers["content-security-policy"] || ""
    )?.[1];
    assert.ok(nonce, "Database viewer CSP nonce is missing");
    assert.ok(db.body.includes(`<script nonce="${nonce}">`));

    const stats = await request("/api/stats");
    assert.equal(stats.status, 200);
    assert.equal(stats.headers["cache-control"], "no-store");
    assert.ok(JSON.parse(stats.body).users);

    const blockedHost = await request("/", "evil.example");
    assert.equal(blockedHost.status, 403);

    await testBlockedSocketOrigin();
    await testAllowedSocketFlow();
  } finally {
    serverProcess.kill("SIGTERM");
    await waitFor(
      () => serverProcess.exitCode !== null,
      "release server shutdown",
      5000
    ).catch(() => serverProcess.kill("SIGKILL"));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log("Release smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
