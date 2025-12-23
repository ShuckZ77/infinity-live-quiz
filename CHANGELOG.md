# Changelog

All notable changes to this project will be documented in this file.

## [v3.13.0] - 2025-12-23

### Summary

**Rebranding**: Renamed to **Infinity Live Quiz**.
**Major Architecture Change**: Migrated from Electron to **Portable Web App** and switched database from DuckDB to **sql.js (SQLite)**. This eliminates Windows build failures and native module compilation issues.

---

### Breaking Changes

- **Electron Removed**: The application no longer builds as a standalone `.exe` or `.dmg`
- **Database Migrated**: DuckDB replaced with sql.js (SQLite) - existing `.duckdb` files are not compatible
- **Distribution Changed**: Now distributed as a portable ZIP with launcher scripts

### New Features

#### 1. Portable Web App Distribution

- **Simple ZIP Distribution**: Extract and run with one click
- **Platform Launchers**: `start-windows.bat` (Windows) and `start-mac.command` (Mac)
- **Auto-Install Dependencies**: Launcher scripts run `npm install` on first launch
- **Browser-Based UI**: Opens automatically in default browser at `localhost:3001`

#### 2. sql.js Database Engine

- **Pure JavaScript**: No native module compilation required
- **Cross-Platform**: Works identically on Windows, Mac, and Linux
- **ASM.js Build**: Uses `sql-asm.js` for maximum compatibility (no WASM/ESM issues)
- **Smaller Bundle**: ~25MB vs ~120MB for Electron

### Removed

- `electron/` folder (main process code)
- `dist-electron/` folder (build output)
- `electron` and `electron-builder` dependencies
- `electron:dev`, `electron:build`, `electron:build:mac` scripts

### Added

- `start-windows.bat` - Windows launcher script
- `start-mac.command` - Mac/Linux launcher script
- `scripts/create-portable.js` - Portable ZIP builder
- `PORTABLE_APP_MIGRATION.md` - Migration documentation
- `npm run dist` - Creates portable distribution

### Modified

- `package.json` - Removed Electron, added dist script
- `server/database/index.js` - Uses sql-asm.js instead of DuckDB
- `server/view-db.js` - Updated for sql.js
- All documentation updated to reflect sql.js
- **Session Leaderboard**: Renamed from Video Leaderboard, capacity increased to **Top 100** users

### Why This Change?

| Issue          | Electron                  | Portable Web App        |
| -------------- | ------------------------- | ----------------------- |
| Windows builds | ❌ Native module failures | ✅ Works perfectly      |
| File size      | ~120MB                    | ~25MB                   |
| Debugging      | Hard (hidden console)     | Easy (visible terminal) |
| Dependencies   | Complex (node-gyp, etc.)  | Simple (Node.js only)   |

---

## [v3.12.2] - 2025-12-13

### UI Polish - Answer & Distribution Modals

#### Answer Modal (MCQ)

- **Circular Options**: A/B/C/D now displayed as sleek circular buttons (`border-radius: 50%`)
- **Flexbox Layout**: Options centered using flexbox (no offset issues)
- **Enhanced Hover**: Lift + scale + glow effect on hover
- **Selected State**: Double-layer green glow with scale animation

#### Pie Chart Modal (Answer Distribution)

- **Side-by-Side Layout**: Pie chart on left, legend on right
- **Blurred Background**: Semi-transparent overlay with 16px blur (not dark)
- **No Scrollbar**: Fit-content sizing prevents overflow
- **Larger Chart**: 320×320px pie chart with 320px legend for visual balance
- **Responsive Sizing**: `fit-content` width with viewport-relative max constraints

---

## [v3.12.1] - 2025-12-13

### Critical Bug Fixes (Crash Prevention)

Fixed 2 null-safety issues that could crash the server during live quizzes:

- **submit-answer handler**: Added null check for `answer` parameter (prevents `TypeError: answer.toUpperCase()` crash)
- **userResponses forEach**: Added null check for `data.message` (prevents crash on malformed user data)

These fixes ensure the server remains stable even with unexpected input during live sessions.

---

## [v3.12.0] - 2025-12-13

### Summary

Added **Video Leaderboard** feature. Points are now tracked per video (not session), with +4 pts for each correct answer. The footer leaderboard persists across page refreshes and shows average response time for correct answers.

---

### New Features

#### 1. Video-Based Leaderboard

- **Per-video scoring**: Points persist for the same video across sessions
- **Points system**: +4 pts per correct answer
- **Question tracking**: Counts quizzes that ended naturally (not aborted)
- **Avg response time**: Calculated from correct answers only
- **Footer display**: Shows top 10 users with avatars, rank badges, points

#### 2. Database: `video_scores` Table

```sql
CREATE TABLE video_scores (
    video_id VARCHAR NOT NULL,
    username VARCHAR NOT NULL,
    total_points INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_answers INTEGER DEFAULT 0,
    total_response_time_ms INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (video_id, username)
);
```

#### 3. Database: `questions_asked` Column

Added to `videos` table to track quiz count per video.

#### 4. Leaderboard Persistence

- Leaderboard emitted on client connect (survives refresh)
- Shows: `"{X} questions | +4 pts per correct"`
- Stats: `"3/5 | ~2.1s"` (correct/total | avg time)

---

### Files Changed

| File                     | Changes                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `schema.sql`             | New `video_scores` table, `questions_asked` column          |
| `scores.js`              | Rewritten for video_id + response time tracking             |
| `index.js`               | Video-based scoring, incrementQuestionsAsked on natural end |
| `SessionLeaderboard.jsx` | Displays questions count, avg response time                 |
| `useSocket.js`           | Added questionsAsked state                                  |
| `App.jsx`                | Passes questionsAsked to SessionLeaderboard                 |

---

## [v3.11.1] - 2025-12-13

### UI Polish

- **Pill Design**: Header video info now uses a fluid pill shape (`border-radius: 50px`)
- **Wider Display**: Increased `max-width` to 60% and title to 380px for longer titles
- **Centered Layout**: Video pill is now centrally aligned in header using 3-column flex layout
- **Enhanced Shadow**: Added subtle box-shadow for depth

---

## [v3.11.0] - 2025-12-13

### Summary

Added Video Metadata Integration. The header now displays the current video's title, channel name, and approximate view count. Video metadata is stored in a new `videos` table for historical tracking.

---

### New Features

#### 1. Video Metadata Display

The header now shows live video information:

- **Video Title**: Truncated to 40 characters with full title on hover
- **Channel Name**: Displayed with purple accent styling
- **Approx Views**: Total views with `~` prefix (refreshes every 60 seconds)

Modern glassmorphism design with fade-in animation.

#### 2. Videos Table (Database)

New `videos` table stores YouTube video metadata:

```sql
CREATE TABLE videos (
    video_id VARCHAR PRIMARY KEY,   -- YouTube video ID
    channel_id VARCHAR,             -- YouTube channel ID
    channel_name VARCHAR,           -- Channel display name
    title VARCHAR,                  -- Video/stream title
    thumbnail_url VARCHAR,          -- Thumbnail URL
    live_start_timestamp TIMESTAMP, -- When stream started
    first_seen_at TIMESTAMP,        -- First connection
    last_seen_at TIMESTAMP,         -- Last connection
    approx_views INTEGER            -- Total view count
);
```

#### 3. Enhanced /db Endpoint

The database viewer now includes:

- **Videos section**: New table showing all tracked videos
- **Clickable Video IDs**: Direct links to YouTube
- **Approx Views column**: View counts with locale formatting
- **Navigation link**: Quick jump to Videos section

#### 4. Metadata Refresh

- View count refreshes every 60 seconds
- Database updates peak view count automatically
- Console logging for debugging

---

### New Files

| File                        | Description                    |
| --------------------------- | ------------------------------ |
| `server/database/videos.js` | Video metadata CRUD operations |

---

### Modified Files

| File                               | Changes                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `server/database/schema.sql`       | Added `videos` table                                 |
| `server/index.js`                  | Metadata extraction, /db videos section, 60s refresh |
| `client/src/hooks/useSocket.js`    | Added video metadata state variables                 |
| `client/src/components/Header.jsx` | Added video info section                             |
| `client/src/App.jsx`               | Pass metadata props to Header                        |
| `client/src/App.css`               | 50+ lines of new header video info styles            |

---

### Socket Events Updated

| Event          | New Fields                            |
| -------------- | ------------------------------------- |
| `video-status` | `title`, `channelName`, `approxViews` |

---

### Technical Notes

- `basic_info.view_count` shows **total video views**, not live viewers
- Future enhancement: Use `getLiveChat().on('update-metadata')` for real-time concurrent viewers
- Metadata is stored on first connection and updated every 60 seconds
- Fire-and-forget pattern for database writes (non-blocking)

