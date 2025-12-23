/**
 * User Database Operations
 *
 * Handles all user profile CRUD operations.
 * Users are identified by their YouTube chat username.
 *
 * USAGE:
 *   const users = require('./database/users');
 *   await users.upsertUser('username123');
 *   const user = await users.getUser('username123');
 *
 * EXPORTS:
 *   - upsertUser(username): Create or update user on chat message
 *   - getUser(username): Get single user profile
 *   - getAllUsers(): Get all user profiles
 *   - getTopUsers(limit): Get most active users
 *   - getRecentUsers(limit): Get recently active users
 *   - getUserStats(): Get aggregate statistics
 */

const { query, run } = require("./index");

/**
 * Create or update a user profile
 *
 * Called every time a chat message is received:
 * - If user exists: Update last_active, increment total_comment_count
 * - If new user: Create profile with initial values
 *
 * @param {string} username - YouTube chat username
 * @returns {Promise<void>}
 */
async function upsertUser(username) {
  const now = new Date().toISOString();

  // Try to update existing user first
  await run(
    `
    INSERT INTO users (username, first_seen, last_active, total_comment_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (username) DO UPDATE SET
      last_active = ?,
      total_comment_count = total_comment_count + 1
    `,
    [username, now, now, now]
  );
}

/**
 * Get a single user profile by username
 *
 * @param {string} username - YouTube chat username
 * @returns {Promise<Object|null>} User profile or null if not found
 */
async function getUser(username) {
  const rows = await query(`SELECT * FROM users WHERE username = ?`, [
    username,
  ]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all user profiles
 *
 * @param {Object} options - Query options
 * @param {string} options.orderBy - Column to sort by (default: 'last_active')
 * @param {string} options.order - Sort order 'ASC' or 'DESC' (default: 'DESC')
 * @returns {Promise<Array>} Array of user profiles
 */
async function getAllUsers(options = {}) {
  const { orderBy = "last_active", order = "DESC" } = options;
  const validColumns = [
    "username",
    "first_seen",
    "last_active",
    "total_comment_count",
  ];
  const validOrders = ["ASC", "DESC"];

  const safeOrderBy = validColumns.includes(orderBy) ? orderBy : "last_active";
  const safeOrder = validOrders.includes(order.toUpperCase())
    ? order.toUpperCase()
    : "DESC";

  return await query(
    `SELECT * FROM users ORDER BY ${safeOrderBy} ${safeOrder}`
  );
}

/**
 * Get top users by total comment count
 *
 * @param {number} limit - Number of users to return (default: 25)
 * @returns {Promise<Array>} Top users sorted by comment count
 */
async function getTopUsers(limit = 25) {
  return await query(
    `SELECT * FROM users ORDER BY total_comment_count DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Get recently active users
 *
 * @param {number} limit - Number of users to return (default: 25)
 * @returns {Promise<Array>} Users sorted by last_active DESC
 */
async function getRecentUsers(limit = 25) {
  return await query(`SELECT * FROM users ORDER BY last_active DESC LIMIT ?`, [
    limit,
  ]);
}

/**
 * Get aggregate user statistics
 *
 * @returns {Promise<Object>} Statistics object
 */
async function getUserStats() {
  const rows = await query(`
    SELECT
      COUNT(*) as total_users,
      SUM(total_comment_count) as total_messages,
      AVG(total_comment_count) as avg_messages_per_user,
      MAX(total_comment_count) as max_messages,
      MIN(first_seen) as earliest_user,
      MAX(last_active) as latest_activity
    FROM users
  `);
  const stats = rows[0] || {};
  // Convert BigInt to Number for JSON serialization
  return {
    total_users: Number(stats.total_users || 0),
    total_messages: Number(stats.total_messages || 0),
    avg_messages_per_user: Number(stats.avg_messages_per_user || 0),
    max_messages: Number(stats.max_messages || 0),
    earliest_user: stats.earliest_user,
    latest_activity: stats.latest_activity,
  };
}

/**
 * Search users by username pattern
 *
 * @param {string} pattern - Search pattern (uses SQL LIKE)
 * @param {number} limit - Max results (default: 50)
 * @returns {Promise<Array>} Matching users
 */
async function searchUsers(pattern, limit = 50) {
  return await query(
    `SELECT * FROM users WHERE username LIKE ? ORDER BY total_comment_count DESC LIMIT ?`,
    [`%${pattern}%`, limit]
  );
}

/**
 * Delete a user profile
 *
 * @param {string} username - Username to delete
 * @returns {Promise<void>}
 */
async function deleteUser(username) {
  await run(`DELETE FROM user_sessions WHERE username = ?`, [username]);
  await run(`DELETE FROM users WHERE username = ?`, [username]);
}

/**
 * Get user count
 *
 * @returns {Promise<number>} Total number of users
 */
async function getUserCount() {
  const rows = await query(`SELECT COUNT(*) as count FROM users`);
  return Number(rows[0]?.count || 0);
}

module.exports = {
  upsertUser,
  getUser,
  getAllUsers,
  getTopUsers,
  getRecentUsers,
  getUserStats,
  searchUsers,
  deleteUser,
  getUserCount,
};
