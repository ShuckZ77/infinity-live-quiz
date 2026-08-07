/**
 * Build a self-contained, short-path Windows ZIP.
 *
 * The target computer only needs Node.js 20 or newer. The frontend is already
 * built, production server dependencies are installed from the audited lockfile,
 * and local quiz data is deliberately excluded.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SERVER_ROOT = path.join(ROOT, "server");
const CLIENT_DIST = path.join(ROOT, "client", "dist");
const OUTPUT_ROOT = path.join(ROOT, "dist-portable");
const APP_DIR_NAME = "InfinityQuiz";
const APP_DIR = path.join(OUTPUT_ROOT, APP_DIR_NAME);
const LEGACY_APP_DIR = path.join(OUTPUT_ROOT, "infinity-live-quiz-windows");
const ZIP_NAME = "infinity-live-quiz-windows.zip";
const ZIP_PATH = path.join(OUTPUT_ROOT, ZIP_NAME);
const MAX_ARCHIVE_PATH_LENGTH = 150;

const OMITTED_DIRECTORY_NAMES = new Set([
  ".bin",
  ".cache",
  ".github",
  "__tests__",
  "coverage",
  "doc",
  "docs",
  "example",
  "examples",
  "test",
  "tests",
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

function walkFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolutePath, files);
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function copyServerSource(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const relativePath = path.relative(SERVER_ROOT, sourcePath);
    const normalizedPath = relativePath.split(path.sep).join("/");
    const destinationPath = path.join(destination, entry.name);

    if (
      normalizedPath === "data" ||
      normalizedPath.startsWith("data/") ||
      normalizedPath === "node_modules" ||
      normalizedPath.startsWith("node_modules/") ||
      entry.name === ".DS_Store" ||
      entry.name === "debug_props.js" ||
      entry.name.endsWith(".log") ||
      entry.isSymbolicLink()
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      copyServerSource(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function isDocumentationFile(fileName) {
  const lowerName = fileName.toLowerCase();
  const isLicense = /^(licen[cs]e|notice)/.test(lowerName);
  return !isLicense && (lowerName.endsWith(".md") || lowerName.endsWith(".markdown"));
}

function pruneRuntimeTree(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      fs.rmSync(absolutePath, { force: true });
      continue;
    }

    if (entry.isDirectory()) {
      if (OMITTED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
        fs.rmSync(absolutePath, { recursive: true, force: true });
      } else {
        pruneRuntimeTree(absolutePath);
      }
      continue;
    }

    if (
      entry.name.endsWith(".map") ||
      entry.name.endsWith(".d.ts") ||
      isDocumentationFile(entry.name)
    ) {
      fs.rmSync(absolutePath, { force: true });
    }
  }
}

function writeWindowsText(destination, content) {
  fs.writeFileSync(destination, content.replace(/\r?\n/g, "\r\n"), "utf8");
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function verifyInstalledRuntimeAgainstLock() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(SERVER_ROOT, "package-lock.json"), "utf8")
  );
  const mismatches = [];

  for (const [packagePath, metadata] of Object.entries(lock.packages || {})) {
    if (!packagePath.startsWith("node_modules/") || metadata.dev) continue;

    const installedPath = path.join(SERVER_ROOT, packagePath, "package.json");
    if (!fs.existsSync(installedPath)) {
      if (!metadata.optional) mismatches.push(`${packagePath} is missing`);
      continue;
    }

    const installed = JSON.parse(fs.readFileSync(installedPath, "utf8"));
    if (installed.version !== metadata.version) {
      mismatches.push(
        `${packagePath} is ${installed.version}; lockfile requires ${metadata.version}`
      );
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Installed server dependencies do not match the audited lockfile:\n${mismatches.join("\n")}`
    );
  }
}

function removeLockedDevPackages(packagedServerRoot) {
  const lock = JSON.parse(
    fs.readFileSync(path.join(SERVER_ROOT, "package-lock.json"), "utf8")
  );
  const devPackagePaths = Object.entries(lock.packages || {})
    .filter(([packagePath, metadata]) =>
      packagePath.startsWith("node_modules/") && metadata.dev
    )
    .map(([packagePath]) => packagePath)
    .sort((left, right) => right.length - left.length);

  for (const packagePath of devPackagePaths) {
    fs.rmSync(path.join(packagedServerRoot, packagePath), {
      recursive: true,
      force: true,
    });
  }
}

console.log("Building the React frontend...");
run("npm", ["run", "build"]);

if (!fs.existsSync(path.join(CLIENT_DIST, "index.html"))) {
  throw new Error("Client build did not produce client/dist/index.html");
}
if (!fs.existsSync(path.join(SERVER_ROOT, "package-lock.json"))) {
  throw new Error("server/package-lock.json is required for an audited release");
}

console.log("Creating a clean, short-path Windows package...");
fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
fs.rmSync(APP_DIR, { recursive: true, force: true });
fs.rmSync(LEGACY_APP_DIR, { recursive: true, force: true });
fs.rmSync(ZIP_PATH, { force: true });
fs.mkdirSync(APP_DIR, { recursive: true });

const packagedServer = path.join(APP_DIR, "server");
copyServerSource(SERVER_ROOT, packagedServer);

console.log("Installing audited production dependencies...");
const packagedModules = path.join(packagedServer, "node_modules");
if (process.env.INFINITY_USE_INSTALLED_MODULES === "1") {
  console.log("Using locally installed modules after lockfile verification...");
  verifyInstalledRuntimeAgainstLock();
  fs.cpSync(path.join(SERVER_ROOT, "node_modules"), packagedModules, {
    recursive: true,
  });
  removeLockedDevPackages(packagedServer);
} else {
  run(
    "npm",
    ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--fund=false"],
    { cwd: packagedServer }
  );
}

pruneRuntimeTree(packagedModules);

const nativeModules = walkFiles(packagedModules).filter((file) =>
  file.endsWith(".node")
);
if (nativeModules.length > 0) {
  throw new Error(
    `Windows package cannot reuse native modules from this computer:\n${nativeModules.join("\n")}`
  );
}

fs.cpSync(CLIENT_DIST, path.join(APP_DIR, "client", "dist"), {
  recursive: true,
});
fs.copyFileSync(path.join(ROOT, "package.json"), path.join(APP_DIR, "package.json"));

const launcher = fs.readFileSync(path.join(ROOT, "start-windows.bat"), "utf8");
writeWindowsText(path.join(APP_DIR, "START-INFINITY-QUIZ.bat"), launcher);

const readme = `Infinity Live Quiz - Windows\n\nQUICK START\n1. Right-click the downloaded ZIP, choose Properties, and select Unblock if\n   that option is shown. Apply the change before extracting.\n2. Use Extract All. Do not run the app from inside the ZIP.\n3. For maximum Windows compatibility, extract to C:\\ so the app is at\n   C:\\InfinityQuiz.\n4. Double-click START-INFINITY-QUIZ.bat.\n5. Wait for the Web UI running message, then open any browser and visit\n   http://localhost:3001.\n6. Keep the command window open. Press Ctrl+C there to stop the app.\n\nIF WINDOWS BLOCKS THE BATCH FILE\n- Do not disable Windows security.\n- Follow MANUAL-START.txt to run the same server from Command Prompt.\n- The launcher deliberately does not use PowerShell or open a browser itself.\n\nREQUIREMENT\n- Node.js 20 or newer must already be installed.\n- No npm install or build command is needed.\n\nADDRESSES\n- Quiz app: http://localhost:3001\n- Database viewer: http://localhost:3001/db\n- The server accepts local computer connections only.\n\nDATA\n- Quiz data is saved locally in server\\data\\quiz.db.\n- The package starts with a new empty database.\n- Keep the extracted folder if you want to retain quiz history.\n\nTROUBLESHOOTING\n- If port 3001 is already in use, close the other app or older quiz window.\n- If the page does not open, type http://localhost:3001 into the browser.\n`;
writeWindowsText(path.join(APP_DIR, "README-WINDOWS.txt"), readme);

const manualStart = `Infinity Live Quiz - Manual Windows Start\n\nUse this method if Windows Smart App Control or SmartScreen blocks the batch file.\nYou do not need to disable Windows security.\n\n1. Open the extracted InfinityQuiz folder in File Explorer.\n2. Click the File Explorer address bar.\n3. Type cmd and press Enter.\n4. In the Command Prompt window, type:\n\n   node server\\index.js\n\n5. Wait until the terminal says:\n\n   Web UI running at http://localhost:3001\n\n6. Open Chrome, Edge, Firefox, or another browser and visit:\n\n   http://localhost:3001\n\nDatabase viewer:\n   http://localhost:3001/db\n\nKeep Command Prompt open while using the quiz.\nPress Ctrl+C in Command Prompt to stop the server.\n`;
writeWindowsText(path.join(APP_DIR, "MANUAL-START.txt"), manualStart);

const dataDirectory = path.join(packagedServer, "data");
fs.mkdirSync(dataDirectory, { recursive: true });
fs.writeFileSync(path.join(dataDirectory, ".gitkeep"), "");

const archivePaths = walkFiles(APP_DIR).map((file) =>
  path
    .join(APP_DIR_NAME, path.relative(APP_DIR, file))
    .split(path.sep)
    .join("/")
);
archivePaths.sort((left, right) => right.length - left.length);
const longestArchivePath = archivePaths[0] || "";
if (longestArchivePath.length > MAX_ARCHIVE_PATH_LENGTH) {
  throw new Error(
    `Archive path is too long (${longestArchivePath.length} characters): ${longestArchivePath}`
  );
}

console.log("Creating ZIP archive...");
run("zip", ["-qr", ZIP_NAME, APP_DIR_NAME], { cwd: OUTPUT_ROOT });

const zipSize = fs.statSync(ZIP_PATH).size;
console.log(`Created ${ZIP_PATH}`);
console.log(`ZIP size: ${formatBytes(zipSize)}`);
console.log(`Files: ${archivePaths.length}`);
console.log(
  `Longest internal path: ${longestArchivePath.length} characters (${longestArchivePath})`
);
