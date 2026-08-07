/**
 * Build a self-contained Windows ZIP.
 *
 * The target computer only needs Node.js 20 or newer. The built frontend and
 * cross-platform server dependencies are included, while local quiz data is not.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SERVER_ROOT = path.join(ROOT, "server");
const CLIENT_DIST = path.join(ROOT, "client", "dist");
const OUTPUT_ROOT = path.join(ROOT, "dist-portable");
const APP_DIR_NAME = "infinity-live-quiz-windows";
const APP_DIR = path.join(OUTPUT_ROOT, APP_DIR_NAME);
const ZIP_NAME = `${APP_DIR_NAME}.zip`;
const ZIP_PATH = path.join(OUTPUT_ROOT, ZIP_NAME);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

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

function copyServer(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const relativePath = path.relative(SERVER_ROOT, sourcePath);
    const normalizedPath = relativePath.split(path.sep).join("/");
    const destinationPath = path.join(destination, entry.name);

    if (
      normalizedPath === "data" ||
      normalizedPath.startsWith("data/") ||
      normalizedPath === "node_modules/.bin" ||
      normalizedPath.startsWith("node_modules/.bin/") ||
      entry.name === ".DS_Store" ||
      entry.name.endsWith(".log") ||
      entry.isSymbolicLink()
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      copyServer(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function writeWindowsText(destination, content) {
  fs.writeFileSync(destination, content.replace(/\r?\n/g, "\r\n"), "utf8");
}

function formatBytes(bytes) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1)} MB`;
}

console.log("Building the React frontend...");
run("npm", ["run", "build"]);

if (!fs.existsSync(path.join(CLIENT_DIST, "index.html"))) {
  throw new Error("Client build did not produce client/dist/index.html");
}

const serverModules = path.join(SERVER_ROOT, "node_modules");
if (!fs.existsSync(path.join(serverModules, "express", "package.json"))) {
  throw new Error("server/node_modules is missing. Run npm install in server first.");
}

const nativeModules = walkFiles(serverModules).filter((file) =>
  file.endsWith(".node"),
);
if (nativeModules.length > 0) {
  throw new Error(
    `Windows package cannot reuse native modules from this computer:\n${nativeModules.join("\n")}`,
  );
}

console.log("Creating a clean Windows package...");
fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
fs.rmSync(APP_DIR, { recursive: true, force: true });
fs.rmSync(ZIP_PATH, { force: true });
fs.mkdirSync(APP_DIR, { recursive: true });

copyServer(SERVER_ROOT, path.join(APP_DIR, "server"));
fs.cpSync(CLIENT_DIST, path.join(APP_DIR, "client", "dist"), {
  recursive: true,
});
fs.copyFileSync(path.join(ROOT, "package.json"), path.join(APP_DIR, "package.json"));

const launcher = fs.readFileSync(path.join(ROOT, "start-windows.bat"), "utf8");
writeWindowsText(path.join(APP_DIR, "START-INFINITY-QUIZ.bat"), launcher);

const readme = `Infinity Live Quiz - Windows\n\nQUICK START\n1. Extract the complete ZIP to a normal folder.\n2. Double-click START-INFINITY-QUIZ.bat.\n3. Keep the command window open while using the app.\n4. Press Ctrl+C in that window to stop the app.\n\nREQUIREMENT\n- Node.js 20 or newer must already be installed.\n- No npm install or build command is needed.\n\nADDRESSES\n- Quiz app: http://localhost:3001\n- Database viewer: http://localhost:3001/db\n\nDATA\n- Quiz data is saved locally in server\\data\\quiz.db.\n- The package starts with a new empty database.\n- Keep the extracted folder if you want to retain quiz history.\n\nTROUBLESHOOTING\n- If Windows blocks the batch file, right-click the downloaded ZIP, open\n  Properties, select Unblock if shown, and extract it again.\n- If port 3001 is already in use, close the other app or older quiz window.\n- If the browser does not open automatically, visit http://localhost:3001.\n`;
writeWindowsText(path.join(APP_DIR, "README-WINDOWS.txt"), readme);

const dataDirectory = path.join(APP_DIR, "server", "data");
fs.mkdirSync(dataDirectory, { recursive: true });
fs.writeFileSync(path.join(dataDirectory, ".gitkeep"), "");

console.log("Creating ZIP archive...");
run("zip", ["-qr", ZIP_NAME, APP_DIR_NAME], { cwd: OUTPUT_ROOT });

const zipSize = fs.statSync(ZIP_PATH).size;
console.log(`Created ${ZIP_PATH}`);
console.log(`ZIP size: ${formatBytes(zipSize)}`);
