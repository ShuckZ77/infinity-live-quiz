/**
 * YouTube Live Chat Quiz/Competition Frontend
 * v3.10.0 - UI-based Video ID Input
 *
 * FEATURES:
 * 1. 5-second countdown before timer starts (v3.7)
 * 2. Question type selection: MCQ or Fill-in-blanks (v3.7)
 * 3. Answer selection popup after timer ends (v3.7)
 * 4. Filter rankings by correct answer (v3.7)
 * 5. Answer distribution pie chart for MCQ (v3.9)
 * 6. Timer selection (30s, 60s, 120s, 180s)
 * 7. Live countdown display while timer runs
 * 8. Scrolling chat messages during quiz
 * 9. Leaderboard with bar chart when timer ends
 * 10. Duplicate message indicators
 * 11. Modern fluid animations
 * 12. UI-based Video ID input (NEW v3.10)
 *
 * ARCHITECTURE:
 * - App.jsx: Main container (this file)
 * - hooks/: Custom React hooks (useSocket, useLeaderboard)
 * - components/: UI components (Header, TimerSection, ChatSection, LeaderboardPanel, CountdownOverlay, AnswerSelectionModal, AnswerDistributionChart, VideoIdInput)
 * - utils/: Constants and formatters
 *
 * STATE FLOW:
 * - useSocket manages: connection, messages, rankings, answerDistribution, session state, videoId/videoStatus
 * - useLeaderboard manages: panel visibility
 * - App orchestrates components, countdown, answer modal, and distribution chart
 */

import { useState, useCallback, useEffect } from "react";
import { useSocket, useLeaderboard } from "./hooks";
import {
  Header,
  TimerSection,
  ChatSection,
  LeaderboardPanel,
  CountdownOverlay,
  AnswerSelectionModal,
  AnswerDistributionChart,
  VideoIdInput,
  SessionLeaderboard,
} from "./components";
import { QUESTION_TYPES, SESSION_STATUS } from "./utils";
import "./App.css";

