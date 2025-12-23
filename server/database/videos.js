/**
 * Videos Database Operations
 *
 * Manages video metadata storage for YouTube live streams.
 * Each video ID is stored once and updated on each connection.
 *
 * USAGE:
 *   const videos = require('./videos');
 *   await videos.upsertVideo(videoId, metadata);
 *   const video = await videos.getVideo(videoId);
 */

const { query, run } = require("./index");

/**
 * Upsert video metadata
 * Creates new entry or updates existing one
 *
 * @param {string} videoId - YouTube video ID
 * @param {Object} metadata - Video metadata
 * @param {string} metadata.channel_id - YouTube channel ID
 * @param {string} metadata.channel_name - Channel display name
 * @param {string} metadata.title - Video title
 * @param {string} metadata.thumbnail_url - Thumbnail URL
 * @param {Date} metadata.live_start_timestamp - When stream started
 * @param {number} metadata.view_count - Current view count
 * @returns {Promise<void>}
 */
async function upsertVideo(videoId, metadata) {
  const {
    channel_id = null,
    channel_name = null,
    title = null,
    thumbnail_url = null,
    live_start_timestamp = null,
    view_count = 0,
  } = metadata;

  try {
    // Check if video exists
    const existing = await query(
      "SELECT approx_views FROM videos WHERE video_id = ?",
      [videoId]
    );

    if (existing.length === 0) {
      // Insert new video
      await run(
        `INSERT INTO videos 
         (video_id, channel_id, channel_name, title, thumbnail_url, 
          live_start_timestamp, first_seen_at, last_seen_at, approx_views)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
        [
          videoId,
          channel_id,
          channel_name,
          title,
          thumbnail_url,
          live_start_timestamp,
          view_count,
        ]
      );
      console.log(`[Database] Created video record: ${videoId}`);
    } else {
      // Update existing video - keep max of existing and new
      const approxViews = Math.max(
        existing[0].approx_views || 0,
        view_count || 0
      );
      await run(
        `UPDATE videos 
         SET channel_id = COALESCE(?, channel_id),
             channel_name = COALESCE(?, channel_name),
             title = COALESCE(?, title),
             thumbnail_url = COALESCE(?, thumbnail_url),
             live_start_timestamp = COALESCE(?, live_start_timestamp),
             last_seen_at = datetime('now'),
             approx_views = ?
         WHERE video_id = ?`,
        [
          channel_id,
          channel_name,
          title,
          thumbnail_url,
          live_start_timestamp,
          approxViews,
          videoId,
        ]
      );
      console.log(`[Database] Updated video record: ${videoId}`);
    }
  } catch (error) {
    console.error(
      `[Database] Error upserting video ${videoId}:`,
      error.message
    );
  }
}

/**
 * Get video by ID
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object|null>} Video record or null
 */
async function getVideo(videoId) {
  try {
    const rows = await query("SELECT * FROM videos WHERE video_id = ?", [
      videoId,
    ]);
    return rows[0] || null;
  } catch (error) {
    console.error(`[Database] Error getting video ${videoId}:`, error.message);
    return null;
  }
}

/**
 * Get all videos, ordered by last seen
 *
 * @param {number} limit - Max results (default 100)
 * @returns {Promise<Array>} Video records
 */
async function getAllVideos(limit = 100) {
  try {
    const rows = await query(
      "SELECT * FROM videos ORDER BY last_seen_at DESC LIMIT ?",
      [limit]
    );
    return rows;
  } catch (error) {
    console.error("[Database] Error getting all videos:", error.message);
    return [];
  }
}

/**
 * Get video count
 * @returns {Promise<number>}
 */
async function getVideoCount() {
  try {
    const rows = await query("SELECT COUNT(*) as count FROM videos");
    return Number(rows[0]?.count || 0);
  } catch (error) {
    console.error("[Database] Error getting video count:", error.message);
    return 0;
  }
}

module.exports = {
  upsertVideo,
  getVideo,
  getAllVideos,
  getVideoCount,
};
