/**
 * Create Portable Distribution
 *
 * Creates a ZIP file containing the portable app for distribution.
 * The ZIP includes server, built client, and launcher scripts.
 *
 * Usage: npm run dist
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist-portable");
const APP_NAME = "infinity-live-quiz";

// Files and folders to include
const INCLUDE = [
  "server",
  "client/dist",
  "node_modules",
  "package.json",
  "package-lock.json",
  "start-windows.bat",
  "start-mac.command",
  "README.txt",
];

// Files and folders to exclude from node_modules
const EXCLUDE_FROM_NODE_MODULES = [
  ".cache",
  ".bin",
  "*.md",
  "*.ts",
  "test",
  "tests",
  "__tests__",
  "docs",
  "example",
  "examples",
];

console.log("📦 Creating Portable Distribution");
console.log("=".repeat(40));

// Step 1: Build client
console.log("\n1️⃣ Building client...");
execSync("npm run build", { cwd: ROOT, stdio: "inherit" });

// Step 2: Create dist directory
console.log("\n2️⃣ Creating dist directory...");
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

const appDir = path.join(DIST_DIR, APP_NAME);
fs.mkdirSync(appDir);

// Step 3: Copy files
console.log("\n3️⃣ Copying files...");
for (const item of INCLUDE) {
  const src = path.join(ROOT, item);
  const dest = path.join(appDir, item);

  if (fs.existsSync(src)) {
    // Create parent directory if needed
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Copy
    if (fs.statSync(src).isDirectory()) {
      copyDir(src, dest);
      console.log(`   ✓ ${item}/`);
    } else {
      fs.copyFileSync(src, dest);
      console.log(`   ✓ ${item}`);
    }
  } else {
    console.log(`   ⚠ ${item} (not found, skipping)`);
  }
}

// Step 4: Create empty data directory
const dataDir = path.join(appDir, "server", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
// Add .gitkeep to preserve directory
fs.writeFileSync(path.join(dataDir, ".gitkeep"), "");
console.log("   ✓ server/data/ (empty)");

// Step 5: Create ZIP
console.log("\n4️⃣ Creating ZIP file...");
const zipName = `${APP_NAME}-portable.zip`;
const zipPath = path.join(DIST_DIR, zipName);

try {
  execSync(`cd "${DIST_DIR}" && zip -r "${zipName}" "${APP_NAME}"`, {
    stdio: "inherit",
  });
  console.log(`   ✓ ${zipName}`);
} catch (e) {
  console.log("   ⚠ zip command failed, trying tar...");
  const tarName = `${APP_NAME}-portable.tar.gz`;
  execSync(`cd "${DIST_DIR}" && tar -czf "${tarName}" "${APP_NAME}"`, {
    stdio: "inherit",
  });
  console.log(`   ✓ ${tarName}`);
}

// Step 6: Show stats
console.log("\n" + "=".repeat(40));
console.log("✅ Distribution created!");
console.log(`   Location: ${DIST_DIR}`);

// Helper function to copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);

    // Skip excluded items in node_modules
    if (src.includes("node_modules")) {
      if (
        EXCLUDE_FROM_NODE_MODULES.some((pattern) => {
          if (pattern.startsWith("*")) {
            return item.endsWith(pattern.slice(1));
          }
          return item === pattern;
        })
      ) {
        continue;
      }
    }

    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
