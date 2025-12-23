/**
 * TimerSection Component
 *
 * Displays timer controls based on session status:
 * - IDLE: Question type selector + Timer duration selection buttons
 * - RUNNING: Countdown display with progress bar
 * - ENDED: Reset button
 *
 * PROPS:
 * - sessionStatus: Current session state
 * - timeRemaining: Seconds left
 * - duration: Total timer duration
 * - questionType: 'mcq' or 'fill-blank'
 * - onQuestionTypeChange: Callback when question type changes
 * - onStartTimer: Start timer callback
 * - onStopTimer: Stop timer callback
 * - onReset: Reset session callback
 */

import PropTypes from 'prop-types';
import { SESSION_STATUS, TIMER_DURATIONS, QUESTION_TYPES } from '../utils';
import { formatTime } from '../utils';

// Question type selector (v3.7)
const QuestionTypeSelector = ({ questionType, onQuestionTypeChange }) => (
  <div className="question-type-selector">
    <button
      className={`question-type-btn ${questionType === QUESTION_TYPES.MCQ ? 'active' : ''}`}
      onClick={() => onQuestionTypeChange(QUESTION_TYPES.MCQ)}
    >
      Multiple Choice
    </button>
    <button
      className={`question-type-btn ${questionType === QUESTION_TYPES.FILL_BLANK ? 'active' : ''}`}
      onClick={() => onQuestionTypeChange(QUESTION_TYPES.FILL_BLANK)}
    >
      Fill in the Blanks
    </button>
  </div>
);

QuestionTypeSelector.propTypes = {
  questionType: PropTypes.oneOf(Object.values(QUESTION_TYPES)).isRequired,
  onQuestionTypeChange: PropTypes.func.isRequired,
};

// Idle state: Timer selection buttons
const TimerButtons = ({ onStartTimer, questionType, onQuestionTypeChange }) => (
  <div className="timer-buttons">
    <QuestionTypeSelector
      questionType={questionType}
      onQuestionTypeChange={onQuestionTypeChange}
    />
    <p className="timer-label">Select Timer Duration:</p>
    <div className="button-group">
      {TIMER_DURATIONS.map((seconds) => (
        <button
          key={seconds}
          className="timer-btn"
          onClick={() => onStartTimer(seconds)}
        >
          {seconds}s
        </button>
      ))}
    </div>
  </div>
);

TimerButtons.propTypes = {
  onStartTimer: PropTypes.func.isRequired,
  questionType: PropTypes.oneOf(Object.values(QUESTION_TYPES)).isRequired,
  onQuestionTypeChange: PropTypes.func.isRequired,
};

// Running state: Countdown display
const TimerDisplay = ({ timeRemaining, duration, onStopTimer }) => {
  const progressPercent = ((duration - timeRemaining) / duration) * 100;

  return (
    <div className="timer-display">
      <div className="countdown">
        <span className="time-value">{formatTime(timeRemaining)}</span>
        <span className="time-label">remaining</span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <button className="stop-btn" onClick={onStopTimer}>
        Stop Timer
      </button>
    </div>
  );
};

TimerDisplay.propTypes = {
  timeRemaining: PropTypes.number.isRequired,
  duration: PropTypes.number.isRequired,
  onStopTimer: PropTypes.func.isRequired,
};

// Ended state: Reset button
const TimerEnded = ({ onReset }) => (
  <div className="timer-ended">
    <p className="ended-label">Quiz Ended!</p>
    <button className="reset-btn" onClick={onReset}>
      Start New Quiz
    </button>
  </div>
);

TimerEnded.propTypes = {
  onReset: PropTypes.func.isRequired,
};

// Main TimerSection component
export const TimerSection = ({
  sessionStatus,
  timeRemaining,
  duration,
  questionType,
  onQuestionTypeChange,
  onStartTimer,
  onStopTimer,
  onReset,
}) => {
  return (
    <div className="timer-section">
      {sessionStatus === SESSION_STATUS.IDLE && (
        <TimerButtons
          onStartTimer={onStartTimer}
          questionType={questionType}
          onQuestionTypeChange={onQuestionTypeChange}
        />
      )}

      {sessionStatus === SESSION_STATUS.RUNNING && (
        <TimerDisplay
          timeRemaining={timeRemaining}
          duration={duration}
          onStopTimer={onStopTimer}
        />
      )}

      {sessionStatus === SESSION_STATUS.ENDED && (
        <TimerEnded onReset={onReset} />
      )}
    </div>
  );
};

TimerSection.propTypes = {
  sessionStatus: PropTypes.oneOf(Object.values(SESSION_STATUS)).isRequired,
  timeRemaining: PropTypes.number.isRequired,
  duration: PropTypes.number.isRequired,
  questionType: PropTypes.oneOf(Object.values(QUESTION_TYPES)).isRequired,
  onQuestionTypeChange: PropTypes.func.isRequired,
  onStartTimer: PropTypes.func.isRequired,
  onStopTimer: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};
