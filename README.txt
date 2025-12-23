================================================
       INFINITY LIVE QUIZ - README
================================================

REQUIREMENTS
------------
- Node.js (v18 or higher)
  Download from: https://nodejs.org

HOW TO RUN
----------
Windows:  Double-click "start-windows.bat"
Mac:      Double-click "start-mac.command"

The app will:
1. Install dependencies (first run only)
2. Start the server
3. Open your browser to http://localhost:3001

HOW TO STOP
-----------
Press Ctrl+C in the terminal window.

TROUBLESHOOTING
---------------
1. "Node.js not installed" error:
   - Download and install from https://nodejs.org
   - Restart your computer
   - Try running again

2. "Port 3001 in use" error:
   - Close any other apps using port 3001
   - Or find and kill the process using:
     Windows: netstat -ano | findstr :3001
     Mac: lsof -i :3001

3. Browser shows "Cannot connect":
   - Wait a few seconds and refresh
   - Check the terminal for error messages

DATA LOCATION
-------------
Your quiz data is stored in: server/data/quiz.db

SUPPORT
-------
For issues, please contact the developer.