---

### Known Limitations

- **Approx Views vs Live Viewers**: The displayed count is total views, not concurrent live viewers
- Future version will implement real-time live viewer count via livechat metadata events

---

## [v3.10.0] - 2025-12-13

### Summary

Added UI-based Video ID input. Users can now enter YouTube Video IDs or URLs directly in the browser instead of via CLI arguments. The CLI argument is still supported as an optional fallback for debugging.

---

### New Features

#### 1. Video ID Input Component

A new `VideoIdInput` component provides a clean interface for connecting to YouTube live streams:

- **URL Auto-Extraction**: Paste a full YouTube URL and the video ID is automatically extracted
- **Input Validation**: Only enables "Connect" button when a valid 11-character ID is entered
- **Status Indicators**: Shows "Connecting...", "Connected", "Offline", or error messages
- **Modern Glassmorphism UI**: Sleek design matching the existing app aesthetic

#### 2. Dynamic Video Switching

The backend now supports switching videos without restarting the server:

- **Socket Event**: `set-video-id` event allows runtime video changes
- **Graceful Session Management**: Ends current DB session and starts new one when switching
- **State Synchronization**: New clients receive current video status on connection

#### 3. Optional CLI Mode (Preserved)

The original CLI workflow is preserved for debugging:

```bash
# UI Mode (default)
npm run dev
# Then enter Video ID in browser

# CLI Mode (debugging)
npm run dev -- VIDEO_ID
# Auto-connects on startup
```

---

### New Files

| File                                     | Description                     |
| ---------------------------------------- | ------------------------------- |
| `client/src/components/VideoIdInput.jsx` | Video ID input React component  |
| `client/src/components/VideoIdInput.css` | Styling for the input component |

---

### Modified Files

| File                             | Changes                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `server/index.js`                | Added `set-video-id` socket handler, optional CLI args, video status emission |
| `client/src/App.jsx`             | Integrated VideoIdInput, conditional rendering based on video status          |
| `client/src/hooks/useSocket.js`  | Added video state (videoId, videoStatus, videoError) and setVideoId action    |
| `client/src/components/index.js` | Exported new VideoIdInput component                                           |

---

### Socket Events

| Event          | Direction       | Payload                      | Description                   |
| -------------- | --------------- | ---------------------------- | ----------------------------- |
| `set-video-id` | Client → Server | `videoId: string`            | Request to connect to a video |
| `video-status` | Server → Client | `{ status, videoId, error }` | Connection status updates     |

**Status Values:**

- `idle` - Server waiting, no video connected
- `connecting` - Attempting to connect
- `live` - Successfully connected and streaming
- `offline` - Video exists but chat unavailable
- `error` - Connection failed

---

## [v3.9.1] - 2025-12-13

### Optimized

- **Non-Blocking Database Writes:** Refactored `server/index.js` to use a "Fire-and-Forget" pattern for database operations. This prevents high chat volume from lagging the polling loop.
- **Improved Stability:** Added a 5-second timeout race condition to the `youtubei.js` fetch action. This prevents the server from hanging indefinitely if the YouTube API stalls.

### Fixed

- **Regression Fix:** Resolved a deadlock issue where the polling loop would freeze without error logs.

---

## [v3.9.0] - 2025-12-13

### Summary

Introduced Custom Branding features and improved developer documentation. The application now supports custom logo assets and clearly documents the development vs. production workflow.

### New Features

- **Custom Branding**: Integrated support for `Brand-mark.png` in the header.
- **UI Enhancements**: Added professional styling (logo float animation, glow effects) to the header.

### Documentation

- **Developer Guide**: Added "Development Workflow" section to `README.md` clarifying `npm run dev` (Production) vs `npm run dev:client` (HMR).

## [v3.8.1] - 2025-12-13

### Summary

Documentation update reflecting deep architectural analysis and performance evaluation. Added `antigravity_understanding.md` to the codebase.

---

### Documentation

- **Architecture Analysis**: Added `antigravity_understanding.md` containing:
  - System architecture overview (Node.js + DuckDB + Socket.io)
  - Performance evaluation (Latencies, I/O blocking)
  - Recommendations for scaling (Async DB writes, Redis state)

### Performance Analysis

- **Identified Bottleneck**: The current polling loop waits for database writes (`await users.upsertUser`) for every chat message.
- **Impact**: High chat volume could cause the polling loop to lag, degrading real-time performance.
- **Recommendation**: Move database writes out of the hot path (fire-and-forget or batching).

---

## [v3.8.0] - 2025-12-12

### Summary

Added comprehensive user response tracking. The system now stores ALL user responses (both correct and wrong) for each timer, enabling detailed answer analysis, accuracy tracking, and user performance insights.

---

### New Features

#### 1. User Response Tracking

Every user's answer is now recorded with correct/wrong status:

```sql
CREATE TABLE timer_user_responses (
    timer_id VARCHAR NOT NULL,
    username VARCHAR NOT NULL,
    response_time_seconds DECIMAL(10,3) NOT NULL,
    message TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (timer_id, username)
);
```

**Data Captured Per Response:**
| Field | Description |
|-------|-------------|
| `timer_id` | Reference to quiz session |
| `username` | YouTube username |
| `response_time_seconds` | Time from quiz start (3 decimal places) |
| `message` | User's answer text |
| `is_correct` | Boolean: correct or wrong |
| `created_at` | Timestamp of record creation |

#### 2. Response Analytics API

| Endpoint                                             | Description                             |
| ---------------------------------------------------- | --------------------------------------- |
| `GET /api/rankings/:timerId/responses`               | All responses for a timer               |
| `GET /api/rankings/:timerId/responses?correct=true`  | Correct answers only                    |
| `GET /api/rankings/:timerId/responses?correct=false` | Wrong answers only                      |
| `GET /api/users/:username/answers`                   | User's answer history across all timers |

**Example Response:**

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

#### 3. Database Viewer Update

The `/db` page now includes a "User Responses" section showing:

- Timer ID
- Username
- Response time
- Message
- Correct/Wrong status (✅/❌)
- Timestamp

---

### New Database Functions

| Function                                   | Description                                       |
| ------------------------------------------ | ------------------------------------------------- |
| `saveAllUserResponses(timerId, responses)` | Save all responses (max 200 per timer)            |
| `getUserResponses(timerId, isCorrect)`     | Get responses, optionally filtered                |
| `getResponseStats(timerId)`                | Get stats: { total, correct, wrong, correctRate } |
| `getUserAnswerHistory(username, limit)`    | Get user's history across all timers              |
| `getAllUserResponses(limit)`               | Get all responses for db viewer                   |

---

### Performance & Limitations

