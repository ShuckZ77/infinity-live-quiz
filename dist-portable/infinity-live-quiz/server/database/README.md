# Database Module

sql.js (SQLite) powered persistent storage for user profiles, session tracking, and timer rankings.

## Overview

This module provides:

- **User Profiles**: Track unique YouTube chat users across sessions
- **Session Tracking**: Record YouTube live sessions with timer usage stats
- **User-Session Links**: Track per-session activity for each user
- **Timer Rankings** (NEW v3.6): Store top 50 rankings for each quiz round

## File Structure

```
server/database/
├── index.js        # Connection & initialization
├── schema.sql      # Table definitions
├── users.js        # User query operations
├── sessions.js     # Session query operations
├── rankings.js     # Timer rankings operations
├── videos.js       # Video metadata operations
├── scores.js       # Video leaderboard scoring
└── README.md       # This documentation

server/data/
└── quiz.db         # SQLite database file (auto-created)
```

## Schema

### Users Table

| Column                | Type         | Description               |
| --------------------- | ------------ | ------------------------- |
| `username`            | VARCHAR (PK) | YouTube chat display name |
| `first_seen`          | TIMESTAMP    | When user first appeared  |
| `last_active`         | TIMESTAMP    | Most recent activity      |
| `total_comment_count` | INTEGER      | Lifetime message count    |

### Sessions Table

| Column             | Type         | Description              |
| ------------------ | ------------ | ------------------------ |
| `id`               | INTEGER (PK) | Auto-increment ID        |
| `video_id`         | VARCHAR      | YouTube video ID         |
| `started_at`       | TIMESTAMP    | When server connected    |
| `ended_at`         | TIMESTAMP    | When server disconnected |
| `timer_count_30s`  | INTEGER      | Times 30s timer used     |
| `timer_count_60s`  | INTEGER      | Times 60s timer used     |
| `timer_count_120s` | INTEGER      | Times 120s timer used    |
| `timer_count_180s` | INTEGER      | Times 180s timer used    |
| `total_timer_runs` | INTEGER      | Total quiz rounds        |

### User_Sessions Table (Junction)

| Column             | Type         | Description              |
| ------------------ | ------------ | ------------------------ |
| `username`         | VARCHAR (FK) | Reference to users       |
| `session_id`       | INTEGER (FK) | Reference to sessions    |
| `message_count`    | INTEGER      | Messages in this session |
| `first_message_at` | TIMESTAMP    | First chat in session    |
| `last_message_at`  | TIMESTAMP    | Last chat in session     |

### Timer_Rankings Table (NEW v3.6)

| Column               | Type         | Description                       |
| -------------------- | ------------ | --------------------------------- |
| `timer_id`           | VARCHAR (PK) | Unique ID (DDMMYYHHMMSS format)   |
| `session_id`         | INTEGER (FK) | Reference to sessions             |
| `video_id`           | VARCHAR      | YouTube video ID                  |
| `date`               | DATE         | Date of timer run                 |
| `duration`           | INTEGER      | Timer duration (30, 60, 120, 180) |
| `started_at`         | TIMESTAMP    | When timer started                |
| `ended_at`           | TIMESTAMP    | When timer ended                  |
| `total_participants` | INTEGER      | Unique users who responded        |

### Timer_Ranking_Entries Table (NEW v3.6)

| Column                  | Type          | Description                 |
| ----------------------- | ------------- | --------------------------- |
| `timer_id`              | VARCHAR (FK)  | Reference to timer_rankings |
| `rank`                  | INTEGER       | Position (1-50)             |
| `username`              | VARCHAR       | YouTube username            |
| `response_time_seconds` | DECIMAL(10,3) | Response time in seconds    |
| `message`               | TEXT          | User's first message        |

## Usage

### Initialization

```javascript
const { initDatabase, closeDatabase } = require("./database");

// On server start
await initDatabase();

// On shutdown
await closeDatabase();
```

### User Operations

```javascript
const users = require("./database/users");

// Update/create user on chat message
await users.upsertUser("username123");

// Get user profile
const user = await users.getUser("username123");

// Get top 25 most active users
const topUsers = await users.getTopUsers(25);

// Get recently active users
const recentUsers = await users.getRecentUsers(25);

// Get aggregate stats
const stats = await users.getUserStats();
// { total_users, total_messages, avg_messages_per_user, ... }

// Search users
const matches = await users.searchUsers("john");
```

### Session Operations

```javascript
const sessions = require("./database/sessions");

// Create/get session for a video
const sessionId = await sessions.getOrCreateSession("VIDEO_ID");

// Increment timer count (when quiz starts)
await sessions.incrementTimerCount(sessionId, 60); // 60s timer

// Record user activity in session
await sessions.recordUserActivity(sessionId, "username123");

// End session (on server shutdown)
await sessions.endSession(sessionId);

// Get session stats
const stats = await sessions.getSessionStats(sessionId);

// Get timer usage across all sessions
const timerStats = await sessions.getTimerStats();
// { total_30s, total_60s, total_120s, total_180s, total_runs }
```

### Rankings Operations (NEW v3.6)

