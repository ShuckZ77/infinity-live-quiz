/**
 * AnswerSelectionModal Component
 *
 * Modal popup for selecting the correct answer after timer ends.
 * Supports two modes:
 * - MCQ: A, B, C, D option buttons
 * - Fill-in-blanks: Text input field
 *
 * PROPS:
 * - isOpen: Whether modal is visible
 * - questionType: 'mcq' or 'fill-blank'
 * - onSubmit: Callback with selected/typed answer
 * - onClose: Callback to close modal
 */

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { QUESTION_TYPES } from '../utils';

// MCQ options
const MCQ_OPTIONS = ['A', 'B', 'C', 'D'];

export const AnswerSelectionModal = ({ isOpen, questionType, onSubmit, onClose }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOption(null);
      setTextAnswer('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const isMCQ = questionType === QUESTION_TYPES.MCQ;
    const answer = isMCQ ? selectedOption : textAnswer.trim();

    // Validate
    if (!answer) {
      return;
    }

    setIsSubmitting(true);
    onSubmit(answer);
  }, [onSubmit, questionType, selectedOption, textAnswer]);

  // Handle ESC key to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && onClose) {
      onClose();
    }
    // Allow Enter to submit if valid
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [handleSubmit, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Don't render if not open
  if (!isOpen) return null;

  const isMCQ = questionType === QUESTION_TYPES.MCQ;
  const isValid = isMCQ ? selectedOption !== null : textAnswer.trim().length > 0;

  return (
    <div className="answer-modal-overlay">
      <div className="answer-modal">
        {/* Header */}
        <div className="answer-modal-header">
          <h2 className="answer-modal-title">
            {isMCQ ? 'Select the Correct Answer' : 'Enter the Correct Answer'}
          </h2>
          <p className="answer-modal-subtitle">
            {isMCQ
              ? 'Choose the option that matches the correct response'
              : 'Type the exact answer (case-insensitive)'}
          </p>
        </div>

        {/* Content */}
        <div className="answer-modal-content">
          {isMCQ ? (
            // MCQ Options
            <div className="mcq-options">
              {MCQ_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`mcq-option ${selectedOption === option ? 'selected' : ''}`}
                  onClick={() => setSelectedOption(option)}
                  disabled={isSubmitting}
                >
                  <span className="mcq-option-letter">{option}</span>
                </button>
              ))}
            </div>
          ) : (
            // Fill-in-blanks input
            <div className="fill-blank-input">
              <input
                type="text"
                className="fill-blank-field"
                placeholder="Type the correct answer..."
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                maxLength={200}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="answer-modal-actions">
          <button
            className="answer-modal-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className={`answer-modal-submit ${isValid ? 'valid' : ''}`}
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      </div>
    </div>
  );
};

AnswerSelectionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  questionType: PropTypes.oneOf(Object.values(QUESTION_TYPES)).isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