See [Performance Considerations](#performance-considerations) section below.

---

### Technical Notes

- Responses are saved AFTER timer ends (no impact during live quiz)
- Maximum 200 responses stored per timer (sorted by fastest response time)
- Separate table from `timer_ranking_entries` to keep leaderboard queries fast
- Existing leaderboard functionality unchanged (top 50 correct only)
- Console output now shows correct vs wrong count:
  ```
  [Submit] Correct answers: 15
  [Submit] Wrong answers: 10
  [Database] Saved 25 user responses for timer 121225173900
  ```

---

### Files Modified

| File                          | Changes                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `server/database/schema.sql`  | Added `timer_user_responses` table + indexes                            |
| `server/database/rankings.js` | Added 5 new functions + exports                                         |
| `server/index.js`             | Modified submit-answer handler, added API endpoints, updated /db viewer |

---

### Analysis Enabled

With this data, you can now analyze:

- **User accuracy rates**: Which users answer correctly most often?
- **Common wrong answers**: What mistakes are users making?
- **Response time vs accuracy**: Do faster responders get more correct?
- **Question difficulty**: Which timers had lowest correct rates?
- **User improvement**: Is a user getting better over time?

---

## [v3.7.0] - 2025-12-12

### Summary

Major quiz enhancement update! Added 5-second animated countdown before timer starts, question type selection (MCQ or Fill-in-Blanks), and post-quiz answer selection to filter rankings by correct answers only.

---

### New Features

#### 1. Pre-Timer Countdown (5 seconds)

Beautiful, fluid animated countdown before each quiz starts:

- Full-screen overlay with large animated numbers (5, 4, 3, 2, 1, GO!)
- Color transitions: Purple → Blue → Cyan → Amber → Red → Green
- Expanding ring animations behind each number
- Bounce and scale effects for dramatic impact
- Press ESC to cancel countdown

#### 2. Question Type Selection

Choose between two quiz modes before starting:

| Type                          | Description                      | Answer Format                |
| ----------------------------- | -------------------------------- | ---------------------------- |
| **Multiple Choice** (default) | Users respond with A, B, C, or D | First character must match   |
| **Fill in the Blanks**        | Users type the exact answer      | Case-insensitive exact match |

The selector appears above timer duration buttons in idle state.

#### 3. Answer Selection Modal

After timer ends, a popup appears for the host to select the correct answer:

**For MCQ:**

- Four large buttons: A, B, C, D
- Click to select, then Submit

**For Fill-in-Blanks:**

- Text input field
- Type exact answer, then Submit

#### 4. Filtered Rankings

Only users who answered correctly appear in the leaderboard:

- **MCQ**: Matches first character (e.g., "A" matches "A", "a", "A is correct")
- **Fill-in-Blanks**: Case-insensitive exact match
- Top 25 correct answers displayed, sorted by response time
- Top 50 correct answers saved to database

---

### New Socket Events

| Event           | Direction       | Payload                      | Description                 |
| --------------- | --------------- | ---------------------------- | --------------------------- |
| `start-timer`   | Client → Server | `{ duration, questionType }` | Now includes question type  |
| `submit-answer` | Client → Server | `{ answer }`                 | Host submits correct answer |

---

### New Components

| Component              | File                       | Description                      |
| ---------------------- | -------------------------- | -------------------------------- |
| `CountdownOverlay`     | `CountdownOverlay.jsx`     | Full-screen 5-second countdown   |
| `AnswerSelectionModal` | `AnswerSelectionModal.jsx` | Post-quiz answer selection popup |
| `QuestionTypeSelector` | (in `TimerSection.jsx`)    | MCQ/Fill-blank toggle            |

---

### Updated Files

**Client:**

- `App.jsx` - Orchestrates countdown, modal, and question type state
- `App.css` - 350+ lines of new animations and modal styles
- `TimerSection.jsx` - Added question type selector
- `useSocket.js` - Added `submitAnswer` action, updated `startTimer`
- `constants.js` - Added `QUESTION_TYPES` and `SUBMIT_ANSWER` event

**Server:**

- `index.js` - Added `questionType` to session, new `submit-answer` handler

---

### User Flow

```
1. Select Question Type (MCQ default or Fill-in-Blanks)
2. Click timer duration (30s, 60s, 120s, 180s)
3. 5-second countdown animation
4. Timer starts, users respond in chat
5. Timer ends
6. Answer selection modal appears
7. Host selects/types correct answer
8. Filtered leaderboard shows only correct answers
```

---

### CSS Animations Added

| Animation              | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `countdownNumberEnter` | Bounce-scale entrance for countdown numbers |
| `countdownRingExpand`  | Expanding ring effect behind numbers        |
| `modalSlideUp`         | Answer modal entrance animation             |
| `optionPulse`          | MCQ option selection feedback               |

---

### Database Schema Updates

The `timer_rankings` table now includes two new columns to store quiz metadata:

```sql
CREATE TABLE IF NOT EXISTS timer_rankings (
    timer_id VARCHAR PRIMARY KEY,
    session_id INTEGER NOT NULL,
    video_id VARCHAR NOT NULL,
    date DATE NOT NULL,
    duration INTEGER NOT NULL,
    question_type VARCHAR DEFAULT 'mcq',    -- NEW: 'mcq' or 'fill-blank'
    correct_answer VARCHAR,                  -- NEW: The correct answer submitted by host
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    total_participants INTEGER DEFAULT 0     -- Now counts CORRECT answers only
);
```

**New Columns:**

| Column           | Type    | Description                                           |
| ---------------- | ------- | ----------------------------------------------------- |
| `question_type`  | VARCHAR | Quiz type: 'mcq' or 'fill-blank' (default: 'mcq')     |
| `correct_answer` | VARCHAR | The correct answer submitted by host after timer ends |

**Updated Columns:**

| Column               | Change                                                               |
| -------------------- | -------------------------------------------------------------------- |
| `total_participants` | Now counts only users who answered correctly (was: all participants) |

**Database Viewer (`/db`):**

- Timer Rankings table now shows Type and Answer columns
- "Participants" column renamed to "Correct" for clarity

---

### Technical Notes

- Rankings are no longer emitted automatically when timer ends
- Server waits for `submit-answer` event before calculating filtered rankings
- Database stores only correct answers (up to 50)
- Session state now includes `questionType: 'mcq' | 'fill-blank'`
- Answer matching is case-insensitive and trimmed
- `createTimerRanking()` now accepts `questionType` parameter
- `endTimerRanking()` now accepts `correctAnswer` parameter

---

## [v3.6.0] - 2025-12-12

### Summary

Added persistent timer rankings storage. Each timer run now gets a unique `timer_id` (DDMMYYHHMMSS format) and stores the top 50 users with their response times. Rankings are organized hierarchically by date → video_id → timer_id.

---

### New Features

#### 1. Unique Timer ID (DDMMYYHHMMSS)

Every timer run is assigned a unique identifier based on the timestamp when it starts:

```
Format: DDMMYYHHMMSS
Example: 121225143052 = December 12, 2025, 14:30:52
```

This enables:

- Tracking multiple quiz rounds within same session
- Querying rankings by specific timer run
- Auditing historical quiz results

#### 2. Timer Rankings Storage

When a timer ends, the system automatically saves:

- **Timer metadata**: session_id, video_id, date, duration, start/end times, participant count
- **Top 50 rankings**: Each user's rank, response time (in seconds), and first message

#### 3. Rankings API Endpoints

| Endpoint                           | Description                                 |
| ---------------------------------- | ------------------------------------------- |
| `GET /api/rankings`                | All timer rankings (limit via `?limit=100`) |
| `GET /api/rankings/stats`          | Aggregate ranking statistics                |
| `GET /api/rankings/:timerId`       | Specific timer with ranking entries         |
| `GET /api/rankings/video/:videoId` | Rankings for a video                        |
| `GET /api/rankings/date/:date`     | Rankings for a date (YYYY-MM-DD)            |
| `GET /api/rankings/user/:username` | User's ranking history                      |

#### 4. Enhanced Database Viewer

The `/db` endpoint now includes:

- Timer Rankings table with all quiz rounds
- Color-coded duration badges (30s/60s/120s/180s)
- Click-through to view detailed ranking entries
- Navigation links to jump between sections
- Additional statistics (Ranked Timers, Total Participants)

---

### Database Schema

#### New Tables

```sql
-- Timer Rankings: Metadata for each quiz round
CREATE TABLE timer_rankings (
    timer_id VARCHAR PRIMARY KEY,     -- DDMMYYHHMMSS format
    session_id INTEGER NOT NULL,      -- Reference to sessions
    video_id VARCHAR NOT NULL,        -- YouTube video ID
    date DATE NOT NULL,               -- Date of timer run
    duration INTEGER NOT NULL,        -- 30, 60, 120, or 180 seconds
    started_at TIMESTAMP NOT NULL,    -- When timer started
    ended_at TIMESTAMP,               -- When timer ended
    total_participants INTEGER        -- Unique users who responded
);

-- Timer Ranking Entries: Individual rankings per timer
CREATE TABLE timer_ranking_entries (
    timer_id VARCHAR NOT NULL,        -- Reference to timer_rankings
    rank INTEGER NOT NULL,            -- Position (1-50)
    username VARCHAR NOT NULL,        -- YouTube username
    response_time_seconds DECIMAL(10,3) NOT NULL,  -- Response time
    message TEXT,                     -- First message content
    PRIMARY KEY (timer_id, rank)
);
```

#### New Indexes

```sql
CREATE INDEX idx_timer_rankings_session ON timer_rankings(session_id);
CREATE INDEX idx_timer_rankings_video ON timer_rankings(video_id);
CREATE INDEX idx_timer_rankings_date ON timer_rankings(date DESC);
CREATE INDEX idx_ranking_entries_username ON timer_ranking_entries(username);
```

---

### Data Hierarchy

```
Date (YYYY-MM-DD)
└── Video ID (YouTube video)
    └── Timer ID (DDMMYYHHMMSS)
        └── Rankings (1-50)
            ├── Rank 1: { username, response_time, message }
            ├── Rank 2: { username, response_time, message }
            └── ... up to 50 entries
```

---

### API Response Examples

#### GET /api/rankings/:timerId

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
      "timer_id": "121225143052",
      "rank": 1,
      "username": "FastPlayer",
      "response_time_seconds": 1.234,
      "message": "hello"
    },
    {
      "timer_id": "121225143052",
      "rank": 2,
      "username": "QuickUser",
      "response_time_seconds": 2.567,
      "message": "hi"
    }
  ]
}
```

#### GET /api/rankings/stats

```json
{
  "total_timer_runs": 24,
  "total_participants": 892,
  "avg_participants": 37.2,
  "unique_videos": 3,
  "unique_days": 2,
  "timer_30s": 8,
  "timer_60s": 10,
  "timer_120s": 4,
  "timer_180s": 2
}
```

---

### Data Flow

```
Timer Started (socket: 'start-timer')
│
├──► rankings.generateTimerId()
│    └── Returns: "DDMMYYHHMMSS"
│
├──► sessions.incrementTimerCount(sessionId, duration)
│
└──► rankings.createTimerRanking(timerId, sessionId, videoId, duration)
     └── Creates timer_rankings record


