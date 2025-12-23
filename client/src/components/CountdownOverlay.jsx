/**
 * CountdownOverlay Component
 *
 * Full-screen animated countdown before timer starts.
 * Displays 5, 4, 3, 2, 1, GO! with fluid animations.
 *
 * PROPS:
 * - isActive: Whether countdown is visible
 * - onComplete: Callback when countdown finishes
 * - onCancel: Callback when user cancels (ESC key)
 */

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

// Countdown sequence: 5, 4, 3, 2, 1, GO!
const COUNTDOWN_VALUES = [5, 4, 3, 2, 1, 'GO!'];
const COUNTDOWN_DURATION = 1000; // 1 second per number

// Color gradient for each countdown number
const COUNTDOWN_COLORS = {
  5: { primary: '#8b5cf6', secondary: '#6366f1' }, // Purple/Indigo
  4: { primary: '#3b82f6', secondary: '#2563eb' }, // Blue
  3: { primary: '#06b6d4', secondary: '#0891b2' }, // Cyan
  2: { primary: '#f59e0b', secondary: '#d97706' }, // Amber
  1: { primary: '#ef4444', secondary: '#dc2626' }, // Red
  'GO!': { primary: '#22c55e', secondary: '#16a34a' }, // Green
};

export const CountdownOverlay = ({ isActive, onComplete, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle ESC key to cancel
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  }, [onCancel]);

  // Setup ESC key listener
  useEffect(() => {
    if (isActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, handleKeyDown]);

  // Run countdown timer
  useEffect(() => {
    if (!isActive) {
      setCurrentIndex(0);
      setIsAnimating(false);
      return;
    }

    // Start animation
    setIsAnimating(true);

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;

        // Check if countdown is complete
        if (nextIndex >= COUNTDOWN_VALUES.length) {
          clearInterval(interval);
          // Small delay before calling onComplete
          setTimeout(() => {
            onComplete();
          }, 300);
          return prev;
        }

        return nextIndex;
      });
    }, COUNTDOWN_DURATION);

    return () => clearInterval(interval);
  }, [isActive, onComplete]);

  // Don't render if not active
  if (!isActive) return null;

  const currentValue = COUNTDOWN_VALUES[currentIndex];
  const colors = COUNTDOWN_COLORS[currentValue] || COUNTDOWN_COLORS[5];
  const isGo = currentValue === 'GO!';

  return (
    <div className="countdown-overlay">
      {/* Background with blur */}
      <div className="countdown-backdrop" />

      {/* Animated rings */}
      <div
        className="countdown-ring countdown-ring-1"
        style={{
          borderColor: colors.primary,
          boxShadow: `0 0 60px ${colors.primary}40`
        }}
      />
      <div
        className="countdown-ring countdown-ring-2"
        style={{
          borderColor: colors.secondary,
          boxShadow: `0 0 40px ${colors.secondary}30`
        }}
      />
      <div
        className="countdown-ring countdown-ring-3"
        style={{
          borderColor: colors.primary,
          boxShadow: `0 0 80px ${colors.primary}20`
        }}
      />

      {/* Main countdown number/text */}
      <div
        className={`countdown-number ${isAnimating ? 'animating' : ''} ${isGo ? 'go' : ''}`}
        key={currentValue} // Force re-render for animation
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: `0 0 60px ${colors.primary}80, 0 0 120px ${colors.primary}40`
        }}
      >
        {currentValue}
      </div>

      {/* Cancel hint */}
      <div className="countdown-hint">
        Press ESC to cancel
      </div>
    </div>
  );
};

CountdownOverlay.propTypes = {
  isActive: PropTypes.bool.isRequired,
  onComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};

CountdownOverlay.defaultProps = {
  onCancel: null,
};
