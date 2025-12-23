# Portable Web App Migration Documentation

## 1. Context & Problem Statement

The application was originally built using **Electron** to bundle the Node.js server and React client into a single desktop application (`.exe`, `.dmg`).

However, we encountered persistent cross-platform build issues, particularly on Windows:

- **Native Module Incompatibility**: `duckdb` and `better-sqlite3` require platform-specific compilation (`node-gyp`), which failed consistently within the Electron environment on Windows.
- **ESM vs CommonJS Conflicts**: `sql.js` (WASM build) uses ES Modules, which conflicted with the Electron server's CommonJS environment (`ERR_REQUIRE_ESM`).
- **Debugging Complexity**: Crashes in the packaged Electron app were difficult to debug due to swallowed error logs and restricted environment access.

## 2. Alternatives Considered

Before settling on the Portable Web App, we evaluated several other distribution methods:

| Method                          | Description                                                  | Pros                                       | Cons                                                                                  |
| :------------------------------ | :----------------------------------------------------------- | :----------------------------------------- | :------------------------------------------------------------------------------------ |
| **1. Electron (Original)**      | Bundles Chromium + Node.js into a standalone app.            | Native look & feel, self-contained.        | **Failed builds** on Windows due to native modules; huge file size (120MB+).          |
| **2. Portable + Embedded Node** | Zip file containing the app AND a standalone Node.js binary. | No dependencies required for user.         | Significantly increases file size (+50-70MB); platform-specific binaries needed.      |
| **3. Docker**                   | Containerized application.                                   | Guaranteed consistency across platforms.   | Requires users to install Docker (high barrier to entry); complex for non-tech users. |
| **4. Cloud Hosting (SaaS)**     | Deploy to Vercel/Render/Heroku.                              | No user installation; accessible anywhere. | **Cost** (hosting fees); Latency; Privacy concerns (user data stored on cloud).       |
| **5. Tauri**                    | Rust-based alternative to Electron.                          | Very small binary sizes.                   | Requires rewriting backend logic in Rust; steep learning curve.                       |

**Selected Approach: Portable Web App (Option 2 Modified)**
We chose a modified version of Option 2 where we _exclude_ the embedded Node.js binary to keep the bundle lightweight (~25MB), relying on the user's system Node.js. This offers the best balance of simplicity, reliability, and maintainability.

## 3. Solution: Portable Web App

Instead of fighting the Electron build system, we switched to a **Portable Web App** architecture.

### What is it?

A zip file containing:

1. The raw Node.js **Server** code.
2. The built React **Client** (static files).
3. **Launcher Scripts** (`.bat` for Windows, `.command` for Mac).

### Why this approach?

| Feature         | Electron App                                    | Portable Web App                    |
| :-------------- | :---------------------------------------------- | :---------------------------------- |
| **Complexity**  | High (Build pipelines, signing, native modules) | **Low** (Simple file copy)          |
| **Size**        | ~120MB+ (Bundles Chromium & Node)               | **~25MB** (Uses system Node)        |
| **Reliability** | Low (Native module compilation often fails)     | **High** (Pure JS implementation)   |
| **Debugging**   | Hard (Hidden console)                           | **Easy** (Runs in visible terminal) |

**Trade-off**: The user must have **Node.js installed** on their machine. Given the target audience (power users/developers), this was deemed an acceptable trade-off for stability.

## 4. Implementation Details

### A. Database Engine: `sql.js` (ASM)

To ensure maximum compatibility, we removed all native dependencies (`duckdb`, `better-sqlite3`) and migrated to **sql.js**.

- **Issue**: Standard `sql.js` uses WASM and ESM, causing require errors.
- **Fix**: We explicitly use the **ASM.js build** (`sql.js/dist/sql-asm.js`) which works flawlessly with standard CommonJS `require()` and requires no external binaries.

### B. Launcher Scripts

We created platform-specific scripts to automate startup:

#### Windows (`start-windows.bat`)

- Checks if `node` is available in PATH.
- Installs dependencies (`npm install --production`) if `node_modules` is missing.
- Opens default browser to `localhost:3001`.
- Starts the server process.

#### Mac/Linux (`start-mac.command`)

- Similar logic using bash.
- Uses `open` command to launch browser.

### C. Build Automation

A custom script `scripts/create-portable.js` handles the packaging:

1. Builds the React client (`npm run build`).
2. Creates a clean `dist-portable/` directory.
3. Copies only necessary files:
   - `server/` (Code)
   - `client/dist/` (Built UI)
   - `package.json`
   - `node_modules/` (Production deps only, excluding caches/docs to save space)
4. Zips everything into `infinity-live-quiz-portable.zip`.

## 5. Final Folder Structure

The distributed ZIP file contains:

```
infinity-live-quiz/
├── server/                 # Backend code
│   ├── data/               # Database storage (initially empty)
│   └── index.js           # Server entry point
├── client/
│   └── dist/              # React frontend (HTML/JS/CSS)
├── node_modules/           # Pre-installed dependencies
├── start-windows.bat       # Double-click to run on Windows
├── start-mac.command       # Double-click to run on Mac
└── README.txt              # User instructions
```

## 6. How to Build

Run the following command in the project root:

```bash
npm run dist
```

This will generate the zip file in `dist-portable/`.
