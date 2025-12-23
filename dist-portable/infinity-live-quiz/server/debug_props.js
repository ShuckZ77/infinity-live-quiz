/**
 * Debug Utility - Video Properties Inspector
 *
 * Use this script to inspect a YouTube video's properties
 * and check if live chat is available.
 *
 * Usage:
 *   node debug_props.js VIDEO_ID
 *   node debug_props.js              # Uses Lofi Girl as default
 *
 * Output:
 *   - Whether yt.actions is available
 *   - Whether info.livechat exists
 *   - The continuation token (if available)
 */

const { Innertube, UniversalCache } = require("youtubei.js");

async function main() {
  console.log("=".repeat(50));
  console.log("YouTube Video Properties Inspector");
  console.log("=".repeat(50));

  const yt = await Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
    client_type: "WEB",
  });

  const videoId = process.argv[2] || "jfKfPfyJRdk"; // Lofi Girl default
  console.log(`\nInspecting video: ${videoId}`);
  console.log("-".repeat(50));

  try {
    const info = await yt.getInfo(videoId);

    console.log("\n📊 Video Info:");
    console.log(`   Title: ${info.basic_info?.title || "Unknown"}`);
    console.log(`   Is Live: ${info.basic_info?.is_live || false}`);
    console.log(`   Is Live Content: ${info.basic_info?.is_live_content || false}`);

    console.log("\n🔧 API Availability:");
    console.log(`   Has yt.actions: ${!!yt.actions}`);
    console.log(`   Has info.livechat: ${!!info.livechat}`);
    console.log(`   Has continuation token: ${!!info.livechat?.continuation}`);

    if (info.livechat?.continuation) {
      console.log("\n🎫 Continuation Token:");
      console.log(`   ${info.livechat.continuation.substring(0, 50)}...`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ Inspection complete");

  } catch (error) {
    console.error("\n❌ Error inspecting video:", error.message);
  }
}

main();
