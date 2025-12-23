const users = require("./server/database/users");
const sessions = require("./server/database/sessions");

// Mock data
const mockAuthor = "TestUser_" + Date.now();
const mockSessionId = 1;

async function runTest() {
  console.log("[Test] Starting Async Verification...");
  console.log("[Test] 1. Calling upsertUser (Fire-and-Forget)...");

  const startTime = process.hrtime();

  // This mimics the new logic in server/index.js
  users
    .upsertUser(mockAuthor)
    .then(() => {
      console.log("[Test] ✅ DB Write Complete (Callback executed)");
    })
    .catch((err) => {
      console.error("[Test] ❌ DB Write Failed:", err);
    });

  const diff = process.hrtime(startTime);
  const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);

  console.log(
    `[Test] 2. Main thread continued immediately! (Took ${executionTimeMs}ms to reach next line)`
  );

  if (executionTimeMs > 50) {
    // If it takes > 50ms, it's likely blocking
    console.error(
      "[Test] ⚠️  WARNING: Operation seemed slow. Is it truly async?"
    );
  } else {
    console.log("[Test] ✅ SUCCESS: Operation was non-blocking.");
  }

  // Keep process alive briefly to allow DB promise to resolve
  setTimeout(() => {
    console.log("[Test] Test finished.");
    process.exit(0);
  }, 1000);
}

runTest();
