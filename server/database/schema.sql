-- ============================================
-- Infinity Live Quiz - Fresh Optimized Schema
-- Database: SQLite via sql.js
-- Model: videos -> quiz_sessions -> quiz_runs -> responses -> scores
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    first_seen TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now')),
    total_comment_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    channel_id TEXT,
    channel_name TEXT,
    title TEXT,
    thumbnail_url TEXT,
    live_start_timestamp TEXT,
    first_seen_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT DEFAULT (datetime('now')),
    approx_views INTEGER DEFAULT 0,
    questions_asked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
    session_id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT DEFAULT 'active',
    total_runs INTEGER DEFAULT 0,
    total_responses INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_sessions (
    username TEXT NOT NULL,
    session_id TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    first_message_at TEXT DEFAULT (datetime('now')),
    last_message_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (username, session_id)
);

CREATE TABLE IF NOT EXISTS quiz_runs (
    run_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    date TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    question_type TEXT DEFAULT 'mcq',
    correct_answer TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    finalized_at TEXT,
    total_responses INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    answer_count_a INTEGER DEFAULT 0,
    answer_count_b INTEGER DEFAULT 0,
    answer_count_c INTEGER DEFAULT 0,
    answer_count_d INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_responses (
    run_id TEXT NOT NULL,
    username TEXT NOT NULL,
    raw_answer TEXT NOT NULL,
    normalized_answer TEXT NOT NULL,
    mcq_option TEXT,
    first_answered_at TEXT NOT NULL,
    last_answered_at TEXT NOT NULL,
    answer_count INTEGER DEFAULT 1,
    response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
    is_correct INTEGER DEFAULT 0,
    question_rank INTEGER,
    points_awarded INTEGER DEFAULT 0,
    PRIMARY KEY (run_id, username)
);

CREATE TABLE IF NOT EXISTS quiz_response_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    username TEXT NOT NULL,
    raw_answer TEXT NOT NULL,
    normalized_answer TEXT NOT NULL,
    mcq_option TEXT,
    attempted_at TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0)
);

CREATE TABLE IF NOT EXISTS session_scores (
    session_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    username TEXT NOT NULL,
    total_points INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_answers INTEGER DEFAULT 0,
    total_correct_response_time_ms INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (session_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);
CREATE INDEX IF NOT EXISTS idx_videos_last_seen ON videos(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_video ON quiz_sessions(video_id, started_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_runs_session_started ON quiz_runs(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_quiz_runs_video_started ON quiz_runs(video_id, started_at);
CREATE INDEX IF NOT EXISTS idx_quiz_runs_date ON quiz_runs(date);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_correct ON quiz_responses(run_id, is_correct, response_time_ms);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_username ON quiz_responses(username, first_answered_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lookup ON quiz_response_attempts(run_id, username, attempted_at);
CREATE INDEX IF NOT EXISTS idx_session_scores_rank ON session_scores(session_id, total_points, total_correct_response_time_ms);
