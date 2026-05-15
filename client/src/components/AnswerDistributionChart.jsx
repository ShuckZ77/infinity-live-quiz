/**
 * AnswerDistributionChart Component (v3.9.1)
 *
 * Displays a modern pie chart showing the distribution of MCQ answers (A, B, C, D).
 * Shows both percentage and count for each option with smooth animations.
 *
 * PROPS:
 * - distribution: Object with { A, B, C, D, total, correctAnswer }
 * - onClose: Callback to close the chart
 */

import PropTypes from "prop-types";

const CORRECT_COLOR = {
  main: "#22c55e",
  gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
};

// Vibrant option colors used when an option is not the correct answer.
const OPTION_COLORS = {
  A: { main: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  B: { main: "#6366f1", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  C: { main: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
  D: { main: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #db2777)" },
};

const normalizeCorrectAnswer = (correctAnswer) =>
  String(correctAnswer || "").trim().toUpperCase().charAt(0);

const getOptionColor = (option, correctAnswer) =>
  option === normalizeCorrectAnswer(correctAnswer)
    ? CORRECT_COLOR
    : OPTION_COLORS[option];

// Calculate pie chart segments
const calculateSegments = (distribution) => {
  const { A, B, C, D, total, correctAnswer } = distribution;
  if (total === 0) return [];

  const options = [
    { option: "A", count: A, color: getOptionColor("A", correctAnswer).main },
    { option: "B", count: B, color: getOptionColor("B", correctAnswer).main },
    { option: "C", count: C, color: getOptionColor("C", correctAnswer).main },
    { option: "D", count: D, color: getOptionColor("D", correctAnswer).main },
  ];

  let startAngle = 0;
  return options
    .filter((opt) => opt.count > 0)
    .map((opt) => {
      const percentage = (opt.count / total) * 100;
      const angle = (opt.count / total) * 360;
      const segment = {
        ...opt,
        percentage,
        startAngle,
        endAngle: startAngle + angle,
      };
      startAngle += angle;
      return segment;
    });
};

// Convert polar coordinates to cartesian
const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
};

// Generate SVG arc path
const describeArc = (cx, cy, radius, startAngle, endAngle) => {
  // Handle full circle case
  if (endAngle - startAngle >= 359.99) {
    return `
      M ${cx} ${cy - radius}
      A ${radius} ${radius} 0 1 1 ${cx - 0.001} ${cy - radius}
      Z
    `;
  }

  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return `
    M ${cx} ${cy}
    L ${start.x} ${start.y}
    A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}
    Z
  `;
};

// Individual pie segment with hover effect
const PieSegment = ({ segment, cx, cy, radius, index, isCorrect }) => {
  const path = describeArc(
    cx,
    cy,
    radius,
    segment.startAngle,
    segment.endAngle
  );

  return (
    <path
      d={path}
      fill={segment.color}
      stroke={isCorrect ? "#bbf7d0" : "rgba(26, 26, 46, 0.8)"}
      strokeWidth={isCorrect ? "5" : "3"}
      className={`pie-segment ${isCorrect ? "correct" : ""}`}
      style={{
        filter: isCorrect
          ? "brightness(1.12) drop-shadow(0 0 18px rgba(34, 197, 94, 0.55))"
          : "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
        animationDelay: `${index * 0.1}s`,
      }}
    />
  );
};

PieSegment.propTypes = {
  segment: PropTypes.object.isRequired,
  cx: PropTypes.number.isRequired,
  cy: PropTypes.number.isRequired,
  radius: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  isCorrect: PropTypes.bool.isRequired,
};

// Modern legend item with progress bar
const LegendItem = ({ option, count, percentage, isCorrect, index }) => {
  const optionColor = getOptionColor(option, isCorrect ? option : null);

  return (
    <div
      className={`legend-item ${isCorrect ? "correct" : ""}`}
      style={{ animationDelay: `${0.3 + index * 0.1}s` }}
    >
      <div
        className="legend-option-badge"
        style={{
          background: optionColor.gradient,
        }}
      >
        {option}
      </div>
      <div className="legend-info">
        <div className="legend-header">
          <span className="legend-count">{count} votes</span>
          {isCorrect && <span className="correct-badge">✓ Correct</span>}
        </div>
        <div className="legend-progress-container">
          <div
            className="legend-progress-bar"
            style={{
              width: `${percentage}%`,
              background: optionColor.gradient,
            }}
          />
        </div>
        <span className="legend-percentage">{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
};

LegendItem.propTypes = {
  option: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  percentage: PropTypes.number.isRequired,
  isCorrect: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
};

// Main component
export const AnswerDistributionChart = ({ distribution, onClose }) => {
  if (!distribution) return null;

  const { A, B, C, D, total, correctAnswer } = distribution;
  const normalizedCorrectAnswer = normalizeCorrectAnswer(correctAnswer);
  const segments = calculateSegments(distribution);

  // Compact chart dimensions for side-by-side layout
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 125;
  const innerRadius = 62;

  // Calculate percentages for legend
  const getPercentage = (count) => (total > 0 ? (count / total) * 100 : 0);

  return (
    <div className="distribution-chart-overlay">
      <div className="distribution-chart-modal">
        {/* Header */}
        <div className="chart-header">
          <div className="chart-title-container">
            <span className="chart-icon">📊</span>
            <h2 className="chart-title">Answer Distribution</h2>
            {normalizedCorrectAnswer && (
              <span className="chart-correct-answer">
                Correct: {normalizedCorrectAnswer}
              </span>
            )}
          </div>
          <button className="chart-close-btn" onClick={onClose} title="Close">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chart content */}
        <div className="chart-content">
          {total === 0 ? (
            <div className="no-responses">
              <span className="no-responses-icon">📭</span>
              <p>No responses recorded</p>
            </div>
          ) : (
            <>
              {/* Pie Chart */}
              <div className="pie-chart-container">
                <svg width={size} height={size} className="pie-chart">
                  {/* Background glow */}
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient
                      id="centerGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#1e1e3f" />
                      <stop offset="100%" stopColor="#16162e" />
                    </linearGradient>
                  </defs>

                  {/* Segments */}
                  {segments.map((segment, index) => (
                    <PieSegment
                      key={segment.option}
                      segment={segment}
                      cx={cx}
                      cy={cy}
                      radius={radius}
                      index={index}
                      isCorrect={segment.option === normalizedCorrectAnswer}
                    />
                  ))}

                  {/* Center circle for donut effect */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={innerRadius}
                    fill="url(#centerGradient)"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                  />

                  {/* Total count in center */}
                  <text
                    x={cx}
                    y={cy - 12}
                    textAnchor="middle"
                    className="center-total"
                  >
                    {total}
                  </text>
                  <text
                    x={cx}
                    y={cy + 27}
                    textAnchor="middle"
                    className="center-label"
                  >
                    responses
                  </text>
                </svg>
              </div>

              {/* Legend */}
              <div className="chart-legend">
                <LegendItem
                  option="A"
                  count={A}
                  percentage={getPercentage(A)}
                  isCorrect={normalizedCorrectAnswer === "A"}
                  index={0}
                />
                <LegendItem
                  option="B"
                  count={B}
                  percentage={getPercentage(B)}
                  isCorrect={normalizedCorrectAnswer === "B"}
                  index={1}
                />
                <LegendItem
                  option="C"
                  count={C}
                  percentage={getPercentage(C)}
                  isCorrect={normalizedCorrectAnswer === "C"}
                  index={2}
                />
                <LegendItem
                  option="D"
                  count={D}
                  percentage={getPercentage(D)}
                  isCorrect={normalizedCorrectAnswer === "D"}
                  index={3}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="chart-footer">
          <button className="chart-continue-btn" onClick={onClose}>
            <span>View Leaderboard</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

AnswerDistributionChart.propTypes = {
  distribution: PropTypes.shape({
    A: PropTypes.number.isRequired,
    B: PropTypes.number.isRequired,
    C: PropTypes.number.isRequired,
    D: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    correctAnswer: PropTypes.string.isRequired,
  }),
  onClose: PropTypes.func.isRequired,
};
