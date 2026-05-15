# Start App

- Open terminal in this folder:
  `infinity-live-quiz`

- Install dependencies on a new machine:
  ```bash
  npm run install:all
  ```

- Build the React UI before running with Node:
  ```bash
  npm run build
  ```

- Run app with Node:
  ```bash
  npm start
  ```

- Run app with Nodemon for development:
  ```bash
  npm run dev
  ```

- Open the app in browser:
  `http://localhost:3001`

- Open browser database viewer:
  `http://localhost:3001/db`

- Open terminal database viewer:
  ```bash
  npm run db
  ```

- Stop the app:
  Press `Ctrl + C` in the terminal.

- Local DB:
  `server/data/quiz.db`

- Old DB backup:
  `server/data/quiz.backup-20260512-153247.db`

- Current database model:
  `videos -> quiz_sessions -> quiz_runs -> quiz_responses -> session_scores`

- Recent quiz fixes:
  correct MCQ option highlights green only; pre-start answer times clamp to `0.000s`; `/db` tables are paginated/scrollable.

- Supabase next phase:
  Local DB stays the first write target. Supabase upload should run every 60 seconds from a sync queue/watermark, not directly inside live chat handlers.
