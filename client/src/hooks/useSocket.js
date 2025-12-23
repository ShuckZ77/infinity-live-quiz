/**
 * useSocket Hook
 *
 * Manages Socket.io connection and event handling.
 * Encapsulates all socket logic in one place.
 *
 * RESPONSIBILITIES:
 * - Connect to server on mount
 * - Handle connection status
 * - Listen for session updates, messages, rankings
 * - Emit events (start/stop timer, reset)
 * - Cleanup on unmount
 */

import { useState, useEffect, useRef, useCallback } from "react";
import io from "socket.io-client";
import { SOCKET_EVENTS, SESSION_STATUS, MAX_MESSAGES } from "../utils";
import { getCurrentTimestamp } from "../utils";

export const useSocket = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);

  // Session state
  const [sessionStatus, setSessionStatus] = useState(SESSION_STATUS.IDLE);
  const [duration, setDuration] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Data state
  const [messages, setMessages] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [answerDistribution, setAnswerDistribution] = useState(null); // v3.9

  // Video Status State (v3.10)
  const [videoId, setVideoIdState] = useState(null);
  const [videoStatus, setVideoStatus] = useState(null); // 'connecting', 'live', 'offline', 'error'
  const [videoError, setVideoError] = useState(null);

  // Video Metadata State (v3.11)
  const [videoTitle, setVideoTitle] = useState(null);
  const [channelName, setChannelName] = useState(null);
  const [viewCount, setViewCount] = useState(null);
  const [liveStartTimestamp, setLiveStartTimestamp] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);

  // Session Leaderboard State (v3.12)
  const [sessionLeaderboard, setSessionLeaderboard] = useState([]);
  const [questionsAsked, setQuestionsAsked] = useState(0);

  // Socket reference
  const socketRef = useRef(null);

  // Connect and setup listeners
  useEffect(() => {
    // connect to socket.io server
    const socket = io();
    socketRef.current = socket;

    // Connection events
    socket.on(SOCKET_EVENTS.CONNECT, () => {
      setIsConnected(true);
      console.log("[Socket] Connected to server");
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      setIsConnected(false);
      console.log("[Socket] Disconnected from server");
    });

    // Video Status Events (v3.10 + v3.11 metadata)
    socket.on("video-status", (data) => {
      console.log("[Socket] Video Status:", data);

      // Log metadata details for debugging
      if (data.title || data.channelName || data.approxViews !== undefined) {
        console.log(
          "%c[Video Metadata Refresh]",
          "color: #22c55e; font-weight: bold"
        );
        console.log(`  📺 Title: ${data.title || "(unchanged)"}`);
        console.log(`  📢 Channel: ${data.channelName || "(unchanged)"}`);
        console.log(
          `  👁️ Approx Views: ${
            data.approxViews !== undefined
              ? data.approxViews.toLocaleString()
              : "(unchanged)"
          }`
        );
      }

      if (data.status) setVideoStatus(data.status);
      if (data.videoId) setVideoIdState(data.videoId);
      if (data.error) setVideoError(data.error);

      // Store metadata (v3.11)
      if (data.title) setVideoTitle(data.title);
      if (data.channelName) setChannelName(data.channelName);
      if (data.approxViews !== undefined) setViewCount(data.approxViews);
      if (data.liveStartTimestamp)
        setLiveStartTimestamp(data.liveStartTimestamp);
      if (data.thumbnail) setThumbnail(data.thumbnail);

      // Clear error if status is live
      if (data.status === "live") setVideoError(null);

      // Reset if idle (server has no video)
      if (data.status === "idle") {
        setVideoIdState(null);
        setVideoStatus(null);
        setVideoTitle(null);
        setChannelName(null);
        setViewCount(null);
        setLiveStartTimestamp(null);
        setThumbnail(null);
        setSessionLeaderboard([]);
      }
    });

    // Session Leaderboard Event (v3.12.1)
    socket.on("session-leaderboard", (data) => {
      console.log("[Socket] Session Leaderboard Update:", data);
      // Handle both formats: array (legacy) or object { leaderboard, questionsAsked }
      if (data && Array.isArray(data)) {
        setSessionLeaderboard(data);
      } else if (data && data.leaderboard) {
        setSessionLeaderboard(data.leaderboard);
        if (data.questionsAsked !== undefined) {
          setQuestionsAsked(data.questionsAsked);
        }
      }
    });

    // Session update event
    socket.on(SOCKET_EVENTS.SESSION_UPDATE, (data) => {
      console.log("[Socket] Session update:", data);
      setSessionStatus(data.status);
      setDuration(data.duration);
      setTimeRemaining(data.timeRemaining);

      // Clear messages when starting new session
      if (data.status === SESSION_STATUS.RUNNING) {
        setMessages([]);
        setRankings([]);
        setAnswerDistribution(null); // v3.9: Clear distribution
      }
    });

    // Chat message event
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data) => {
      // Add real-time timestamp when message is received
      const messageWithTimestamp = {
        ...data,
        realTimestamp: getCurrentTimestamp(),
      };

      setMessages((prev) => {
        // Prepend new message (newest first)
        const updated = [messageWithTimestamp, ...prev];
        // Limit messages to prevent memory issues
        return updated.slice(0, MAX_MESSAGES);
      });
    });

    // Rankings event
    socket.on(SOCKET_EVENTS.RANKINGS, (data) => {
      console.log("[Socket] Rankings received:", data);
      setRankings(data);
    });

    // Answer distribution event (v3.9)
    socket.on(SOCKET_EVENTS.ANSWER_DISTRIBUTION, (data) => {
      console.log("[Socket] Answer distribution received:", data);
      setAnswerDistribution(data);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Timer countdown effect
  useEffect(() => {
    let interval;

    if (sessionStatus === SESSION_STATUS.RUNNING && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionStatus, timeRemaining]);

  // Action: Start timer (with question type - v3.7)
  const startTimer = useCallback((seconds, questionType) => {
    if (socketRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.START_TIMER, {
        duration: seconds,
        questionType: questionType,
      });
    }
  }, []);

  // Action: Stop timer
  const stopTimer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.STOP_TIMER);
    }
  }, []);

  // Action: Reset session
  const resetSession = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.RESET_SESSION);
      setMessages([]);
      setRankings([]);
      setAnswerDistribution(null); // v3.9
    }
  }, []);

  // Action: Submit correct answer (v3.7)
  const submitAnswer = useCallback((answer) => {
    if (socketRef.current) {
      console.log("[Socket] Submitting answer:", answer);
      socketRef.current.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { answer });
    }
  }, []);

  return {
    // State
    isConnected,
    sessionStatus,
    duration,
    timeRemaining,
    messages,
    rankings,
    answerDistribution, // v3.9

    // Actions
    startTimer,
    stopTimer,
    resetSession,
    submitAnswer,
    setVideoId: (id) => {
      if (socketRef.current) {
        setVideoStatus("connecting");
        setVideoError(null);
        socketRef.current.emit("set-video-id", id);
      }
    },

    // Video State (v3.10)
    videoId,
    videoStatus,
    videoError,

    // Video Metadata (v3.11)
    videoTitle,
    channelName,
    viewCount,
    liveStartTimestamp,
    thumbnail,

    // Session Leaderboard (v3.12)
    sessionLeaderboard,
    questionsAsked,
  };
};
