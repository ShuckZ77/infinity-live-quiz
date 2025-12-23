# Antigravity Project Understanding: YouTube Live Chat Quiz

## 1. Executive Summary

**Current Version:** 3.12.2

This is a **Real-Time Interactive Quiz System** that uses YouTube Live Chat as a game controller. Viewers participate by typing answers in chat, and the system tracks response times to create live leaderboards.

**Core Value Proposition:**

- **Zero Friction:** Participants use standard YouTube chat
- **Instant Feedback:** Real-time leaderboard with millisecond precision
- **Persistent Analytics:** User performance tracked across sessions
- **Browser-Based:** No CLI required since v3.10
- **Video Context:** Header displays video title, channel, approx views (v3.11)
- **Video Leaderboard:** Per-video scoring with +4 pts per correct answer (v3.12)

---

## 2. Architectural Overview

### Backend Stack

```
Node.js + Express + Socket.io + sql.js (SQLite) + youtubei.js
```

| Component   | Role                            |
| ----------- | ------------------------------- |
| Express     | HTTP API, Static file serving   |
| Socket.io   | Real-time bi-directional events |
| sql.js      | Pure JavaScript SQLite database |
| youtubei.js | YouTube internal API client     |

### Frontend Stack

```
React + Vite + Vanilla CSS
```

| Component          | Role                             |
| ------------------ | -------------------------------- |
| useSocket hook     | Connection & state management    |
| VideoIdInput       | Video selection UI (v3.10)       |
| Header             | Video metadata display (v3.11)   |
| TimerSection       | Quiz controls                    |
| LeaderboardPanel   | Rankings display                 |
| SessionLeaderboard | Video leaderboard footer (v3.12) |

---

## 3. Data Flow

```
YouTube Chat → youtubei.js → Server (100ms poll)
                                ↓
                          Process Message
                                ↓
                    ┌──────────────────────┐
                    │   Is Quiz Running?   │
                    └──────────────────────┘
                         Yes ↓      ↓ No
                    Calculate     Store
                    Response      Timestamp
                    Time          Only
                         ↓           ↓
                    Store in    Emit to
                    RAM Map     Frontend
                         ↓
                    Emit to
                    Frontend
```

### State Storage

| Type                          | Data                                      | Lifetime                  |
| ----------------------------- | ----------------------------------------- | ------------------------- |
| RAM (`session.userResponses`) | Current quiz answers                      | Until timer ends or crash |
| sql.js (SQLite)               | Users, Sessions, Rankings, Videos, Scores | Permanent                 |

---

## 4. Performance Optimizations (v3.9.1+)

### ✅ Fire-and-Forget Database Writes

Database operations are no longer blocking:

```javascript
// Old (blocking)
await users.upsertUser(username);

// New (async, non-blocking)
users.upsertUser(username).catch(console.error);
```

### ✅ Timeout Protection

YouTube fetches have a 5-second race timeout to prevent hanging.

### ✅ Startup Resilience (v3.10.1)

- `predev` script kills stale processes on port 3001
- Database initialization removes stale `.wal` files
- Server starts cleanly after abrupt termination

### ✅ Video Metadata Refresh (v3.11)

- Metadata refreshes every 60 seconds (fire-and-forget)
- Header updates with title, channel, approx views
- Non-blocking database updates for videos table

---

## 5. Feature Timeline

| Version | Feature                                               |
| ------- | ----------------------------------------------------- |
| v3.5    | SQLite for persistent storage                         |
| v3.6    | Timer rankings with unique IDs (DDMMYYHHMMSS)         |
| v3.7    | 5-second countdown, Question types (MCQ/Fill-blank)   |
| v3.8    | Full response history (correct + wrong)               |
| v3.9    | Answer distribution pie chart, Async DB writes        |
| v3.10   | UI-based Video ID input, dynamic video switching      |
| v3.10.1 | Startup resilience (predev, WAL cleanup)              |
| v3.11   | Video metadata display (title, channel, approx views) |
| v3.12   | Video leaderboard with per-video scoring              |
| v3.13   | **Portable Web App** (removed Electron, uses sql.js)  |

---

## 6. Risk Assessment

### ⚠️ Volatile Session State (Unresolved)

Active quiz answers live in RAM only. Server crash = data loss.

**Mitigation Path:** Redis for session state externalization.

### ⚠️ YouTube API Fragility (Inherent)

`youtubei.js` mimics browser client. YouTube changes may break it.

**Mitigation:** Keep library updated, monitor for errors.

### ⚠️ Approx Views vs Live Viewers (v3.11)

The `approxViews` field shows **total video views**, not concurrent live viewers. The YouTube internal API does not easily expose real-time concurrent viewers through `basic_info.view_count`.

**Future Path:** Use `info.getLiveChat().on('update-metadata')` event for real-time concurrent viewer count via `viewership.view_count`.

### ✅ SQL Injection (Mitigated)

All database queries use parameterized statements.

### ✅ Port Conflicts (Resolved)

`predev` script automatically cleans up before startup.

---

## 7. Recommended Future Work

### Phase 1: Stability

- [ ] Redis for session state (crash recovery)
- [ ] Error alerting (Slack/Discord webhook on crash)
- [ ] Real-time live viewer count via livechat metadata

### Phase 2: Scalability

- [ ] Message queue for decoupling fetch/process
- [ ] Multiple processor workers

### Phase 3: Analytics

- [ ] Enhanced sql.js queries for post-game analysis
- [ ] Historical trend dashboards
- [ ] Video performance analytics

---

## 8. Development Standards

| Aspect        | Observation                                          |
| ------------- | ---------------------------------------------------- |
| Commits       | Semantic versioning (v3.x.x)                         |
| Documentation | Comprehensive README, CHANGELOG                      |
| Code Style    | Clean, well-commented                                |
| Structure     | Domain-driven (`database/`, `hooks/`, `components/`) |

---

## 9. Bottlenecks & Areas for Improvement

### Current Bottlenecks

| Issue                             | Impact                                       | Severity |
| --------------------------------- | -------------------------------------------- | -------- |
| **Single-threaded polling**       | Cannot parallelize chat fetch and processing | Medium   |
| **RAM-only quiz state**           | Server crash loses active quiz data          | High     |
| **Approx views not live viewers** | Confusing UX for hosts                       | Low      |
| **No error alerting**             | Silent failures in production                | Medium   |

### Areas for Improvement

1. **Live Viewer Count**: Implement `getLiveChat().on('update-metadata')` for real-time concurrent viewers
2. **Session State Persistence**: Add Redis for crash recovery
3. **Horizontal Scaling**: Decouple fetch/process with message queue
4. **Monitoring**: Add health endpoints and error webhooks
5. **CI/CD**: Add automated testing and deployment pipeline

### Known Errors (Fixed in v3.11)

| Error                   | Cause                                          | Resolution                       |
| ----------------------- | ---------------------------------------------- | -------------------------------- |
| Lint error in `App.jsx` | `setShowDistributionChart` called in useEffect | Unrelated to v3.11, pre-existing |
| EADDRINUSE on restart   | Port 3001 not released                         | Resolved via `predev` script     |
| SQLite journal files    | Abrupt termination                             | Resolved via cleanup script      |
