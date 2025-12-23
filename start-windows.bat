@echo off
echo ================================================
echo    Infinity Live Quiz - Starting Server...
echo ================================================
echo.

cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install --production
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
)

echo.
echo Starting server and opening browser...
echo.
echo Press Ctrl+C to stop the server.
echo ================================================

:: Open browser after a short delay
start "" http://localhost:3001

:: Start the server
cd server
node index.js
