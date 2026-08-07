# Infinity Live Quiz

**Version 4.0.0**

A real-time local quiz system powered by YouTube Live Chat. Engage your audience with interactive quizzes, leaderboards, and instant feedback.

## Features

- **Real-time YouTube chat**: Connects to live stream chat through `youtubei.js`.
- **Question types**: Multiple Choice (A/B/C/D) and Fill-in-the-Blanks.
- **Smart timer**: 15s, 30s, 45s, 60s, 90s, 120s, and 180s durations.
- **Answer buffering**: Accepts near-miss answers around timer start/end.
- **Question ranking**: Fastest correct responders per question.
- **Session leaderboard**: Cumulative top 100 participants.
- **Answer distribution**: MCQ pie chart with matching legend colors and green highlight only on the correct option.
- **Local-first database**: Fresh SQLite schema with readable session and question IDs.
- **Database viewers**: Browser viewer at `/db` with paginated table panels, plus terminal viewer through `npm run db`.

## Database Model

The local database is SQLite via `sql.js` and stores quiz data in this shape:

```text
videos -> quiz_sessions -> quiz_runs -> quiz_responses -> session_scores
```

Important tables:

- `users`: YouTube usernames and activity totals.
- `videos`: video metadata and question count.
- `quiz_sessions`: one readable session ID per selected video.
- `quiz_runs`: one readable question/runtime ID per timer.
- `quiz_responses`: one first-response row per user per question.
- `quiz_response_attempts`: every answer attempt, including duplicates.
- `session_scores`: cumulative leaderboard per session/video.

Readable IDs:

- Session: `S-YYYYMMDD-HHMMSS-001`
- Question/runtime: `Q-YYYYMMDD-HHMMSS-001`

## How to Use

### Prerequisites

- **Node.js**: You must have Node.js installed on your computer. [Download here](https://nodejs.org/).

### Local Installation

1.  Open a terminal in the project folder.
2.  Install dependencies:
    ```bash
    npm run install:all
    ```
    The checked-in lockfiles reproduce the dependency versions used for the
    security-audited release.
3.  Build the frontend:
    ```bash
    npm run build
    ```

### Running the App

```bash
npm start
```

Then open `http://localhost:3001` in your browser.

For development with Nodemon:

```bash
npm run dev
```

Database viewers:

```bash
npm run db
```

Browser: `http://localhost:3001/db`

### Running a Quiz

1.  **Paste Video ID**: In the browser, enter the ID of your active YouTube Live stream (e.g., `dQw4w9WgXcQ`).
2.  **Connect**: Click "Connect". The app will fetch metadata and chat status.
3.  **Setup Quiz**:
    - Select Question Type (MCQ or Fill-in-Blank).
    - Choose Timer Duration.
4.  **Start**: Click a timer button. A 5-second countdown will start, followed by the quiz timer.
5.  **Quiz Active**: Users type answers in YouTube chat.
6.  **End**: When the timer stops, click "Stop Timer" or wait for it to finish.
7.  **Select Answer**: A popup will appear. Select the correct answer to calculate scores.
8.  **Results**: Answer distribution appears, the correct option highlights green, and the Session Leaderboard updates.

## Supabase Direction

Supabase is planned as the remote storage layer.

- Local SQLite remains the first write target.
- The app should upload changed rows to Supabase every 60 seconds while running.
- Supabase sync should use an outbox/watermark so it does not rescan every table repeatedly.
- Live chat handlers should not call Supabase directly, keeping quiz timing fast and resilient.

## Troubleshooting

- **"Node.js is not installed"**: Please install Node.js from the official website.
- **Browser doesn't open**: Manually open `http://localhost:3001` in Chrome or Edge.
- **Port 3001 in use**: Close any other running instances of the app.
- **No chat messages**: Ensure the video is LIVE and chat is enabled.
- **UI is not built**: Run `npm run build`, then restart the app.
- **Inspect local DB**: Open `/db` or run `npm run db`.
- **Negative answer time**: Rebuild/restart. Current code clamps pre-start buffered answers to `0.000s`.

## License

ISC License
