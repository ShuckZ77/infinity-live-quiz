/**
 * Application Constants
 *
 * Centralized configuration values used throughout the app.
 * Makes it easy to modify settings without hunting through code.
 */

// Timer duration options (in seconds)
export const TIMER_DURATIONS = [30, 60, 120, 180];

// Session status values
export const SESSION_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  ENDED: 'ended',
};

// Question types for quiz (v3.7)
export const QUESTION_TYPES = {
  MCQ: 'mcq',
  FILL_BLANK: 'fill-blank',
};

// Maximum messages to keep in memory (prevents unbounded growth)
export const MAX_MESSAGES = 500;

// Socket.io event names
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SESSION_UPDATE: 'session-update',
  CHAT_MESSAGE: 'chat-message',
  RANKINGS: 'rankings',
  ANSWER_DISTRIBUTION: 'answer-distribution', // v3.9
  START_TIMER: 'start-timer',
  STOP_TIMER: 'stop-timer',
  RESET_SESSION: 'reset-session',
  SUBMIT_ANSWER: 'submit-answer',
};
