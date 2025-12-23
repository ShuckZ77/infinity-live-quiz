# Electron Desktop App Implementation Plan

> **Goal**: Package the YouTube Live Chat Quiz app as a standalone Windows `.exe` that users can install and run without Node.js/npm knowledge.
>
> **Status**: ✅ PHASE 1-3 COMPLETE | Ready for testing

---

## Current Progress

| Phase   | Status     | Description                   |
| ------- | ---------- | ----------------------------- |
| Phase 1 | ✅ Done    | Cross-platform cleanup script |
| Phase 2 | ✅ Done    | Electron main process         |
| Phase 3 | ✅ Done    | Package.json + builder config |
| Phase 4 | ⏳ Pending | Install dependencies          |
| Phase 5 | ⏳ Pending | Test and build                |

---

## Project Structure (Electron Version)

```
youtube-live-chat-electron/
├── electron/
│   └── main.js           ✅ Created - Spawns server, creates window
├── scripts/
│   └── cleanup.js        ✅ Created - Cross-platform port/WAL cleanup
├── server/               (unchanged)
├── client/               (unchanged)
├── package.json          ✅ Updated - Electron scripts + builder config
└── dist-electron/        (generated after build)
```

---

## Step-by-Step Implementation

### ✅ Step 1: Created `scripts/cleanup.js`

Cross-platform cleanup that works on Windows AND macOS:

```javascript
// Windows: netstat + taskkill
// macOS: lsof + kill
// Also removes stale .wal files
```

### ✅ Step 2: Created `electron/main.js`

Main Electron process that:

- Spawns Express server as child process
- Creates BrowserWindow pointing to localhost:3001
- Handles graceful shutdown on close
- Opens external links in system browser

### ✅ Step 3: Updated `package.json`

New scripts:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "predev": "node scripts/cleanup.js",
    "electron:dev": "npm run build && electron .",
    "electron:build": "npm run build && electron-builder --win"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  }
}
```

---

## Next Steps (To Run)

### Step 4: Install Dependencies

```bash
cd youtube-live-chat-electron
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Step 5: Test Electron Dev Mode

```bash
npm run electron:dev
```

This will:

1. Build the React client
2. Launch Electron
3. Spawn the Express server
4. Open the app in a native window

### Step 6: Build Windows Installer (on Windows)

```bash
npm run electron:build
```

Output: `dist-electron/YouTube Live Quiz Setup.exe`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    YouTubeQuiz.exe                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ Electron Main   │  │       Renderer Process          │  │
│  │ Process         │  │                                 │  │
│  │                 │  │   React Frontend                │  │
│  │ - Spawns server │  │   (BrowserWindow)               │  │
│  │ - System tray   │  │                                 │  │
│  │ - Window mgmt   │  │   localhost:3001                │  │
│  └────────┬────────┘  └─────────────────────────────────┘  │
│           │                                                 │
│  ┌────────▼────────────────────────────────────────────┐   │
│  │              Express Server (Child Process)         │   │
│  │  - Socket.io    - YouTube API    - DuckDB           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Created/Modified

| File                 | Action   | Purpose                       |
| -------------------- | -------- | ----------------------------- |
| `electron/main.js`   | Created  | Electron main process         |
| `scripts/cleanup.js` | Created  | Cross-platform port cleanup   |
| `package.json`       | Modified | Added Electron scripts & deps |

---

## Notes

- **Icon files**: You'll need to add `electron/icon.ico` (Windows) and `electron/icon.icns` (Mac)
- **Code signing**: Optional but recommended for Windows SmartScreen
- **Auto-updates**: Can add `electron-updater` later
- **Installer size**: ~150MB (includes Node.js + Chromium)
