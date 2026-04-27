-- ============================================
-- YouTube Live Chat Quiz System - Database Schema
-- Database: SQLite (better-sqlite3)
-- Version: 4.0.0 (Migrated from DuckDB)
-- ============================================

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    first_seen TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now')),
    total_comment_count INTEGER DEFAULT 0
);

-- ============================================
-- TABLE: videos
-- ============================================
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

-- ============================================
-- TABLE: sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    timer_count_15s INTEGER DEFAULT 0,
    timer_count_30s INTEGER DEFAULT 0,
    timer_count_45s INTEGER DEFAULT 0,
    timer_count_60s INTEGER DEFAULT 0,
    timer_count_90s INTEGER DEFAULT 0,
    timer_count_120s INTEGER DEFAULT 0,
    timer_count_180s INTEGER DEFAULT 0,
    total_timer_runs INTEGER DEFAULT 0
);

-- ============================================
-- TABLE: user_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    username TEXT NOT NULL,
    session_id INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0,
    first_message_at TEXT DEFAULT (datetime('now')),
    last_message_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (username, session_id)
);

-- ============================================
-- TABLE: timer_rankings
-- ============================================
CREATE TABLE IF NOT EXISTS timer_rankings (
    timer_id TEXT PRIMARY KEY,
    session_id INTEGER NOT NULL,
    video_id TEXT NOT NULL,
    date TEXT NOT NULL,
    duration INTEGER NOT NULL,
    question_type TEXT DEFAULT 'mcq',
    correct_answer TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    total_participants INTEGER DEFAULT 0,
    answer_count_a INTEGER DEFAULT 0,
    answer_count_b INTEGER DEFAULT 0,
    answer_count_c INTEGER DEFAULT 0,
    answer_count_d INTEGER DEFAULT 0
);

-- ============================================
-- TABLE: timer_ranking_entries
-- ============================================
CREATE TABLE IF NOT EXISTS timer_ranking_entries (
    timer_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    username TEXT NOT NULL,
    response_time_seconds REAL NOT NULL,
    message TEXT,
    PRIMARY KEY (timer_id, rank)
);

-- ============================================
-- TABLE: timer_user_responses
-- ============================================
CREATE TABLE IF NOT EXISTS timer_user_responses (
    timer_id TEXT NOT NULL,
    username TEXT NOT NULL,
    response_time_seconds REAL NOT NULL,
    message TEXT,
    is_correct INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (timer_id, username)
);

-- ============================================
-- TABLE: video_scores
-- ============================================
CREATE TABLE IF NOT EXISTS video_scores (
    video_id TEXT NOT NULL,
    username TEXT NOT NULL,
    total_points INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_answers INTEGER DEFAULT 0,
    total_response_time_ms INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (video_id, username)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);
CREATE INDEX IF NOT EXISTS idx_sessions_video_id ON sessions(video_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_timer_rankings_session ON timer_rankings(session_id);
CREATE INDEX IF NOT EXISTS idx_timer_rankings_video ON timer_rankings(video_id);
CREATE INDEX IF NOT EXISTS idx_timer_rankings_date ON timer_rankings(date);
CREATE INDEX IF NOT EXISTS idx_ranking_entries_username ON timer_ranking_entries(username);
CREATE INDEX IF NOT EXISTS idx_user_responses_username ON timer_user_responses(username);
CREATE INDEX IF NOT EXISTS idx_user_responses_correct ON timer_user_responses(timer_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_video_scores_points ON video_scores(video_id, total_points);
