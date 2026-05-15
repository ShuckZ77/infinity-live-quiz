# Infinity Live Quiz Database Reference

## Current Direction

- The app now uses a fresh local SQLite database through `sql.js`.
- The old local DB was backed up before reset: `server/data/quiz.backup-20260512-153247.db`.
- The active local DB is `server/data/quiz.db`.
- The app model is: `videos -> quiz_sessions -> quiz_runs -> quiz_responses -> session_scores`.
- Existing frontend socket events and compatibility API names remain usable.
- Server/database code was cleaned after the refactor: stale old-table comments, dead `/db` HTML, and unused legacy write helpers were removed.

## Schema

- `users`: one row per YouTube username, with first seen, last active, and total comment count.
- `videos`: one row per YouTube video ID, including metadata and `questions_asked`.
- `quiz_sessions`: one readable session ID per selected video.
- `user_sessions`: per-user message activity inside a video session.
- `quiz_runs`: one readable question/runtime ID per timer run.
- `quiz_responses`: one first-response row per user per question.
- `quiz_response_attempts`: every answer attempt, including duplicate answers.
- `session_scores`: cumulative leaderboard per session/video.

## Readable IDs

- Session IDs use `S-YYYYMMDD-HHMMSS-001`.
- Question/runtime IDs use `Q-YYYYMMDD-HHMMSS-001`.
- IDs are short, sortable, and timestamp-decodable.
- Compatibility responses still expose `timer_id` mapped from `run_id`.

## Write Flow

- Selecting a video creates or reuses one active `quiz_session`.
- Starting a timer creates one `quiz_run`.
- Every chat answer during `running` or `buffering` writes one `quiz_response_attempt`.
- The first answer per user per question is stored in `quiz_responses`.
- Duplicate answers increment `answer_count` and keep the original first answer/time.
- Pre-start buffered answers are allowed, but response time is clamped to `0` so rankings never show negative seconds.
- Submitting the correct answer finalizes the question:
  - computes correctness,
  - assigns question rank to correct users,
  - updates answer distribution,
  - updates `session_scores`,
  - increments `videos.questions_asked`.

## Ranking Rules

- MCQ answers are case-insensitive and checked by first character only.
- Fill-blank answers are exact after trim and uppercase normalization.
- Question ranking sorts correct answers by fastest `response_time_ms`.
- `response_time_ms` is stored as non-negative milliseconds.
- Session leaderboard sorts by:
  1. `total_points DESC`
  2. average correct response time ascending
  3. `correct_answers DESC`
  4. `username ASC`
- Points remain `+4` per correct answer.

## Performance Notes

- Finalization uses a transaction so responses, ranks, score updates, and counters commit together.
- The DB helper delays disk export while inside a transaction, reducing repeated `sql.js` file writes.
- Timer usage is derived with `GROUP BY duration_seconds`; no wide `timer_count_15s` style columns.
- Main read-path indexes are on session runs, responses by correctness/time, attempts lookup, and session scores.
- Live chat handlers write locally only; future Supabase sync must run outside the hot chat path.
- Startup sanitizes any older negative response times and recomputes affected session score timing totals.

## Browser And API Surface

- `/db` shows a presentable database viewer:
  - summary cards,
  - recent videos,
  - recent sessions,
  - question/runtime rows,
  - recent responses,
  - latest session leaderboard,
  - active users.
- `/db` tables use sticky headers, internal scrollbars, and per-table pagination to avoid long page scrolling.
- Existing API routes stay available:
  - `/api/stats`
  - `/api/sessions`
  - `/api/rankings`
  - `/api/rankings/stats`
  - `/api/rankings/:timerId`
  - `/api/rankings/:timerId/responses`
  - `/api/rankings/:timerId/distribution`
  - `/api/users/:username/answers`

## Result UI

- MCQ answer distribution uses matching vibrant colors in the pie and legend.
- The selected correct option is the only option highlighted in green.
- Other options keep their own non-green colors.

## Recheck Status

- `node --check` passed for the server and database modules.
- `npm run build` passed.
- Correct-answer chart highlight and non-negative response-time fixes were rechecked.
- `npm run db` passed with the new terminal DB viewer.
- Local server started with `npm start`.
- Verified HTTP 200 for `/` and `/db`.
- Verified JSON responses for `/api/stats`, `/api/sessions`, `/api/rankings`, and `/api/rankings/stats`.
- Searched the active server/client code for old storage table names; no active references remain for old tables like `timer_rankings`, `timer_user_responses`, or `video_scores`.
- After cleanup, unused legacy helpers were removed from `rankings.js`, `scores.js`, and `sessions.js`.
- Temporary lifecycle test passed:
  - readable IDs generated,
  - duplicate attempts stored,
  - first response preserved,
  - duplicate answer count tracked,
  - MCQ first-char/case-insensitive matching works,
  - question rank is fastest-correct first,
  - session leaderboard sorts by points then average correct time.

## Supabase Next Phase

- Keep local DB as the first write target so live quiz behavior remains fast and resilient.
- Add Supabase as the remote sync target.
- Upload changed local rows to Supabase every 60 seconds while the app is running.
- Avoid redundant DB I/O by using a local sync queue/watermark instead of scanning every table every minute.
- Recommended sync metadata:
  - add `created_at`, `updated_at`, and `synced_at` where needed,
  - add a small `sync_outbox` table for changed entity type + ID,
  - mark rows synced only after Supabase confirms success.
- Recommended sync loop:
  - collect unsynced outbox rows,
  - batch by table/entity,
  - upsert to Supabase using readable IDs as stable primary keys,
  - update `synced_at` locally in one transaction,
  - retry failed batches on the next minute without blocking quiz writes.
- Do not write directly to Supabase inside live chat handlers; that would make chat/timer responsiveness depend on network latency.

## Current Local DB Note

- The fresh DB is active, but it is no longer completely empty.
- Latest sanity check showed one local active session and 21 users from a recent video connection.
- Test data for lifecycle checks was created under `/tmp`, not inside the active `server/data/quiz.db`.

## Important Caveat

- This repo currently ignores `*.md` in `.gitignore`, except `README_GITHUB.md`.
- This file is useful locally, but it will not appear in `git status` unless `.gitignore` is changed.
