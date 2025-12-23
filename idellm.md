# Project Context for LLMs: Infinity Live Quiz

> **Version:** 3.13.0  
> **Role:** You are a Developer/Architect for this system.  
> **Objective:** Maintain a high-performance, real-time quiz platform that uses YouTube Live Chat as a game controller.

---

## 1. System Identity

**What it is:** A web application that connects to a YouTube Live stream, reads user comments in real-time, and runs timed quizzes (30s-180s).

**How it works (v3.11+):**

1. **Host** opens `http://localhost:3001` (no CLI args needed)
2. **Host** enters YouTube Video ID or URL in browser
3. **Server** connects to video and starts polling chat
4. **Header** displays video title, channel name, approx views
5. **Host** selects question type (MCQ/Fill-blank) and starts timer
6. **Viewers** type answers in YouTube Chat
7. **Server** calculates response times and detects duplicates
8. **Server** pushes updates via WebSockets
9. **Host** selects correct answer → Leaderboard shows only correct answers

---

## 2. Technology Stack

| Layer         | Technology      | Role                                                 |
| :------------ | :-------------- | :--------------------------------------------------- |
| **Runtime**   | Node.js (v18+)  | Core server                                          |
| **Server**    | Express.js      | HTTP API + Static files                              |
| **Real-time** | Socket.io       | Bi-directional events                                |
| **Database**  | sql.js (SQLite) | Pure JS database (Users, Sessions, Rankings, Videos) |
| **YouTube**   | `youtubei.js`   | Unofficial internal API client                       |
| **Frontend**  | React + Vite    | Dashboard UI with Hooks                              |
| **Styling**   | Vanilla CSS     | Glassmorphism, Animations, Dark Theme                |

---

## 3. Core Architecture

### The "Hot Loop" (100ms Polling)

Location: `server/index.js` → `poll()` function

- Fetches chat from `youtubei.js`
- For each message:
  - Upserts user profile **(Fire-and-Forget)**
  - Calculates response time if quiz running
  - Emits `chat-message` event

### State Management

| Store           | Type       | Data                                          |
| --------------- | ---------- | --------------------------------------------- |
| sql.js (SQLite) | Persistent | Users, Sessions, Rankings, Videos             |
| RAM             | Volatile   | Active quiz answers (`session.userResponses`) |

**⚠️ Warning:** If server crashes, current quiz answers are lost.

---

## 4. Developer Workflow

### Production Mode

```bash
npm run dev  # Serves pre-built frontend from client/dist
```

### Development Mode (HMR)

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client  # Port 5173, proxies to 3001
```

### Startup Resilience (v3.10.1)

The `predev` script automatically:

- Kills any process on port 3001
- Removes stale SQLite journal files

---

## 5. Key Files

| File                                           | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| `server/index.js`                              | Core: Polling loop, Socket handlers, API routes       |
| `server/database/*.js`                         | Data access layer (users, sessions, rankings, videos) |
| `client/src/hooks/useSocket.js`                | Frontend state management                             |
| `client/src/components/VideoIdInput.jsx`       | Video ID input UI (v3.10)                             |
| `client/src/components/Header.jsx`             | Header with video metadata display (v3.11)            |
| `client/src/App.jsx`                           | Main component, orchestrates quiz flow                |
| `client/src/App.css`                           | 2200+ lines of styling                                |
| `client/src/components/SessionLeaderboard.jsx` | Video leaderboard footer (v3.12)                      |
| `server/database/scores.js`                    | Video-based scoring module (v3.12)                    |

---

## 6. Socket Events

| Event                 | Direction       | Payload                                                |
| --------------------- | --------------- | ------------------------------------------------------ |
| `set-video-id`        | Client → Server | `videoId`                                              |
| `video-status`        | Server → Client | `{ status, videoId, title, channelName, approxViews }` |
| `start-timer`         | Client → Server | `{ duration, questionType }`                           |
| `session-update`      | Server → Client | `{ status, timeRemaining }`                            |
| `chat-message`        | Server → Client | `{ author, text, responseTime }`                       |
| `submit-answer`       | Client → Server | `{ answer }`                                           |
| `rankings`            | Server → Client | `[{ username, time }]`                                 |
| `session-leaderboard` | Server → Client | `{ leaderboard, questionsAsked }` (v3.12)              |

---

## 7. Known Constraints

1. **Single Process:** Cannot scale horizontally without Redis
2. **YouTube Fragility:** `youtubei.js` may break if YouTube changes internal API
3. **Browser Only:** `lsof` cleanup works on macOS/Linux only
4. **Logo Required:** `client/src/assets/Brand-mark.png` must exist
5. **Approx Views:** Shows total video views, not real-time concurrent viewers

---

## 8. Version History

| Version | Key Addition                                         |
| ------- | ---------------------------------------------------- |
| v3.13   | **Portable Web App** (removed Electron, uses sql.js) |
| v3.12   | Video Leaderboard (+4 pts, avg time, persistence)    |
| v3.11   | Video metadata display (title, channel, views)       |
| v3.10.1 | Startup resilience (predev scripts, cleanup)         |
| v3.10   | UI-based Video ID input                              |
| v3.9    | Answer distribution chart, Async DB                  |
| v3.8    | User response tracking                               |
| v3.7    | Countdown, Question types, Answer filtering          |
| v3.6    | Timer rankings storage                               |
| v3.5    | SQLite database                                      |