Timer Ended (timeout or socket: 'stop-timer')
│
├──► calculateRankings()
│    └── Returns: Top 25 users sorted by response time
│
├──► rankings.saveRankingEntries(timerId, rankings)
│    └── Saves up to 50 entries to timer_ranking_entries
│
├──► rankings.endTimerRanking(timerId, totalParticipants)
│    └── Updates ended_at and total_participants
│
└──► io.emit('rankings', rankings)
     └── Broadcasts to all clients
```

---

### New Files

```
server/database/
└── rankings.js       # Rankings database operations (NEW)
```

### Modified Files

| File                         | Changes                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `server/database/schema.sql` | Added timer_rankings and timer_ranking_entries tables          |
| `server/database/index.js`   | Updated module documentation                                   |
| `server/index.js`            | Added rankings integration, API endpoints, enhanced /db viewer |

---

### Technical Details

#### Timer ID Generation

```javascript
function generateTimerId() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${day}${month}${year}${hours}${minutes}${seconds}`;
}
```

#### Session State Update

```javascript
// Session now includes timerId
let session = {
  status: "idle",
  startTime: null,
  duration: 0,
  userResponses: new Map(),
  timerId: null, // NEW in v3.6
};
```

---

### Why This Feature?

| Use Case            | Benefit                            |
| ------------------- | ---------------------------------- |
| Historical analysis | See who won each quiz round        |
| User performance    | Track a user's ranking history     |
| Video analytics     | Compare engagement across videos   |
| Date filtering      | Review quiz results by date        |
| Audit trail         | Complete record of all quiz rounds |

---

## [v3.5.0] - 2025-12-12

### Summary

Added DuckDB database for persistent user profiles and session tracking. Users are now tracked across sessions with lifetime statistics. Includes browser-based database viewer and REST API endpoints.

---

### New Features

#### 1. Database Viewer (Browser)

Access at **http://localhost:3001/db** to see:

- Statistics dashboard (total users, messages, sessions, timer runs)
- Users table with all profiles
- Sessions table with timer usage
- Timer usage breakdown by duration

#### 2. CLI Database Viewer

```bash
npm run db
```

View database tables directly in terminal.

#### 3. User Profiles

- **Unique usernames** from YouTube chat stored in database
- **first_seen**: When user first appeared in any session
- **last_active**: Most recent chat activity
- **total_comment_count**: Lifetime message count across all sessions

#### 4. Session Tracking

- **video_id**: YouTube video ID for each session
- **started_at / ended_at**: Session duration
- **Timer usage stats**:
  - `timer_count_30s` - Times 30s quiz was run
  - `timer_count_60s` - Times 60s quiz was run
  - `timer_count_120s` - Times 120s quiz was run
  - `timer_count_180s` - Times 180s quiz was run
  - `total_timer_runs` - Total quiz rounds

#### 5. User-Session Relationships

- Track which users participated in which sessions
- Per-session message counts
- First/last message timestamps per session

---

### Database Schema

```sql
-- Users: Unique chat participants
CREATE TABLE users (
    username VARCHAR PRIMARY KEY,
    first_seen TIMESTAMP,
    last_active TIMESTAMP,
    total_comment_count INTEGER
);

-- Sessions: YouTube live sessions
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    video_id VARCHAR,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    timer_count_30s INTEGER,
    timer_count_60s INTEGER,
    timer_count_120s INTEGER,
    timer_count_180s INTEGER,
    total_timer_runs INTEGER
);

-- User-Session junction table
CREATE TABLE user_sessions (
    username VARCHAR,
    session_id INTEGER,
    message_count INTEGER,
    first_message_at TIMESTAMP,
    last_message_at TIMESTAMP,
    PRIMARY KEY (username, session_id)
);
```

---

### New Files

```
server/
├── database/
│   ├── index.js        # DB connection & init
│   ├── schema.sql      # Table definitions
│   ├── users.js        # User CRUD operations
│   ├── sessions.js     # Session operations
│   └── README.md       # Database documentation
│
├── data/
│   └── quiz.duckdb     # Database file (auto-created)
│
└── view-db.js          # CLI database viewer script
```

---

### Technical Fixes

#### 1. BigInt Serialization

DuckDB returns `BigInt` for aggregate functions (COUNT, SUM, AVG). Fixed JSON serialization errors:

| File          | Function            | Fix                      |
| ------------- | ------------------- | ------------------------ |
| `users.js`    | `getUserStats()`    | Convert BigInt to Number |
| `users.js`    | `getUserCount()`    | Convert BigInt to Number |
| `sessions.js` | `getTimerStats()`   | Convert BigInt to Number |
| `sessions.js` | `getSessionCount()` | Convert BigInt to Number |
| `sessions.js` | `getSessionStats()` | Convert BigInt to Number |

```javascript
// Before (error)
return rows[0]?.count || 0; // BigInt can't be JSON serialized

// After (fixed)
return Number(rows[0]?.count || 0); // Works!
```

#### 2. Auto-Increment in DuckDB

DuckDB doesn't auto-increment `INTEGER PRIMARY KEY` like SQLite. Fixed with sequences:

```sql
CREATE SEQUENCE IF NOT EXISTS sessions_id_seq;

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY DEFAULT nextval('sessions_id_seq'),
    ...
);
```

#### 3. SQL Comment Parsing

Fixed schema initialization to properly remove SQL comments before execution:

```javascript
// Line-by-line comment removal
const cleanedSchema = schema
  .split("\n")
  .map((line) => {
    const commentIndex = line.indexOf("--");
    return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
  })
  .join("\n");
```

---

### Endpoints

#### Browser Interface

| Endpoint  | Description                                         |
| --------- | --------------------------------------------------- |
| `GET /db` | **Database viewer UI** - Interactive HTML dashboard |

#### REST API (JSON)

| Endpoint                      | Description                         |
| ----------------------------- | ----------------------------------- |
| `GET /api/stats`              | Aggregate user & session statistics |
| `GET /api/users`              | All user profiles                   |
| `GET /api/users/top?limit=25` | Top users by message count          |
| `GET /api/sessions`           | All session records                 |

#### Example Responses

**GET /api/stats**

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

---

### Data Flow

```
Chat Message Received
        │
        ├──► users.upsertUser(author)
        │    - Create new user OR
        │    - Update last_active & increment count
        │
        └──► sessions.recordUserActivity(sessionId, author)
             - Link user to current session
             - Increment session message count

Timer Started
        │
        └──► sessions.incrementTimerCount(sessionId, duration)
             - Increment timer_count_Xs
             - Increment total_timer_runs
```

---

### Dependencies Added

```json
{
  "duckdb": "^1.4.3"
}
```

---

### Why DuckDB?

| Feature          | Benefit                           |
| ---------------- | --------------------------------- |
| File-based       | No server setup needed            |
| Columnar storage | Fast for analytics queries        |
| SQL support      | Familiar query language           |
| RANK/AVG/SUM     | Optimized for leaderboard queries |
| Zero config      | Just works                        |

---

### Viewing the Database

**VS Code**: Install "SQLite Viewer" or "DuckDB" extension

**CLI**:

```bash
brew install duckdb
duckdb server/data/quiz.duckdb
> SELECT * FROM users ORDER BY total_comment_count DESC LIMIT 10;
```

---

## [v3.4.0] - 2025-12-12

### Summary

Project reorganization: Separated codebase into clear `client/` and `server/` folders for better understanding and maintainability. Completely rewrote documentation.

---

### New Project Structure

```
youtube-live-chat/
│
├── package.json              # Root scripts (npm run dev, build, etc.)
├── README.md                 # Comprehensive documentation
├── CHANGELOG.md              # Version history
├── YOUTUBEI_JS_FEATURES.md   # Library reference
│
├── server/                   # 📡 BACKEND
│   ├── package.json          # Server dependencies
│   ├── index.js              # Main server (Express + Socket.io + YouTube)
│   └── debug_props.js        # Video inspection utility
│
└── client/                   # 🖥️ FRONTEND
    ├── package.json          # Client dependencies
    ├── vite.config.js        # Build config
    ├── index.html            # HTML template
    │
    └── src/
        ├── main.jsx          # React entry
        ├── App.jsx           # Main component
        ├── App.css           # Styles
        │
        ├── hooks/            # Custom hooks
        │   ├── useSocket.js
        │   └── useLeaderboard.js
        │
        ├── components/       # UI components
        │   ├── Header.jsx
        │   ├── TimerSection.jsx
        │   ├── ChatSection.jsx
        │   └── LeaderboardPanel.jsx
        │
        └── utils/            # Utilities
            ├── constants.js
            └── formatters.js
```

