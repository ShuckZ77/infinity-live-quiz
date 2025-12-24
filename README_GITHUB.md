# Infinity Live Quiz

**Version 4.0.0**

A powerful, portable, and real-time quiz system powered by YouTube Live Chat. Engage your audience with interactive quizzes, leaderboards, and instant feedback.

## 🚀 Features

- **Portable Web App**: No installation required. Runs on Windows and macOS.
- **Real-time Integration**: Connects directly to YouTube Live Chat.
- **Session Leaderboard (Top 100)**: Displays top 100 participants with avatars and ranks.
- **Persistent Scoring**: Tracks scores across multiple quiz sessions for the same video.
- **Question Types**: Multiple Choice (A/B/C/D) and Fill-in-the-Blanks.
- **Smart Timer**: 30s, 60s, 120s, 180s durations with on-screen countdown.
- **Responsive UI**: Modern, glassmorphism design that adapts to screen sizes.
- **Cross-Platform**: Built with Node.js and SQLite.

## 🛠️ How to Use

### Prerequisites

- **Node.js**: You must have Node.js installed on your computer. [Download here](https://nodejs.org/).

### Installation

1.  **Download** the `infinity-live-quiz-portable.zip` file.
2.  **Extract** the ZIP file to a folder on your computer.

### Running the App

**For Windows:**

1.  Open the extracted folder.
2.  Double-click `start-windows.bat`.
3.  The console will open, and shortly after, your default browser will launch at `http://localhost:3001`.

**For macOS:**

1.  Open the extracted folder.
2.  Right-click `start-mac.command` and select **Open** (you may need to confirm opening it the first time due to security settings).
3.  The terminal will open, and your browser will launch automatically.

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
8.  **Results**: A bar chart of results will appear, and the Session Leaderboard will update at the bottom.

## ❓ Troubleshooting

- **"Node.js is not installed"**: Please install Node.js from the official website.
- **Browser doesn't open**: Manually open `http://localhost:3001` in Chrome or Edge.
- **Port 3001 in use**: Close any other running instances of the app.
- **No chat messages**: Ensure the video is LIVE and chat is enabled.

## 📄 License

ISC License
