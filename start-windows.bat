@echo off
setlocal
title Infinity Live Quiz

cd /d "%~dp0"

echo ================================================
echo        Infinity Live Quiz - Windows
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or is not in PATH.
    echo Install Node.js 20 or newer from https://nodejs.org
    echo Then close this window and double-click this file again.
    echo.
    pause
    exit /b 1
)

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 20 (
    echo ERROR: Node.js 20 or newer is required.
    echo Your installed version is:
    node --version
    echo Download the current LTS version from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "client\dist\index.html" (
    echo ERROR: The built web interface is missing.
    echo Please extract the complete ZIP before starting the app.
    echo.
    pause
    exit /b 1
)

if not exist "server\node_modules\express\package.json" (
    echo ERROR: The bundled server dependencies are missing.
    echo Please extract the complete ZIP before starting the app.
    echo.
    pause
    exit /b 1
)

if not exist "server\data" mkdir "server\data"

echo Node.js detected:
node --version
echo.
echo Opening http://localhost:3001 in your browser...
echo Keep this window open while using the quiz.
echo Press Ctrl+C to stop the app.
echo ================================================
echo.

where powershell.exe >nul 2>&1
if errorlevel 1 (
    start "" http://localhost:3001
) else (
    start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3001'"
)

node server\index.js
set "APP_EXIT=%ERRORLEVEL%"

echo.
if not "%APP_EXIT%"=="0" echo The app stopped with error code %APP_EXIT%.
echo Infinity Live Quiz has stopped.
pause
exit /b %APP_EXIT%
