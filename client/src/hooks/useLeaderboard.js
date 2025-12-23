/**
 * useLeaderboard Hook
 *
 * Manages leaderboard panel visibility state.
 * Auto-shows/hides based on session status.
 *
 * RESPONSIBILITIES:
 * - Track panel visibility
 * - Auto-show when session ends
 * - Auto-hide when session starts/resets
 * - Provide toggle function
 */

import { useState, useEffect, useCallback } from 'react';
import { SESSION_STATUS } from '../utils';

export const useLeaderboard = (sessionStatus) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Auto-show/hide based on session status
  useEffect(() => {
    if (sessionStatus === SESSION_STATUS.ENDED) {
      setShowLeaderboard(true);
    } else if (sessionStatus === SESSION_STATUS.RUNNING || sessionStatus === SESSION_STATUS.IDLE) {
      setShowLeaderboard(false);
    }
  }, [sessionStatus]);

  // Toggle visibility
  const toggleLeaderboard = useCallback(() => {
    setShowLeaderboard((prev) => !prev);
  }, []);

  // Hide panel
  const hideLeaderboard = useCallback(() => {
    setShowLeaderboard(false);
  }, []);

  return {
    showLeaderboard,
    toggleLeaderboard,
    hideLeaderboard,
  };
};