---

### Files Changed

| Change            | Old Location      | New Location             |
| ----------------- | ----------------- | ------------------------ |
| Server code       | `/index.js`       | `/server/index.js`       |
| Debug utility     | `/debug_props.js` | `/server/debug_props.js` |
| Server deps       | `/package.json`   | `/server/package.json`   |
| Static files path | `client/dist`     | `../client/dist`         |

---

### New Root Scripts

```json
{
  "scripts": {
    "start": "cd server && npm start",
    "dev": "cd server && npm run dev",
    "dev:server": "cd server && npm run dev",
    "dev:client": "cd client && npm run dev",
    "build": "cd client && npm run build",
    "install:all": "npm install && cd server && npm install && cd ../client && npm install",
    "debug": "cd server && npm run debug"
  }
}
```

---

### Documentation Updates

**README.md completely rewritten with:**

- Project structure diagram
- Quick start guide
- Quiz flow explanation
- System architecture diagram
- Data flow table
- Socket.io API reference
- Message/Rankings object schemas
- Configuration table
- youtubei.js beginner's guide
- Code walkthrough
- Troubleshooting guide

---

### Server Path Updates

```javascript
// Before (index.js in root):
app.use(express.static(path.join(__dirname, "client/dist")));

// After (index.js in server/):
app.use(express.static(path.join(__dirname, "../client/dist")));
```

---

### Benefits of Reorganization

| Aspect        | Before              | After                          |
| ------------- | ------------------- | ------------------------------ |
| Code clarity  | Mixed in root       | Clear client/server separation |
| Understanding | Confusing           | Obvious structure              |
| Onboarding    | Hard to navigate    | Self-explanatory folders       |
| Dependencies  | Single package.json | Separated dependencies         |
| Deployment    | Manual              | Can deploy separately          |

---

### Migration Guide

If upgrading from v3.3.0:

1. Server files moved to `/server/` folder
2. Update any absolute paths in scripts
3. Run `cd server && npm install` for server deps
4. Static files now served from `../client/dist`

---

## [v3.3.0] - 2025-12-12

### Summary

Major refactoring release: Code has been reorganized into a modular architecture with separate hooks, components, and utilities for better maintainability and readability.

---

### New File Structure

```
client/src/
├── App.jsx                    # Main container (87 lines, was 609)
├── App.css                    # Styles (unchanged)
├── main.jsx                   # Entry point (unchanged)
├── hooks/
│   ├── index.js               # Hook exports
│   ├── useSocket.js           # Socket.io connection & state management
│   └── useLeaderboard.js      # Panel visibility management
├── components/
│   ├── index.js               # Component exports
│   ├── Header.jsx             # App header with controls
│   ├── TimerSection.jsx       # Timer buttons/countdown/ended states
│   ├── ChatSection.jsx        # Live chat messages display
│   └── LeaderboardPanel.jsx   # Rankings with bar chart
└── utils/
    ├── index.js               # Utility exports
    ├── constants.js           # App constants (durations, events)
    └── formatters.js          # Pure formatting functions
```

---

### Files Created

| File                 | Path                                          | Purpose                   |
| -------------------- | --------------------------------------------- | ------------------------- |
| constants.js         | `/client/src/utils/constants.js`              | Centralized config values |
| formatters.js        | `/client/src/utils/formatters.js`             | Pure formatting functions |
| useSocket.js         | `/client/src/hooks/useSocket.js`              | Socket.io management      |
| useLeaderboard.js    | `/client/src/hooks/useLeaderboard.js`         | Panel visibility          |
| Header.jsx           | `/client/src/components/Header.jsx`           | Header component          |
| TimerSection.jsx     | `/client/src/components/TimerSection.jsx`     | Timer UI                  |
| ChatSection.jsx      | `/client/src/components/ChatSection.jsx`      | Chat display              |
| LeaderboardPanel.jsx | `/client/src/components/LeaderboardPanel.jsx` | Rankings panel            |

---

### Benefits of Modular Architecture

| Aspect            | Before (v3.2.1)  | After (v3.3.0)         |
| ----------------- | ---------------- | ---------------------- |
| App.jsx lines     | 609              | **87** (86% reduction) |
| Testability       | Difficult        | Easy (isolated units)  |
| Reusability       | None             | Components reusable    |
| Maintainability   | Hard to navigate | Clear separation       |
| Code organization | Single file      | Logical folders        |

---

### Key Refactoring Details

#### 1. Custom Hooks

**useSocket** - Manages all socket.io logic:

```javascript
const {
  isConnected, // Connection status
  sessionStatus, // idle | running | ended
  duration, // Timer duration
  timeRemaining, // Countdown value
  messages, // Chat messages array
  rankings, // Leaderboard data
  startTimer, // Start quiz action
  stopTimer, // Stop quiz action
  resetSession, // Reset action
} = useSocket();
```

**useLeaderboard** - Manages panel visibility:

```javascript
const { showLeaderboard, toggleLeaderboard } = useLeaderboard(sessionStatus);
```

---

#### 2. Utility Functions

**constants.js:**

```javascript
export const TIMER_DURATIONS = [30, 60, 120, 180];
export const SESSION_STATUS = { IDLE: 'idle', RUNNING: 'running', ENDED: 'ended' };
export const MAX_MESSAGES = 500;  // Memory limit
export const SOCKET_EVENTS = { ... };
```

**formatters.js:**

```javascript
export const formatTime = (seconds) => { ... };        // MM:SS
export const getCurrentTimestamp = () => { ... };     // HH:MM:SS
export const getRankBadge = (rank) => { ... };        // 1st, 2nd, #4
export const getBarWidth = (time, rankings) => { ... }; // Chart bar %
export const truncateText = (text, max) => { ... };   // Ellipsis
```

---

#### 3. Component Props

Each component has clear, documented props:

| Component        | Props                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Header           | `isConnected`, `showLeaderboard`, `hasRankings`, `onToggleLeaderboard`                 |
| TimerSection     | `sessionStatus`, `timeRemaining`, `duration`, `onStartTimer`, `onStopTimer`, `onReset` |
| ChatSection      | `messages`, `sessionStatus`                                                            |
| LeaderboardPanel | `visible`, `rankings`, `onClose`                                                       |

---

### Performance Improvements

1. **Memory Management**: Added `MAX_MESSAGES = 500` limit to prevent unbounded array growth
2. **useCallback**: Action functions wrapped in useCallback for stable references
3. **Prop-Types**: Added runtime prop validation for development

---

### Dependencies Added

```json
{
  "prop-types": "^15.x" // Runtime type checking for components
}
```

---

### Migration Notes

- All functionality remains identical
- CSS unchanged (no visual changes)
- Backend unchanged
- Import paths updated internally

---

## [v3.2.1] - 2025-12-12

### Summary

Minor enhancement: Added timestamp display when timer is NOT active, so users can see when messages arrived during idle state.

---

### Files Modified

| File         | Path                  | Lines     | Change Type  |
| ------------ | --------------------- | --------- | ------------ |
| App.jsx      | `/client/src/App.jsx` | 590+      | **Enhanced** |
| App.css      | `/client/src/App.css` | 1050+     | **Enhanced** |
| CHANGELOG.md | `/CHANGELOG.md`       | This file | Updated      |

---

### Detailed Changes

#### 1. Frontend: `client/src/App.jsx`

**Time Badge Logic Updated (Lines 479-491):**

```javascript
// v3.2.1: Time badge logic
// - When quiz is running (responseTime exists): Show response time in seconds
// - When timer is idle (no responseTime): Show timestamp (timeString)

{
  msg.responseTime ? (
    // Quiz is running - show response time
    <span className="response-time">{msg.responseTime}s</span>
  ) : (
    // Timer not active - show timestamp
    <span className="timestamp">{msg.timeString}</span>
  );
}
```

---

#### 2. Styles: `client/src/App.css`

**New `.timestamp` Class (Lines 518-535):**

```css
/* v3.2.1 NEW: TIMESTAMP BADGE
   Shown when timer is NOT active (idle state)
   - Displays time since server start
   - Green color to distinguish from response time (indigo)
   - Helps users see when messages arrived */
.timestamp {
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border-radius: 4px;
  white-space: nowrap;
}
```

---

### Visual Comparison

```
IDLE STATE (Timer not active):
┌────────────────────────────────────────┐
│ [123.456s] Charlie: hey               │  ← GREEN timestamp (time since server start)
│ [120.789s] Bob: hi there              │
│ [118.234s] Alice: hello               │
└────────────────────────────────────────┘

RUNNING STATE (Quiz active):
┌────────────────────────────────────────┐
│ [3.890s] Charlie: hey                 │  ← INDIGO response time (time since quiz start)
│ [2.567s] Bob: hi there                │
│ [1.234s] Alice: hello                 │
└────────────────────────────────────────┘
```