function App() {
  // Socket hook: manages connection, messages, session state
  const {
    isConnected,
    sessionStatus,
    duration,
    timeRemaining,
    messages,
    rankings,
    answerDistribution,
    sessionError,
    startTimer,
    stopTimer,
    resetSession,
    submitAnswer,
    clearSessionError,
    // Video State (v3.10)
    videoId,
    videoStatus,
    videoError,
    setVideoId,
    // Video Metadata (v3.11)
    videoTitle,
    channelName,
    viewCount,
    // Session Leaderboard (v3.12)
    sessionLeaderboard,
    questionsAsked,
  } = useSocket();

  // Leaderboard hook: manages panel visibility
  const { showLeaderboard, toggleLeaderboard } = useLeaderboard(sessionStatus);

  // Question type state (v3.7)
  const [questionType, setQuestionType] = useState(QUESTION_TYPES.MCQ);

  // Countdown state (v3.7)
  const [showCountdown, setShowCountdown] = useState(false);
  const [pendingDuration, setPendingDuration] = useState(0);

  // Answer modal state (v3.7)
  const [showAnswerModal, setShowAnswerModal] = useState(false);

  // Distribution chart state (v3.9)
  const [showDistributionChart, setShowDistributionChart] = useState(false);

  // Handle timer button click -> show countdown
  const handleStartTimer = useCallback((seconds) => {
    setPendingDuration(seconds);
    setShowCountdown(true);
  }, []);

  // Handle countdown complete -> start actual timer
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    startTimer(pendingDuration, questionType);
  }, [pendingDuration, questionType, startTimer]);

  // Handle countdown cancel
  const handleCountdownCancel = useCallback(() => {
    setShowCountdown(false);
    setPendingDuration(0);
  }, []);

  // Show answer modal when session ends (v3.7)
  useEffect(() => {
    if (sessionStatus === SESSION_STATUS.ENDED) {
      // Small delay to let the "Quiz Ended" animation play
      const timer = setTimeout(() => {
        setShowAnswerModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (
      sessionError &&
      ["score-update-failed", "answer-submit-failed"].includes(
        sessionError.type
      )
    ) {
      setShowAnswerModal(true);
    }
  }, [sessionError]);

  // Handle answer submission
  const handleAnswerSubmit = useCallback(
    (answer) => {
      setShowAnswerModal(false);
      submitAnswer(answer);
    },
    [submitAnswer]
  );

  // Show distribution chart when data arrives (v3.9)
  useEffect(() => {
    if (answerDistribution && answerDistribution.total > 0) {
      setShowDistributionChart((prev) => {
        if (prev) return prev; // Avoid unnecessary re-renders
        return true;
      });
    }
  }, [answerDistribution]);

  // Handle distribution chart close -> show leaderboard (v3.9)
  const handleDistributionChartClose = useCallback(() => {
    setShowDistributionChart(false);
  }, []);

  // Handle answer modal close (skip answer selection)
  const handleAnswerModalClose = useCallback(() => {
    setShowAnswerModal(false);
  }, []);

  // Handle session reset
  const handleReset = useCallback(() => {
    setShowAnswerModal(false);
    setShowDistributionChart(false); // v3.9
    resetSession();
  }, [resetSession]);

  // Determine if we should show the main quiz UI
  // Show main UI if: videoId exists AND videoStatus is 'live'
  const showMainUI = videoId && videoStatus === "live";

  // Check if Session Leaderboard should be visible (for CSS class)
  const hasSessionLeaderboard =
    sessionLeaderboard && sessionLeaderboard.length > 0;

  return (
    <div
      className={`app-container ${
        hasSessionLeaderboard ? "has-session-leaderboard" : ""
      }`}
    >
      {/* Header with title, toggle, and connection status */}
      <Header
        isConnected={isConnected}
        showLeaderboard={showLeaderboard}
        hasRankings={rankings.length > 0}
        onToggleLeaderboard={toggleLeaderboard}
        videoTitle={videoTitle}
        channelName={channelName}
        viewCount={viewCount}
      />

      {sessionError && (
        <div className="session-error-banner" role="alert">
          <span>{sessionError.message}</span>
          <button type="button" onClick={clearSessionError}>
            x
          </button>
        </div>
      )}

      {/* Main content area */}
      <main className="main-content">
        {/* VIDEO ID INPUT - Show when not connected to a live video */}
        {!showMainUI && (
          <VideoIdInput
            onSetVideoId={setVideoId}
            status={videoStatus}
            error={videoError}
          />
        )}

        {/* Main Quiz UI - Show when connected to a live video */}
        {showMainUI && (
          <>
            {/* Left panel: Timer + Chat */}
            <div className="left-panel">
              <TimerSection
                sessionStatus={sessionStatus}
                timeRemaining={timeRemaining}
                duration={duration}
                questionType={questionType}
                onQuestionTypeChange={setQuestionType}
                onStartTimer={handleStartTimer}
                onStopTimer={stopTimer}
                onReset={handleReset}
              />

              <ChatSection messages={messages} sessionStatus={sessionStatus} />
            </div>

            {/* Right panel: Leaderboard */}
            <LeaderboardPanel
              visible={showLeaderboard}
              rankings={rankings}
              onClose={toggleLeaderboard}
            />
          </>
        )}
      </main>

      {/* Countdown Overlay (v3.7) */}
      <CountdownOverlay
        isActive={showCountdown}
        onComplete={handleCountdownComplete}
        onCancel={handleCountdownCancel}
      />

      {/* Answer Selection Modal (v3.7) */}
      <AnswerSelectionModal
        isOpen={showAnswerModal}
        questionType={questionType}
        onSubmit={handleAnswerSubmit}
        onClose={handleAnswerModalClose}
      />

      {/* Answer Distribution Chart (v3.9) */}
      {showDistributionChart && answerDistribution && (
        <AnswerDistributionChart
          distribution={answerDistribution}
          onClose={handleDistributionChartClose}
        />
      )}

      {/* Session Leaderboard Footer (v3.12) */}
      <SessionLeaderboard
        leaderboard={sessionLeaderboard}
        questionsAsked={questionsAsked}
      />
    </div>
  );
}

export default App;
