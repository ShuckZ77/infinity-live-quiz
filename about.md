# Infinity Live Quiz - Current Overview

Updated: May 15, 2026

## What This App Does

- Runs live quiz competitions from YouTube Live Chat.
- Lets the host connect a live video, start timed questions, collect chat answers, select the correct answer, and show rankings.
- Supports MCQ answers by first character and fill-blank answers by exact normalized match.
- Shows per-question fastest correct responders and a cumulative session leaderboard.

## Current Architecture

- Root `package.json` orchestrates install, build, start, dev, and DB viewer scripts.
- Backend: `server/index.js` with Express, Socket.IO, YouTube polling, and local SQLite via `sql.js`.
- Frontend: React/Vite in `client/src`.
- Database schema: `server/database/schema.sql`.
- Main DB lifecycle module: `server/database/quiz.js`.
- Browser DB viewer: `http://localhost:3001/db`.
- Terminal DB viewer: `npm run db`.
- `/db` uses compact table panels with sticky headers, internal scrollbars, and pagination.

## Current Database Model

- `users`: YouTube usernames and activity totals.
- `videos`: YouTube video metadata and question count.
- `quiz_sessions`: one readable session per selected video.
- `user_sessions`: per-user activity inside a video session.
- `quiz_runs`: one readable question/runtime per timer.
- `quiz_responses`: one first-response row per user per question.
- `quiz_response_attempts`: every answer attempt, including duplicates.
- `session_scores`: cumulative session leaderboard rows.

Readable IDs:
- Session: `S-YYYYMMDD-HHMMSS-001`
- Question/runtime: `Q-YYYYMMDD-HHMMSS-001`

## Important Logic

- One selected video creates or reuses one active `quiz_session`.
- One timer run equals one quiz question.
- Every chat answer during `running` or `buffering` is stored as an attempt.
- The first answer per user is preserved for ranking.
- Duplicate answers increment `answer_count`.
- Correct MCQ match uses the first character, case-insensitive.
- Correct fill-blank match uses trimmed uppercase equality.
- Correct answers receive `+4` points.
- Question rank is fastest correct answer first.
- Session leaderboard sorts by points, average correct response time, correct count, then username.
- Pre-start buffered answers are accepted but display as `0.000s`, never negative.
- In MCQ results, only the selected correct option is green; other options keep matching pie/legend colors.

## Recent Improvements

- Replaced old confusing table model with `videos -> quiz_sessions -> quiz_runs -> quiz_responses -> session_scores`.
- Backed up the old DB before reset.
- Added readable, timestamp-decodable IDs.
- Added `quiz_response_attempts` for duplicate-answer audit history.
- Added transaction batching for finalization.
- Removed stale old-table code/comments and unused legacy helpers.
- Rebuilt `/db` into a cleaner viewer.
- Updated `npm run db` to use the new schema.
- Fixed negative answer time display from pre-start buffered answers.
- Updated MCQ result colors so the correct option alone highlights green.
- Added `/db` table pagination/scroll panels to reduce long vertical scrolling.

## Verification Status

- `node --check` passed for server and database modules.
- `npm run build` passed.
- `npm run db` passed.
- `npm start` worked.
- `/`, `/db`, `/api/stats`, `/api/sessions`, `/api/rankings`, and `/api/rankings/stats` responded correctly.
- Latest checks also covered the answer chart and response-time clamp.
- Temporary lifecycle test passed for attempts, duplicates, first response, MCQ matching, ranking, and leaderboard.

## Supabase Next Phase

- Keep local SQLite as the first write target for fast live behavior.
- Add Supabase as remote storage.
- Upload changed rows every 60 seconds while the app is running.
- Do not call Supabase directly inside chat/timer hot paths.
- Use a `sync_outbox` or watermark strategy to avoid scanning every table repeatedly.
- Batch upserts to Supabase and mark rows synced only after confirmed success.

## Remaining Risks

- Host controls are still not authenticated.
- YouTube display names are still the user identity; channel ID identity would be safer.
- No automated test suite exists yet.
- Local DB is plain SQLite, not encrypted.
- Supabase sync still needs implementation.

## Local Docs Caveat

- The repo ignores `*.md` except `README_GITHUB.md`.
- Local docs like `start.md`, `about.md`, and `database-reference.md` may not show in git until `.gitignore` is changed.