---

### Color Distinction

| State   | Badge            | Color            | Meaning                   |
| ------- | ---------------- | ---------------- | ------------------------- |
| Idle    | `.timestamp`     | Green (#4ade80)  | Time since server started |
| Running | `.response-time` | Indigo (#a5b4fc) | Time since quiz started   |

---

## [v3.2.0] - 2025-12-11

### Summary

UX Enhancement release: Latest comments now appear on TOP for better visibility, and the timer display has been redesigned to be BIGGER and more ATTRACTIVE with fluid glowing animations.

---

### Files Modified

| File         | Path                  | Lines     | Change Type  |
| ------------ | --------------------- | --------- | ------------ |
| App.jsx      | `/client/src/App.jsx` | 590+      | **Enhanced** |
| App.css      | `/client/src/App.css` | 1040+     | **Enhanced** |
| CHANGELOG.md | `/CHANGELOG.md`       | This file | Updated      |

---

### Detailed Changes

#### 1. Frontend: `client/src/App.jsx`

**Chat Message Order Reversed (Line 177-178):**

```javascript
// BEFORE (v3.1): Messages appended to end (oldest on top)
setMessages((prev) => [...prev, data]);

// AFTER (v3.2): Messages PREPENDED to start (newest on top)
setMessages((prev) => [data, ...prev]);
```

**Why This Change:**

- Latest comments are now immediately visible at the TOP
- Users don't need to scroll down to see new messages
- Better visibility of real-time chat activity

**Auto-Scroll Removed (Lines 226-249):**

```javascript
// v3.2: Auto-scroll removed since newest messages are at top
// PREVIOUS (v3.1): Auto-scrolled to bottom when new messages arrived
// NEW (v3.2): No auto-scroll needed - newest always visible at top

// Note: messagesEndRef removed - no longer needed
```

**Removed:**

- `messagesEndRef` useRef (no longer needed)
- Auto-scroll useEffect (no longer needed)
- `<div ref={messagesEndRef} />` element in JSX

---

#### 2. Styles: `client/src/App.css`

**Enhanced Timer Display (Lines 256-337):**

The countdown timer has been completely redesigned:

| Property    | Before (v3.1) | After (v3.2)                  |
| ----------- | ------------- | ----------------------------- |
| Font size   | 4rem          | **6rem** (50% bigger!)        |
| Font weight | 700           | **800** (bolder)              |
| Gradient    | 2 colors      | **4 colors** (richer)         |
| Glow effect | None          | **Multi-layer glow**          |
| Container   | Plain         | **Glowing bordered box**      |
| Animation   | Simple pulse  | **Multiple fluid animations** |

**New CSS Styles for Timer:**

```css
/* v3.2: Glowing container wrapper */
.countdown {
  padding: 1.5rem 3rem;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.3);
  animation: timerContainerGlow 2s ease-in-out infinite;
}

/* v3.2: Animated glow border behind countdown */
.countdown::before {
  background: linear-gradient(135deg, #f59e0b, #ef4444, #ec4899, #f59e0b);
  background-size: 300% 300%;
  filter: blur(8px);
  animation: timerBorderGlow 3s ease infinite;
}

/* v3.2: Inner border pulse */
.countdown::after {
  border: 2px solid rgba(245, 158, 11, 0.5);
  animation: timerInnerGlow 1s ease-in-out infinite;
}

/* v3.2: Much bigger, more dramatic timer value */
.time-value {
  font-size: 6rem;
  font-weight: 800;
  background: linear-gradient(135deg, #fbbf24, #f59e0b, #ef4444, #ec4899);
  animation: timerPulse 1s ease-in-out infinite, timerGradientShift 4s ease
      infinite;
  filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.4));
}

/* v3.2: Enhanced "remaining" label */
.time-label {
  font-size: 1.1rem;
  color: #fbbf24;
  letter-spacing: 4px;
  font-weight: 600;
  animation: timeLabelPulse 2s ease-in-out infinite;
}
```

**New Keyframe Animations (Lines 824-899):**

| Animation            | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `timerPulse`         | Scale + glow intensity pulse on each second |
| `timerGradientShift` | Smooth color gradient movement              |
| `timerContainerGlow` | Outer box shadow pulsing                    |
| `timerBorderGlow`    | Animated gradient border                    |
| `timerInnerGlow`     | Inner border color pulse                    |
| `timeLabelPulse`     | Subtle label letter-spacing animation       |

**Responsive Timer Sizing:**

| Breakpoint       | Timer Size |
| ---------------- | ---------- |
| Desktop (>900px) | 6rem       |
| Tablet (≤900px)  | 4.5rem     |
| Mobile (≤600px)  | 3.5rem     |

---

### Visual Comparison

```
BEFORE (v3.1):
┌─────────────────────────────────┐
│          1:30                   │  ← Plain 4rem text
│        remaining                │
└─────────────────────────────────┘

AFTER (v3.2):
╔═══════════════════════════════════╗
║  ✨ ░▒▓█ 1:30 █▓▒░ ✨           ║  ← 6rem with glow!
║       REMAINING                   ║  ← Animated label
║  🔥 Glowing animated border 🔥   ║
╚═══════════════════════════════════╝
```

---

### Chat Message Order Comparison

```
BEFORE (v3.1): Newest at BOTTOM (scroll down to see)
┌────────────────────────────────┐
│ [1.234s] Alice: hello          │  ← Oldest
│ [2.567s] Bob: hi there         │
│ [3.890s] Charlie: hey          │  ← Newest (have to scroll)
└────────────────────────────────┘

AFTER (v3.2): Newest at TOP (always visible!)
┌────────────────────────────────┐
│ [3.890s] Charlie: hey          │  ← Newest (immediately visible!)
│ [2.567s] Bob: hi there         │
│ [1.234s] Alice: hello          │  ← Oldest (scroll down to see)
└────────────────────────────────┘
```

---

### Why These Changes?

1. **Latest comments on top**: Users want to see the most recent activity immediately. No more scrolling to catch up with the chat.

2. **Bigger timer**: The countdown is the most important UI element during a quiz. Making it bigger and more attractive:

   - Creates excitement and urgency
   - Easier to see from a distance
   - More engaging visual feedback
   - Professional, polished appearance

3. **Fluid animations**: The glowing effects and smooth animations:
   - Draw attention to the timer
   - Provide visual feedback that the quiz is active
   - Create a modern, dynamic feel
   - Make the experience more enjoyable

---

## [v3.1.0] - 2025-12-11

### Summary

Enhancement release: Chat now displays without delay when timer is not active, and leaderboard panel can be toggled (hide/unhide) smoothly.

---

### Files Modified

| File         | Path                  | Lines     | Change Type  |
| ------------ | --------------------- | --------- | ------------ |
| App.jsx      | `/client/src/App.jsx` | 583       | **Enhanced** |
| App.css      | `/client/src/App.css` | 860+      | **Enhanced** |
| CHANGELOG.md | `/CHANGELOG.md`       | This file | Updated      |

---

### Detailed Changes

#### 1. Frontend: `client/src/App.jsx`

**New State Variable:**

```javascript
// Line 71: New state for leaderboard panel visibility
const [showLeaderboard, setShowLeaderboard] = useState(false);
```

**Updated Auto-Scroll Logic (Lines 234-240):**

```javascript
// BEFORE (v3.0): Only scrolled when sessionStatus === "running"
if (sessionStatus === "running") {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}

// AFTER (v3.1): Scrolls for both 'idle' and 'running' states
if (sessionStatus !== "ended") {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}
```

**New Event Handler (Lines 291-293):**

```javascript
// Toggle leaderboard panel visibility
const handleToggleLeaderboard = () => {
  setShowLeaderboard((prev) => !prev);
};
```

**New UI Elements:**

```
Lines 344-368: Header Controls
├── .header-controls container
├── Toggle button (show/hide rankings)
└── Connection status

Lines 446-454: Chat Header Row
├── .chat-header-row container
├── Section title
└── Message count badge

Lines 507-523: Leaderboard Header
├── .leaderboard-header container
├── Section title
└── Close button (✕)
```

**Session Update Logic Changes (Lines 126-147):**

```javascript
// v3.1: Auto-show/hide leaderboard based on session status
if (data.status === "running") {
  setShowLeaderboard(false); // Hide during quiz
}
if (data.status === "ended") {
  setShowLeaderboard(true); // Auto-show when quiz ends
}
if (data.status === "idle") {
  setShowLeaderboard(false); // Hide on reset
}
```

---

#### 2. Styles: `client/src/App.css`

**New CSS Classes Added:**

| Class                            | Purpose                         | Lines   |
| -------------------------------- | ------------------------------- | ------- |
| `.header-controls`               | Container for header buttons    | 124-128 |
| `.toggle-leaderboard-btn`        | Toggle button styling           | 137-163 |
| `.toggle-leaderboard-btn.active` | Active state when panel visible | 156-163 |
| `.chat-header-row`               | Row for chat title + count      | 386-391 |
| `.message-count`                 | Message counter badge           | 400-406 |
| `.leaderboard-header`            | Row for title + close btn       | 519-524 |
| `.close-panel-btn`               | Close button inside panel       | 533-552 |

**Updated Classes:**

```css
/* .section-title - Removed margin-bottom (Line 413-414) */
margin: 0; /* Was: margin-bottom: 1rem */
```

---

### Behavior Changes

| Feature                | Before (v3.0)               | After (v3.1)                   |
| ---------------------- | --------------------------- | ------------------------------ |
| Chat in idle state     | Static, no auto-scroll      | Live, auto-scrolls             |
| Empty state message    | "Start a timer to begin..." | "Waiting for chat messages..." |
| Leaderboard visibility | Only when session ended     | Toggleable via button          |
| Leaderboard close      | Not possible                | Close button + header toggle   |

---

### New UI Flow

```
v3.1 LEADERBOARD TOGGLE FLOW:

1. Quiz ends
   └── setShowLeaderboard(true) automatically

2. User clicks "Hide Rankings" button in header
   └── setShowLeaderboard(false)
   └── Panel slides out smoothly

3. User clicks "Show Rankings" button
   └── setShowLeaderboard(true)
   └── Panel slides in smoothly

4. User clicks ✕ close button inside panel
   └── Same as clicking "Hide Rankings"

5. User starts new quiz
   └── setShowLeaderboard(false) automatically
```

---

### Why These Changes?

1. **Chat always visible**: Users want to see live chat activity even before starting a quiz. This gives them a preview of chat engagement level.

2. **Leaderboard toggle**: After quiz ends, users may want to focus on chat or leaderboard independently. The toggle provides flexibility without losing data.

3. **Better UX**: Message count shows activity level. Close button inside panel is more intuitive than going to header.

---

## [v3.0.0] - 2025-12-11

### Summary

Major feature release: Added Quiz/Competition System with timer-based response tracking, duplicate detection, and leaderboard visualization.

---

### Files Modified

| File                    | Path                       | Lines     | Change Type                 |
| ----------------------- | -------------------------- | --------- | --------------------------- |
| index.js                | `/index.js`                | 497       | **Major Rewrite**           |
| App.jsx                 | `/client/src/App.jsx`      | 429       | **Major Rewrite**           |
| App.css                 | `/client/src/App.css`      | 775       | **Major Rewrite**           |
| README.md               | `/README.md`               | 648       | Updated (previous session)  |
| YOUTUBEI_JS_FEATURES.md | `/YOUTUBEI_JS_FEATURES.md` | 500+      | New file (previous session) |
| CHANGELOG.md            | `/CHANGELOG.md`            | This file | New file                    |

---

### Detailed Changes

#### 1. Backend: `index.js`

**New Features Added:**

```
Lines 59-128: SESSION STATE MANAGEMENT
├── session object with status, startTime, duration, userResponses
├── resetSession() function
└── calculateRankings() function
```

```
Lines 148-274: SOCKET.IO EVENT HANDLERS
├── 'start-timer' - Starts new quiz session
│   ├── Resets previous session data
│   ├── Records start time
│   ├── Sets timeout for auto-end
│   └── Broadcasts to all clients
├── 'stop-timer' - Manual stop
│   ├── Calculates rankings
│   └── Broadcasts results
└── 'reset-session' - Returns to idle state
```

```
Lines 404-466: QUIZ TRACKING IN CHAT POLLING
├── Response time calculation (now - sessionStart)
├── Duplicate detection (userResponses.has(author))
├── First response recording
├── isDuplicate flag in emitted messages
└── responseTime included in message payload
```

```
Lines 488-494: GRACEFUL SHUTDOWN
└── process.on('SIGINT') handler
```

**Socket Events (New):**

| Event            | Direction       | Payload                                                    |
| ---------------- | --------------- | ---------------------------------------------------------- |
| `start-timer`    | Client → Server | `{ duration: 30\|60\|120\|180 }`                           |
| `stop-timer`     | Client → Server | (none)                                                     |
| `reset-session`  | Client → Server | (none)                                                     |
| `session-update` | Server → Client | `{ status, duration, timeRemaining }`                      |
| `rankings`       | Server → Client | `[{ rank, author, responseTime, responseCount, message }]` |

**Modified Message Payload:**

```javascript
// Before (v2.x)
{
  timeString: "12.345s",
  author: "Username",
  message: "hello"
}

// After (v3.0)
{
  timeString: "12.345s",
  author: "Username",
  message: "hello",
  isDuplicate: false,        // NEW: duplicate detection
  responseTime: "5.234"      // NEW: seconds from quiz start
}
```

---

#### 2. Frontend: `client/src/App.jsx`

**New State Variables:**

```javascript
// Lines 38-53
const [messages, setMessages] = useState([]);
const [sessionStatus, setSessionStatus] = useState("idle"); // NEW
const [timeRemaining, setTimeRemaining] = useState(0); // NEW
const [duration, setDuration] = useState(0); // NEW
const [rankings, setRankings] = useState([]); // NEW
const [isConnected, setIsConnected] = useState(false);
const socketRef = useRef(null); // NEW
```

**New Event Listeners:**

```javascript
// Lines 94-104: session-update handler
socket.on("session-update", (data) => {
  setSessionStatus(data.status);
  setDuration(data.duration);
  setTimeRemaining(data.timeRemaining);
  if (data.status === "running") {
    setMessages([]);
    setRankings([]);
  }
});

// Lines 129-132: rankings handler
socket.on("rankings", (data) => {
  setRankings(data);
});
```

**New Effects:**

```javascript
// Lines 147-165: Timer countdown effect
useEffect(() => {
  if (sessionStatus === "running" && timeRemaining > 0) {
    interval = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);
  }
}, [sessionStatus, timeRemaining]);
```

**New Event Handlers:**

```javascript
// Lines 188-214
handleStartTimer(seconds); // Emits 'start-timer'
handleStopTimer(); // Emits 'stop-timer'
handleReset(); // Emits 'reset-session'
```

**New Helper Functions:**

```javascript
// Lines 223-253
formatTime(seconds); // Returns "M:SS" format
getBarWidth(responseTime); // Calculates bar chart width
getRankBadge(rank); // Returns "1st", "2nd", "3rd", "#4"
```

**UI Structure:**

```
App Container
├── Header
│   ├── Title: "YouTube Live Quiz"
│   └── Connection Status
├── Main Content
│   ├── Left Panel
│   │   ├── Timer Section
│   │   │   ├── [IDLE] Timer buttons (30s, 60s, 120s, 180s)
│   │   │   ├── [RUNNING] Countdown + Progress bar + Stop btn
│   │   │   └── [ENDED] "Quiz Ended!" + Reset button
│   │   └── Chat Section
│   │       └── Messages list (with duplicate badges)
│   └── Right Panel (slides in when ended)
│       └── Leaderboard
│           └── Top 25 with bar charts
```

---

#### 3. Styles: `client/src/App.css`

**New CSS Classes:**

| Class                | Purpose                   | Lines   |
| -------------------- | ------------------------- | ------- |
| `.app-container`     | Main layout container     | 38-46   |
| `.app-header`        | Header with glassmorphism | 51-60   |
| `.connection-status` | Online/offline indicator  | 72-108  |
| `.timer-section`     | Timer controls container  | 134-138 |
| `.timer-buttons`     | Timer selection grid      | 141-155 |
| `.timer-btn`         | Individual timer buttons  | 157-193 |
| `.timer-display`     | Countdown display         | 196-226 |
| `.countdown`         | Large time display        | 203-208 |
| `.time-value`        | Animated countdown number | 210-219 |
| `.progress-bar`      | Timer progress            | 229-256 |
| `.stop-btn`          | Stop timer button         | 258-274 |
| `.timer-ended`       | End state UI              | 277-307 |
| `.chat-section`      | Chat container            | 312-323 |
| `.chat-frozen`       | Dimmed state when ended   | 321-323 |
| `.message-item`      | Chat message row          | 344-363 |
| `.duplicate`         | Duplicate message styling | 360-363 |
| `.response-time`     | Response time badge       | 366-375 |
| `.duplicate-badge`   | "DUP" indicator           | 378-385 |
| `.right-panel`       | Leaderboard container     | 409-420 |
| `.leaderboard-item`  | Ranking entry             | 439-469 |
| `.rank-badge`        | Rank number badge         | 472-496 |
| `.bar-container`     | Bar chart container       | 528-535 |
| `.bar`               | Animated bar              | 537-555 |

**New Animations:**

| Animation        | Purpose              | Lines   |
| ---------------- | -------------------- | ------- |
| `fadeIn`         | Fade in elements     | 583-590 |
| `slideDown`      | Slide from top       | 592-601 |
| `slideIn`        | Slide from left      | 603-612 |
| `slideInRight`   | Slide from right     | 614-623 |
| `bounceIn`       | Bounce entrance      | 625-640 |
| `countdownPulse` | Timer pulse effect   | 642-650 |
| `pulse`          | Connection indicator | 652-660 |
| `shimmer`        | Progress bar shine   | 662-669 |
| `barGrow`        | Bar chart grow       | 671-675 |
| `goldGlow`       | Gold badge glow      | 677-685 |

**Responsive Breakpoints:**

| Breakpoint | Changes                 | Lines   |
| ---------- | ----------------------- | ------- |
| 1200px     | Narrower leaderboard    | 711-716 |
| 900px      | Stack layout vertically | 718-743 |
| 600px      | Mobile optimizations    | 745-774 |

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    v3.0 SYSTEM ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐                      ┌──────────────────┐
│   React Client   │◄────Socket.io────────│  Express Server  │
│                  │                      │                  │
│  ┌────────────┐  │   start-timer        │  ┌────────────┐  │
│  │Timer UI    │──┼──────────────────────►  │ Session    │  │
│  │            │  │                      │  │ Manager    │  │
│  │ [30s][60s] │  │   session-update     │  │            │  │
│  │[120s][180s]│◄─┼──────────────────────┤  │ status     │  │
│  └────────────┘  │                      │  │ startTime  │  │
│                  │   chat-message       │  │ responses  │  │
│  ┌────────────┐  │   (with responseTime)│  └─────┬──────┘  │
│  │Chat View   │◄─┼──────────────────────┤        │         │
│  │            │  │                      │        │         │
│  │ Messages   │  │   rankings           │        ▼         │
│  │ Duplicates │◄─┼──────────────────────┤  ┌────────────┐  │
│  └────────────┘  │                      │  │ YouTube    │  │
│                  │                      │  │ Polling    │  │
│  ┌────────────┐  │                      │  │            │  │
│  │Leaderboard │  │                      │  │ 100ms loop │  │
│  │            │  │                      │  └────────────┘  │
│  │ Top 25     │  │                      │        │         │
│  │ Bar Charts │  │                      │        ▼         │
│  └────────────┘  │                      │  ┌────────────┐  │
│                  │                      │  │ Innertube  │  │
└──────────────────┘                      │  │ (YouTube)  │  │
                                          │  └────────────┘  │
                                          └──────────────────┘
```

---

### Data Flow

```
1. USER CLICKS "60s" BUTTON
   │
   ▼
2. CLIENT: socket.emit('start-timer', { duration: 60 })
   │
   ▼
3. SERVER: Receives 'start-timer'
   ├── resetSession()
   ├── session.status = 'running'
   ├── session.startTime = new Date()
   ├── session.duration = 60
   ├── io.emit('session-update', {...})
   └── setTimeout(endSession, 60000)
   │
   ▼
4. CLIENT: Receives 'session-update'
   ├── setSessionStatus('running')
   ├── setTimeRemaining(60)
   ├── setMessages([])
   └── Start countdown interval
   │
   ▼
5. YOUTUBE CHAT MESSAGE ARRIVES
   │
   ▼
6. SERVER: Process in poll()
   ├── responseTime = (now - session.startTime) / 1000
   ├── Check userResponses.has(author)
   │   ├── YES: isDuplicate = true, increment count
   │   └── NO:  Record first response
   └── io.emit('chat-message', { ..., isDuplicate, responseTime })
   │
   ▼
7. CLIENT: Receives 'chat-message'
   ├── Add to messages array
   └── Display with badges if duplicate
   │
   ▼
8. TIMER ENDS (60 seconds elapsed)
   │
   ▼
9. SERVER: setTimeout callback fires
   ├── session.status = 'ended'
   ├── rankings = calculateRankings()
   ├── io.emit('session-update', { status: 'ended', ... })
   └── io.emit('rankings', rankings)
   │
   ▼
10. CLIENT: Receives 'rankings'
    ├── setRankings(rankings)
    └── Display leaderboard panel
```

---

### Version History Summary

| Version  | Date           | Description                                       |
| -------- | -------------- | ------------------------------------------------- |
| v1.0     | -              | CLI basic chat fetcher                            |
| v1.1     | -              | Output suppression for library noise              |
| v1.2     | -              | Relative timestamps added                         |
| v1.3     | -              | nodemon for dev experience                        |
| v1.4     | -              | Web UI with Express + Socket.io                   |
| v2.0     | -              | React frontend migration                          |
| v2.1     | -              | Low-latency 100ms polling                         |
| **v3.0** | **2025-12-11** | **Quiz system with timer, rankings, leaderboard** |

---

### Breaking Changes in v3.0

1. **Message payload changed**: Now includes `isDuplicate` and `responseTime` fields
2. **New socket events**: `start-timer`, `stop-timer`, `reset-session`, `session-update`, `rankings`
3. **UI completely redesigned**: Two-panel layout with leaderboard
4. **Session state required**: Server now maintains quiz session state

---

### How to Use v3.0

```bash
# Install dependencies (if not done)
npm install
cd client && npm install && npm run build && cd ..

# Run server
npm run dev

# Or with specific video
npm run dev -- VIDEO_ID

# Open browser
open http://localhost:3001
```

**Quiz Flow:**

1. Click timer button (30s, 60s, 120s, or 180s)
2. Watch chat messages scroll with response times
3. When timer ends, see leaderboard with rankings
4. Click "Start New Quiz" to restart

---

### Files Created in This Session

| File                      | Purpose                       |
| ------------------------- | ----------------------------- |
| `CHANGELOG.md`            | This file - version tracking  |
| `README.md`               | Updated documentation         |
| `YOUTUBEI_JS_FEATURES.md` | youtubei.js library reference |

---

## Performance Considerations

This section documents the performance limitations and design decisions made to keep the application fast and responsive.

### Storage Limits

| Feature                          | Limit | Reason                           |
| -------------------------------- | ----- | -------------------------------- |
| **Ranking entries per timer**    | 50    | Keeps leaderboard queries fast   |
| **User responses per timer**     | 200   | Balances completeness vs storage |
| **Chat messages in memory**      | 500   | Prevents browser memory bloat    |
| **Rankings in /db viewer**       | 50    | Keeps page load fast             |
| **User responses in /db viewer** | 100   | Keeps page load fast             |

### Database Design Choices

| Decision                                       | Rationale                                                 |
| ---------------------------------------------- | --------------------------------------------------------- |
| **Separate `timer_user_responses` table**      | Keeps leaderboard queries on `timer_ranking_entries` fast |
| **Composite primary key (timer_id, username)** | Prevents duplicate entries, enables efficient lookups     |
| **Indexed by username and is_correct**         | Fast filtering for user history and correct/wrong queries |
| **No foreign keys**                            | DuckDB performs better without FK constraints             |

### Write Timing

| Operation                | When                          | Impact                  |
| ------------------------ | ----------------------------- | ----------------------- |
| **User profile updates** | During quiz (on each message) | Minimal - simple upsert |
| **Ranking entries**      | After timer ends              | None during quiz        |
| **User responses**       | After timer ends              | None during quiz        |
| **Timer metadata**       | At timer start/end            | None during quiz        |

### Memory Usage

| Component                   | Size                   | Notes               |
| --------------------------- | ---------------------- | ------------------- |
| `session.userResponses` Map | ~1KB per 100 users     | Cleared on reset    |
| `messages` array (client)   | ~50KB for 500 messages | Oldest trimmed      |
| Database file               | Grows with usage       | ~10KB per timer run |

### Polling Performance

| Setting               | Value       | Trade-off                              |
| --------------------- | ----------- | -------------------------------------- |
| YouTube API poll rate | 100ms       | Lower = more API calls, faster updates |
| Error retry delay     | 2000ms      | Prevents hammering on errors           |
| Socket.io broadcast   | Per message | No batching for real-time feel         |

### Scaling Considerations

For high-volume streams (1000+ messages/minute):

- Consider increasing poll interval to 200-500ms
- Messages array may need more aggressive trimming
- Database writes are async and non-blocking
- User response limit (200) may truncate late responders

### Database File Management

The DuckDB database file (`server/data/quiz.duckdb`) can be safely deleted to reset all data:

```bash
rm server/data/quiz.duckdb server/data/quiz.duckdb.wal
```

The schema will be recreated automatically on next server start.