```javascript
const rankings = require("./database/rankings");

// Generate unique timer ID (DDMMYYHHMMSS format)
const timerId = rankings.generateTimerId();
// Example: "121225143052" = December 12, 2025, 14:30:52

// Create timer ranking record (when quiz starts)
await rankings.createTimerRanking(timerId, sessionId, videoId, 60);

// Save ranking entries (when quiz ends)
const rankingsArray = [
  { author: "FastPlayer", responseTime: 1.234, message: "hello" },
  { author: "QuickUser", responseTime: 2.567, message: "hi" },
];
await rankings.saveRankingEntries(timerId, rankingsArray);

// End timer ranking with participant count
await rankings.endTimerRanking(timerId, 45);

// Get specific timer ranking with entries
const timerData = await rankings.getTimerRanking(timerId);
const entries = await rankings.getRankingEntries(timerId);

// Query rankings by different criteria
const byVideo = await rankings.getRankingsByVideoId("jfKfPfyJRdk");
const byDate = await rankings.getRankingsByDate("2025-12-12");
const byUser = await rankings.getTopRankingsByUser("FastPlayer", 10);

// Get ranking statistics
const stats = await rankings.getRankingStats();
// { total_timer_runs, total_participants, avg_participants, ... }
```

## API Endpoints

The server exposes these endpoints for database access:

### Browser Interface

| Endpoint | Method | Description                                     |
| -------- | ------ | ----------------------------------------------- |
| `/db`    | GET    | **Interactive dashboard** with tables and stats |

### JSON API - Core

| Endpoint                  | Method | Description                    |
| ------------------------- | ------ | ------------------------------ |
| `/api/stats`              | GET    | Aggregate user & session stats |
| `/api/users`              | GET    | All user profiles              |
| `/api/users/top?limit=25` | GET    | Top users by message count     |
| `/api/sessions`           | GET    | All sessions                   |

### JSON API - Rankings (NEW v3.6)

| Endpoint                       | Method | Description                |
| ------------------------------ | ------ | -------------------------- |
| `/api/rankings`                | GET    | All timer rankings         |
| `/api/rankings/stats`          | GET    | Aggregate ranking stats    |
| `/api/rankings/:timerId`       | GET    | Timer ranking with entries |
| `/api/rankings/video/:videoId` | GET    | Rankings for a video       |
| `/api/rankings/date/:date`     | GET    | Rankings for a date        |
| `/api/rankings/user/:username` | GET    | User's ranking history     |

### Example Responses

**GET /api/stats**

```json
{
  "users": {
    "total": 150,
    "total_messages": 5420,
    "avg_messages_per_user": 36.13,
    "max_messages": 234,
    "earliest_user": "2025-12-10T10:00:00.000Z",
    "latest_activity": "2025-12-12T14:30:00.000Z"
  },
  "sessions": {
    "total": 5,
    "total_30s": 12,
    "total_60s": 8,
    "total_120s": 3,
    "total_180s": 2,
    "total_runs": 25
  }
}
```

**GET /api/users/top?limit=3**

```json
[
  {
    "username": "ChatMaster",
    "first_seen": "2025-12-10T10:00:00.000Z",
    "last_active": "2025-12-12T14:30:00.000Z",
    "total_comment_count": 234
  },
  {
    "username": "QuizKing",
    "first_seen": "2025-12-10T11:00:00.000Z",
    "last_active": "2025-12-12T14:25:00.000Z",
    "total_comment_count": 189
  }
]
```

## Viewing the Database

### Option 1: Browser Dashboard (Recommended)

Open **http://localhost:3001/db** while the server is running to see:

- Statistics cards (total users, messages, sessions, timer runs)
- Users table with all profiles
- Sessions table with timer usage per session
- Timer usage breakdown by duration

### Option 2: CLI Viewer

```bash
# From project root
npm run db

# Or from server folder
cd server && npm run db
```

### Option 3: VS Code Extensions

### Option 3: SQLite CLI

```bash
# Install SQLite (if not already installed)
brew install sqlite3

# Open database
sqlite3 server/data/quiz.db

# Run queries
SELECT * FROM users ORDER BY total_comment_count DESC LIMIT 10;
SELECT * FROM sessions;
SELECT
  s.video_id,
  COUNT(DISTINCT us.username) as unique_users,
  SUM(us.message_count) as total_messages
FROM sessions s
Join user_sessions us ON s.id = us.session_id
GROUP BY s.video_id;
```

## Data Flow

```
YouTube Chat Message
        │
        ▼
┌───────────────────────┐
│  1. upsertUser()      │ ──► users table
│     - Create if new   │     (username, last_active, count++)
│     - Update if exists│
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  2. recordUserActivity│ ──► user_sessions table
│     - Link to session │     (message_count++, last_message_at)
│     - Track per-session│
└───────────────────────┘

Timer Start Event
        │
        ▼
┌───────────────────────┐
│  incrementTimerCount()│ ──► sessions table
│     - timer_count_Xs++│     (timer_count_30s/60s/120s/180s)
│     - total_runs++    │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  createTimerRanking() │ ──► timer_rankings table (NEW v3.6)
│     - Generate timer_id│    (DDMMYYHHMMSS format)
│     - Store metadata  │
└───────────────────────┘

Timer End Event
        │
        ▼
┌───────────────────────┐
│  saveRankingEntries() │ ──► timer_ranking_entries table
│     - Top 50 users    │     (rank, username, response_time)
│     - Response times  │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  endTimerRanking()    │ ──► timer_rankings table
│     - Set ended_at    │     (ended_at, total_participants)
│     - Participant count│
└───────────────────────┘
```

## Performance Notes

- **Indexes**: Created on `users.last_active`, `sessions.video_id`, `user_sessions.session_id`, `timer_rankings.session_id`, `timer_rankings.video_id`, `timer_rankings.date`, `timer_ranking_entries.username`
- **Async Operations**: All database calls are async to not block chat polling
- **Error Handling**: Database errors are caught and logged, never break chat functionality
- **Connection**: Single connection per server instance, reused for all queries

## Backup

To backup the database, simply copy the file:

```bash
cp server/data/quiz.db server/data/quiz.db.backup
```
