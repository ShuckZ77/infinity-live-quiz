# Infinity Live Quiz

A real-time quiz/competition system powered by YouTube Live Chat. Tracks response times, detects duplicates, and generates leaderboards. Built with Node.js, React, and Socket.io.

![Version](https://img.shields.io/badge/version-3.12.2-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-ISC-yellow)

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Database](#database)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Understanding youtubei.js](#understanding-youtubeijs)
- [Code Walkthrough](#code-walkthrough)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)
- [Performance Considerations](#performance-considerations)

---

## Features

### Quiz/Competition System

- **Timer-based sessions** - 30s, 60s, 120s, or 180s quiz durations
- **Response tracking** - Records first response time for each user
- **Duplicate detection** - Marks repeat comments from same user
- **Live leaderboard** - Top 25 fastest responders with bar chart

### Technical Features

- **Low latency** - 100ms polling for near-instant chat updates
- **Real-time UI** - Socket.io pushes updates to all connected clients
- **Auto-discovery** - Finds live streams automatically if no video ID provided
- **Modern stack** - React frontend with modular architecture
- **Dark theme** - Sleek UI with fluid animations

### Database (v3.5+)

- **User Profiles** - Persistent tracking of YouTube chat users
- **Session History** - Record of all YouTube live sessions
- **Timer Statistics** - Track usage of each timer duration (30s/60s/120s/180s)
- **sql.js (SQLite)** - Pure JavaScript database, no native dependencies
- **Browser Dashboard** - View database at `/db` endpoint
- **REST API** - JSON endpoints for stats, users, sessions

### Timer Rankings (v3.6)

- **Unique Timer ID** - Each timer run gets a DDMMYYHHMMSS identifier
- **Top 50 Rankings** - Store rankings with response times for each quiz
- **Historical Data** - Query rankings by date, video, or user
- **Data Hierarchy** - Date → Video ID → Timer ID → Rankings

### Quiz Enhancement (v3.7)

- **5-Second Countdown** - Beautiful animated countdown before timer starts
- **Question Types** - Choose between Multiple Choice (A/B/C/D) or Fill-in-Blanks
- **Answer Selection** - Post-quiz popup to select correct answer
- **Filtered Rankings** - Only users who answered correctly appear in leaderboard
- **Smart Matching** - MCQ matches first character, Fill-in-blanks uses exact match

### User Response Tracking (v3.8)

- **Full Response History** - Store ALL user responses (correct + wrong) per timer
- **Answer Analytics API** - Query responses with correct/wrong filtering
- **User History** - Track individual user's accuracy across all quizzes
- **Response Stats** - Get total, correct, wrong counts and accuracy rate
- **Performance Optimized** - Max 200 responses per timer, writes after quiz ends

### Custom Branding & Documentation (v3.9)

- **Custom Logo** - Support for `Brand-mark.png` in header
- **Answer Distribution Chart** - Pie chart showing A/B/C/D distribution for MCQ
- **Async Database Writes** - Non-blocking fire-and-forget pattern
- **Performance Optimized** - 5-second timeout on YouTube fetches

### UI Video Input (NEW in v3.10)

- **Browser-Based Selection** - Enter Video ID directly in the UI
- **URL Auto-Extraction** - Paste YouTube URLs, ID is extracted automatically
- **Dynamic Switching** - Change videos without restarting server
- **CLI Fallback** - `npm run dev -- VIDEO_ID` still works for debugging
- **Connection Status** - See connecting/live/offline/error states

### Startup Resilience (v3.10.1)

- **Auto Port Cleanup** - Kills stale processes on port 3001 before start
- **WAL File Cleanup** - Removes corrupt database lock files automatically
- **Zero Manual Intervention** - Just run `npm run dev` and it works

### Video Metadata (NEW in v3.11)

- **Header Display** - Shows video title, channel name, approx views
- **Videos Table** - New database table tracks all connected videos
- **60-Second Refresh** - View count updates periodically
- **Modern Styling** - Glassmorphism design with animations

### Video Leaderboard (NEW in v3.12)

- **Per-Video Scoring** - Points persist for the same video across sessions
- **Points System** - +4 pts per correct answer
- **Question Tracking** - Counts quizzes that ended naturally (not aborted)
- **Avg Response Time** - Calculated from correct answers only
- **Footer Display** - Top 10 users with avatars, rank badges, points
- **Persistence** - Leaderboard survives page refresh

---

## Project Structure

```
infinity-live-quiz/
│
├── package.json              # Root scripts for managing both client & server
├── README.md                 # This documentation
├── CHANGELOG.md              # Version history
├── YOUTUBEI_JS_FEATURES.md   # Library documentation
├── PORTABLE_APP_MIGRATION.md # Portable Web App documentation
├── start-windows.bat         # Windows launcher (double-click to run)
├── start-mac.command         # Mac launcher (double-click to run)
│
├── server/                   # 📡 BACKEND
│   ├── package.json          # Server dependencies
│   ├── index.js              # Main server (Express + Socket.io + YouTube API)
│   ├── debug_props.js        # Video inspection utility
│   ├── view-db.js            # CLI database viewer (npm run db)
│   │
│   ├── database/             # 🗄️ DATABASE MODULE (sql.js/SQLite)
│   │   ├── index.js          # Connection & initialization
│   │   ├── schema.sql        # Table definitions
│   │   ├── users.js          # User CRUD operations
│   │   ├── sessions.js       # Session operations
│   │   ├── rankings.js       # Timer rankings operations
│   │   ├── videos.js         # Video metadata operations
│   │   ├── scores.js         # Video leaderboard scoring
│   │   └── README.md         # Database documentation
│   │
│   └── data/                 # Database storage
│       └── quiz.db           # SQLite database file
│
├── client/                   # 🖥️ FRONTEND
│   ├── package.json          # Client dependencies
│   ├── vite.config.js        # Vite build configuration
│   ├── index.html            # HTML template
│   │
│   ├── src/
│   │   ├── main.jsx          # React entry point
│   │   ├── App.jsx           # Main component (orchestrates countdown + modal)
│   │   ├── App.css           # Styles (1400+ lines, includes v3.7 animations)
│   │   │
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── index.js
│   │   │   ├── useSocket.js      # Socket.io connection & state
│   │   │   └── useLeaderboard.js # Panel visibility management
│   │   │
│   │   ├── components/       # UI components
│   │   │   ├── index.js
│   │   │   ├── Header.jsx            # App header with controls
│   │   │   ├── TimerSection.jsx      # Timer buttons + question type selector
│   │   │   ├── ChatSection.jsx       # Live chat messages
│   │   │   ├── LeaderboardPanel.jsx  # Rankings display
│   │   │   ├── CountdownOverlay.jsx  # 5-second pre-timer countdown
│   │   │   └── AnswerSelectionModal.jsx # Post-quiz answer popup
│   │   │
│   │   └── utils/            # Utilities
│   │       ├── index.js
│   │       ├── constants.js      # App constants
│   │       └── formatters.js     # Formatting functions
│   │
│   └── dist/                 # Built React app (served by Express)
│
└── scripts/                  # Build & utility scripts
    ├── cleanup.js            # Port cleanup on startup
    └── create-portable.js    # Creates distributable ZIP
```

---

---

## Development Workflow (Important!)

There are two ways to run this application. **Knowing the difference is critical for seeing your changes.**

### 1. Production Mode (What you are likely running)

```bash
# Root directory
npm run dev
```

- **What it does:** Starts the Node.js server and serves the **pre-built** frontend files from `client/dist`.
- **Behavior:** FASTER start-up, but **Frontend changes will NOT appear** until you rebuild.
- **When to use:** When running the quiz for a real audience (stable, no lag).
- **How to update UI:** You must run `npm run build` in the client folder.

### 2. Development Mode (For coding)

You need two terminals:

**Terminal 1 (Backend):**

```bash
npm run dev:server
```

**Terminal 2 (Frontend):**

```bash
npm run dev:client
```

- **What it does:** Starts the backend API AND the Vite frontend server (usually port 5173).
- **Behavior:** **Hot Module Replacement (HMR)** is active. Changes to React components or CSS appear **instantly**.
- **When to use:** When adding features, fixing bugs, or changing styles.

---

## Quick Start

### Prerequisites

- Node.js v18 or higher
- npm

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd youtube-live-chat

# 2. Install all dependencies (server + client)
cd server && npm install
cd ../client && npm install

# 3. Build the frontend
npm run build

# 4. Go back to root
cd ..
```

### Running the App

```bash
# Start with auto-discovery (finds Lofi Girl live stream)
npm run dev

# Or with a specific video ID
npm run dev -- VIDEO_ID

# Example with Lofi Girl
npm run dev -- jfKfPfyJRdk
```

### Viewing the UI

Open your browser to: **http://localhost:3001**

### Viewing the Database

Open the database dashboard: **http://localhost:3001/db**

Or use the CLI:

```bash
npm run db
```

---

## How It Works

### Quiz Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         QUIZ FLOW                                │
└─────────────────────────────────────────────────────────────────┘

1. IDLE STATE
   │
   │  User sees: Timer selection buttons (30s, 60s, 120s, 180s)
   │  Chat shows: Live messages with HH:MM:SS timestamps
   │
   └──► User clicks timer button
         │
         ▼
2. RUNNING STATE
   │
   │  User sees: Countdown timer with glowing animation
   │  Chat shows: Messages with response time (e.g., "3.456s")
   │
   │  Behind the scenes:
   │  ├── Server records startTime
   │  ├── For each message: responseTime = now - startTime
   │  ├── First message from user → stored in userResponses Map
   │  └── Duplicate messages → marked with "DUP" badge
   │
   └──► Timer reaches 0 (or user clicks "Stop")
         │
         ▼
3. ENDED STATE
   │
   │  User sees: Leaderboard with top 25 fastest responders
   │  ├── Bar chart visualization
   │  ├── Gold/Silver/Bronze badges for top 3
   │  └── Response time and message preview
   │
   └──► User clicks "Start New Quiz"
         │
         ▼
         Back to IDLE STATE
```

### Message Processing

```javascript
// When a chat message arrives during quiz:

if (session.status === "running") {
  // Calculate response time
  responseTime = (now - session.startTime) / 1000; // in seconds

  if (userResponses.has(author)) {
    // DUPLICATE - user already responded
    isDuplicate = true;
    userResponses.get(author).responseCount++;
  } else {
    // NEW - first response from this user
    userResponses.set(author, {
      firstResponseTime: responseTime,
      responseCount: 1,
      message: message,
    });
  }
}

// Emit to all clients
io.emit("chat-message", {
  author,
  message,
  isDuplicate,
  responseTime,
});
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYSTEM ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐                    ┌──────────────────────┐
│                      │    HTTP (3001)     │                      │
│   REACT FRONTEND     │ ◄────────────────► │   EXPRESS SERVER     │
│   (Browser)          │                    │   (Node.js)          │
│                      │    Socket.io       │                      │
│   ┌────────────────┐ │ ◄────────────────► │   ┌────────────────┐ │
│   │ useSocket Hook │ │   • chat-message   │   │ Session State  │ │
│   │ useLeaderboard │ │   • session-update │   │ userResponses  │ │
│   └────────────────┘ │   • rankings       │   └────────────────┘ │
│                      │                    │           │          │
│   ┌────────────────┐ │                    │           │ 100ms    │
│   │ Components:    │ │                    │           │ polling  │
│   │ • Header       │ │                    │           ▼          │
│   │ • TimerSection │ │                    │   ┌────────────────┐ │
│   │ • ChatSection  │ │                    │   │  youtubei.js   │ │
│   │ • Leaderboard  │ │                    │   │  (Innertube)   │ │
│   └────────────────┘ │                    │   └───────┬────────┘ │
│                      │                    │           │          │
└──────────────────────┘                    └───────────┼──────────┘
                                                        │
                                                        ▼
                                            ┌──────────────────────┐
                                            │                      │
                                            │    YouTube API       │
                                            │    (Innertube)       │
                                            │                      │
                                            │ • live_chat/get_live │
                                            │ • continuation tokens│
                                            │                      │
                                            └──────────────────────┘
```

### Data Flow

| Step | Component | Action                                      |
| ---- | --------- | ------------------------------------------- |
| 1    | YouTube   | New chat message posted                     |
| 2    | Server    | Polls YouTube API every 100ms               |
| 3    | Server    | Processes message, calculates response time |
| 4    | Server    | Emits `chat-message` via Socket.io          |
| 5    | Client    | `useSocket` hook receives message           |
| 6    | Client    | Updates state, triggers re-render           |
| 7    | Client    | `ChatSection` displays new message          |

---

## Database

### Overview

The system uses **sql.js (SQLite)** for persistent storage of user profiles and session data.

### Schema

```
┌─────────────────────────┐         ┌─────────────────────────┐
│        USERS            │         │       SESSIONS          │
├─────────────────────────┤         ├─────────────────────────┤
│ username (PK)           │◄───┐    │ id (PK)                 │
│ first_seen              │    │    │ video_id                │
│ last_active             │    │    │ started_at / ended_at   │
│ total_comment_count     │    │    │ timer_count_30s/60s/... │
└─────────────────────────┘    │    └────────────┬────────────┘
                               │                 │
                          ┌────┴─────────────────┼────┐
                          │    USER_SESSIONS     │    │
                          ├──────────────────────┤    │
                          │ username (FK)        │    │
                          │ session_id (FK)      │    │
                          │ message_count        │    │
                          │ first/last_message_at│    │
                          └──────────────────────┘    │
                                                      │
┌─────────────────────────┐         ┌─────────────────┴───────┐
│  TIMER_RANKING_ENTRIES  │         │    TIMER_RANKINGS       │
├─────────────────────────┤         ├─────────────────────────┤
│ timer_id (FK)           │◄────────│ timer_id (PK)           │
│ rank                    │         │ session_id (FK)         │
│ username                │         │ video_id                │
│ response_time_seconds   │         │ date / duration         │
│ message                 │         │ question_type           │
└─────────────────────────┘         │ correct_answer          │
                                    │ started_at / ended_at   │
┌─────────────────────────┐         │ total_participants      │
│  TIMER_USER_RESPONSES   │         └─────────────────────────┘
├─────────────────────────┤                    ▲
│ timer_id (FK)           │────────────────────┘
│ username (PK)           │  (v3.8: All responses)
│ response_time_seconds   │
│ message                 │
│ is_correct              │
│ created_at              │
└─────────────────────────┘
```

### Timer ID Format

Each timer run is assigned a unique ID based on timestamp:

```
Format: DDMMYYHHMMSS (12 characters)
Example: 121225143052 = December 12, 2025, 14:30:52
```

### User Profile Fields

| Field                 | Description                      |
| --------------------- | -------------------------------- |
| `username`            | Unique YouTube chat display name |
| `first_seen`          | When user first appeared         |
| `last_active`         | Most recent activity             |
| `total_comment_count` | Lifetime messages                |

### Session Fields

| Field              | Description           |
| ------------------ | --------------------- |
| `video_id`         | YouTube video ID      |
| `started_at`       | When server connected |
| `timer_count_30s`  | Times 30s quiz used   |
| `timer_count_60s`  | Times 60s quiz used   |
| `timer_count_120s` | Times 120s quiz used  |
| `timer_count_180s` | Times 180s quiz used  |

### Timer Rankings Fields (NEW v3.6)

| Field                | Description                       |
| -------------------- | --------------------------------- |
| `timer_id`           | Unique ID (DDMMYYHHMMSS format)   |
| `session_id`         | Reference to sessions table       |
| `video_id`           | YouTube video ID                  |
| `date`               | Date of timer run (YYYY-MM-DD)    |
| `duration`           | Timer duration (30, 60, 120, 180) |
| `started_at`         | When timer started                |
| `ended_at`           | When timer ended                  |
| `total_participants` | Unique users who responded        |

### Timer Ranking Entries Fields

| Field                   | Description                    |
| ----------------------- | ------------------------------ |
| `timer_id`              | Reference to timer_rankings    |
| `rank`                  | Position in leaderboard (1-50) |
| `username`              | YouTube username               |
| `response_time_seconds` | Response time in seconds       |
| `message`               | User's first message           |

### User Response Fields (NEW v3.8)

| Field                   | Description                         |
| ----------------------- | ----------------------------------- |
| `timer_id`              | Reference to timer_rankings         |
| `username`              | YouTube username                    |
| `response_time_seconds` | Response time in seconds            |
| `message`               | User's answer text                  |
| `is_correct`            | Boolean: true if answer was correct |
| `created_at`            | Timestamp of record creation        |

### Viewing the Database

#### Option 1: Browser Dashboard (Recommended)

Open **http://localhost:3001/db** to see:

- Statistics cards (total users, messages, sessions, timer runs)
- Users table with all profiles
- Sessions table with timer usage per session
- Timer usage breakdown by duration (30s/60s/120s/180s)

#### Option 2: CLI Viewer

```bash
npm run db
```

#### Option 3: SQLite CLI

```bash
# Install SQLite (if not already installed)
brew install sqlite3

# Open database
sqlite3 server/data/quiz.db
> SELECT * FROM users ORDER BY total_comment_count DESC LIMIT 10;
```

#### Option 4: VS Code Extension

Install "SQLite Viewer" extension and open `server/data/quiz.db`

---

### REST API Endpoints

#### Browser Interface

| Endpoint  | Description                                      |
| --------- | ------------------------------------------------ |
| `GET /db` | **Database Viewer** - Interactive HTML dashboard |

#### JSON API - Core

| Endpoint                      | Description                                |
| ----------------------------- | ------------------------------------------ |
| `GET /api/stats`              | Aggregate user & session statistics        |
| `GET /api/users`              | All user profiles (sorted by last_active)  |
| `GET /api/users/top?limit=25` | Top users by message count                 |
| `GET /api/sessions`           | All session records (sorted by started_at) |

#### JSON API - Rankings (v3.6)

| Endpoint                           | Description                                 |
| ---------------------------------- | ------------------------------------------- |
| `GET /api/rankings`                | All timer rankings (limit via `?limit=100`) |
| `GET /api/rankings/stats`          | Aggregate ranking statistics                |
| `GET /api/rankings/:timerId`       | Specific timer with ranking entries         |
| `GET /api/rankings/video/:videoId` | Rankings for a video                        |
| `GET /api/rankings/date/:date`     | Rankings for a date (YYYY-MM-DD)            |
| `GET /api/rankings/user/:username` | User's ranking history                      |

#### JSON API - User Responses (NEW v3.8)

| Endpoint                                             | Description                             |
| ---------------------------------------------------- | --------------------------------------- |
| `GET /api/rankings/:timerId/responses`               | All user responses for a timer          |
| `GET /api/rankings/:timerId/responses?correct=true`  | Only correct answers                    |
| `GET /api/rankings/:timerId/responses?correct=false` | Only wrong answers                      |
| `GET /api/users/:username/answers`                   | User's answer history across all timers |

#### Example: GET /api/stats

```json
{
  "users": {
    "total": 150,
    "total_users": 150,
    "total_messages": 2340,
    "avg_messages_per_user": 15.6,
    "max_messages": 89,
    "earliest_user": "2025-12-12T08:00:00.000Z",
    "latest_activity": "2025-12-12T10:30:00.000Z"
  },
  "sessions": {
    "total": 5,
    "total_30s": 12,
    "total_60s": 8,
    "total_120s": 3,
    "total_180s": 1,
    "total_runs": 24,
    "total_sessions": 5
  }
}
```

#### Example: GET /api/rankings/:timerId

```json
{
  "timer_id": "121225143052",
  "session_id": 1,
  "video_id": "jfKfPfyJRdk",
  "date": "2025-12-12",
  "duration": 60,
  "started_at": "2025-12-12T14:30:52.000Z",
  "ended_at": "2025-12-12T14:31:52.000Z",
  "total_participants": 45,
  "entries": [
    {
      "rank": 1,
      "username": "FastPlayer",
      "response_time_seconds": 1.234,
      "message": "hello"
    },
    {
      "rank": 2,
      "username": "QuickUser",
      "response_time_seconds": 2.567,
      "message": "hi"
    }
  ]
}
```

#### Example: GET /api/rankings/:timerId/responses

```json
{
  "responses": [
    {
      "username": "FastUser",
      "response_time_seconds": 1.234,
      "message": "A",
      "is_correct": true
    },
    {
      "username": "SlowUser",
      "response_time_seconds": 5.678,
      "message": "B",
      "is_correct": false
    }
  ],
  "stats": {
    "total": 25,
    "correct": 15,
    "wrong": 10,
    "correctRate": "60.0"
  }
}
```

See [server/database/README.md](server/database/README.md) for detailed documentation.

---

## API Reference

### Socket.io Events

#### Client → Server

| Event           | Payload                          | Description             |
| --------------- | -------------------------------- | ----------------------- |
| `start-timer`   | `{ duration: 30\|60\|120\|180 }` | Start a quiz session    |
| `stop-timer`    | (none)                           | Stop current quiz early |
| `reset-session` | (none)                           | Reset to idle state     |

#### Server → Client

| Event            | Payload                                 | Description               |
| ---------------- | --------------------------------------- | ------------------------- |
| `session-update` | `{ status, duration, timeRemaining }`   | Session state changed     |
| `chat-message`   | See below                               | New chat message received |
| `rankings`       | `[{ rank, author, responseTime, ... }]` | Final leaderboard         |

### Message Object

```javascript
{
  timeString: "123.456s",     // Time since server start
  author: "Username",         // YouTube display name
  message: "hello world",     // Message text (lowercase, trimmed)
  isDuplicate: false,         // True if user already responded
  responseTime: "3.456"       // Seconds since quiz start (or null)
}
```

### Rankings Object

```javascript
{
  rank: 1,                    // Position (1 = winner)
  author: "Username",         // YouTube display name
  responseTime: 3.456,        // Seconds to first response
  responseCount: 2,           // Total messages from user
  message: "first answer"     // Their first message
}
```

---

## Configuration

### Server Configuration

| Setting          | Default | Location          | Description           |
| ---------------- | ------- | ----------------- | --------------------- |
| Port             | 3001    | `server/index.js` | HTTP server port      |
| Polling Interval | 100ms   | `server/index.js` | YouTube API poll rate |
| Error Retry      | 2000ms  | `server/index.js` | Retry delay on error  |

### Client Configuration

| Setting       | Default         | Location                        | Description         |
| ------------- | --------------- | ------------------------------- | ------------------- |
| Timer Options | [30,60,120,180] | `client/src/utils/constants.js` | Available durations |
| Max Messages  | 500             | `client/src/utils/constants.js` | Memory limit        |

---

## Understanding youtubei.js

If you're new to `youtubei.js`, this section explains the core concepts.

### What is Innertube?

`youtubei.js` is an unofficial library that uses YouTube's **internal Innertube API** - the same API that YouTube's website uses. No API keys required!

```javascript
const { Innertube, UniversalCache } = require("youtubei.js");

const yt = await Innertube.create({
  cache: new UniversalCache(false), // Disable caching
  generate_session_locally: true, // No OAuth needed
  client_type: "WEB", // Mimic web browser
});
```

### Continuation Tokens

YouTube uses continuation tokens to paginate infinite content:

```
Request 1: Token A → Messages 1-50 + Token B
Request 2: Token B → Messages 51-100 + Token C
...
```

```javascript
// Get initial token from video info
let continuation = info.livechat?.continuation;

// Each API call returns a new token
const response = await yt.actions.execute("live_chat/get_live_chat", {
  continuation,
  parse: true,
});

// Update for next request
continuation = response.continuation_contents.continuation?.token;
```

### Actions Model

YouTube's API returns "actions" describing events:

| Action Type                  | Meaning          |
| ---------------------------- | ---------------- |
| `AddChatItemAction`          | New chat message |
| `RemoveChatItemAction`       | Message deleted  |
| `AddBannerToLiveChatCommand` | Pinned message   |

### Why Custom Polling?

The library's built-in `LiveChat` class buffers messages for smooth delivery. We bypass this for lower latency:

```javascript
// Built-in (has buffering delay)
const livechat = info.getLiveChat();
livechat.on('chat-update', callback);

// Our approach (direct, no buffer)
setInterval(async () => {
  const response = await yt.actions.execute("live_chat/get_live_chat", {...});
  // Process immediately
}, 100);
```

---

## Code Walkthrough

### Server Entry Point (`server/index.js`)

```javascript
// 1. Suppress library warnings
process.stdout.write = function(chunk) { /* filter [YOUTUBEJS] */ };

// 2. Setup Express + Socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 3. Session state management
let session = {
  status: "idle",          // idle | running | ended
  startTime: null,         // When quiz started
  duration: 0,             // Quiz length
  userResponses: new Map() // User → { firstResponseTime, count, message }
};

// 4. Socket event handlers
io.on("connection", (socket) => {
  socket.on("start-timer", ({ duration }) => {
    session.status = "running";
    session.startTime = new Date();
    io.emit("session-update", { status: "running", ... });
  });
});

// 5. YouTube polling loop
const poll = async () => {
  const response = await yt.actions.execute("live_chat/get_live_chat", {...});
  for (const action of response.actions) {
    if (action.type === "AddChatItemAction") {
      // Process message, emit to clients
    }
  }
  setTimeout(poll, 100);
};
```

### Client Entry Point (`client/src/App.jsx`)

```javascript
import { useSocket, useLeaderboard } from './hooks';
import { Header, TimerSection, ChatSection, LeaderboardPanel } from './components';

function App() {
  // All state managed by hooks
  const { isConnected, sessionStatus, messages, rankings, ... } = useSocket();
  const { showLeaderboard, toggleLeaderboard } = useLeaderboard(sessionStatus);

  return (
    <div className="app-container">
      <Header ... />
      <main>
        <TimerSection ... />
        <ChatSection messages={messages} ... />
        <LeaderboardPanel rankings={rankings} ... />
      </main>
    </div>
  );
}
```

---

## Troubleshooting

### "No continuation token found"

**Cause:** Video doesn't have live chat available.

**Solutions:**

1. Verify the video is actually live (not a premiere or VOD)
2. Check if chat is enabled on the stream
3. Try a different video ID

### "This video is not live"

**Cause:** Video ID points to a regular video.

**Solution:** Use a live stream's video ID from the URL:

```
https://www.youtube.com/watch?v=jfKfPfyJRdk
                               └──────────┘
                               This is the VIDEO_ID
```

### Frontend shows "Disconnected"

**Cause:** Socket.io connection lost.

**Solutions:**

1. Ensure backend is running (`npm run dev`)
2. Check terminal for errors
3. Refresh the browser

### Debug a Video

Use the debug utility to inspect video properties:

```bash
npm run debug -- VIDEO_ID
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full version history.

### Recent Versions

| Version | Date       | Summary                                                         |
| ------- | ---------- | --------------------------------------------------------------- |
| v3.13.0 | 2025-12-23 | **Portable Web App: removed Electron, migrated to sql.js**      |
| v3.12.0 | 2025-12-13 | Video leaderboard with per-video scoring (+4 pts per correct)   |
| v3.11.0 | 2025-12-13 | Video metadata display (title, channel, approx views)           |
| v3.10.0 | 2025-12-13 | UI-based Video ID input, dynamic video switching                |
| v3.8.0  | 2025-12-12 | **User response tracking: store all answers (correct + wrong)** |
| v3.7.0  | 2025-12-12 | Quiz enhancement: countdown, question types, answer filtering   |
| v3.6.0  | 2025-12-12 | Timer rankings: unique timer_id, top 50 storage, rankings API   |
| v3.5.0  | 2025-12-12 | SQLite database, /db viewer, REST API, user profiles            |
| v3.4.0  | 2025-12-12 | Reorganized into client/server folders                          |
| v3.3.0  | 2025-12-12 | Modular architecture (hooks, components, utils)                 |
| v3.2.1  | 2025-12-12 | Real-time timestamps in idle state                              |
| v3.2.0  | 2025-12-11 | Newest messages on top, enhanced timer                          |
| v3.1.0  | 2025-12-11 | Toggleable leaderboard, live chat in idle                       |
| v3.0.0  | 2025-12-11 | Quiz/Competition system                                         |

---

## Performance Considerations

This section documents the performance limitations and design decisions made to keep the application fast and responsive.

### Storage Limits

| Feature                      | Limit   | Reason                           |
| ---------------------------- | ------- | -------------------------------- |
| Ranking entries per timer    | **50**  | Keeps leaderboard queries fast   |
| User responses per timer     | **200** | Balances completeness vs storage |
| Chat messages in memory      | **500** | Prevents browser memory bloat    |
| Rankings in /db viewer       | **50**  | Keeps page load fast             |
| User responses in /db viewer | **100** | Keeps page load fast             |

### Write Timing

All database writes for rankings and responses happen **AFTER the timer ends**, ensuring zero impact during the live quiz. Only user profile updates (simple upserts) occur during the quiz.

| Operation            | When             | Impact on Quiz |
| -------------------- | ---------------- | -------------- |
| User profile updates | During quiz      | Minimal        |
| Ranking entries      | After timer ends | None           |
| User responses       | After timer ends | None           |

### Known Bottlenecks (v3.8.1 Analysis)

> [!WARNING] > **Blocking Database I/O is currently in the hot path.**

In `server/index.js`, the polling loop awaits database writes for every single chat message:

```javascript
await users.upsertUser(author); // Blocking
```

**Impact:** Under very high load (thousands of messages/sec), this will slow down the polling loop, causing lag in the quiz.
**Recommended Fix:** Move these DB calls to be asynchronous (fire-and-forget) or use a message queue.

### Scaling Notes

For high-volume streams (1000+ messages/minute):

- Consider increasing poll interval to 200-500ms
- **Writes:** As of v3.9.1, database writes are **asynchronous (Fire-and-Forget)**. High chat volume will NOT slow down the processing loop or timer.
- **Storage:** The database file grows indefinitely. Periodically check `server/data/quiz.db` size.
- **Scaling:** Currently limited to a single server instance (no horizontal scaling). Uses a single persistent connection.

---

## Database Reset

To reset all data and start fresh:

```bash
rm server/data/quiz.db server/data/quiz.db-journal
```

The schema will be recreated automatically on next server start.

---

## License

ISC

```

```
