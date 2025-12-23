#!/bin/bash
echo "================================================"
echo "   Infinity Live Quiz - Starting Server..."
echo "================================================"
echo ""

# Change to script directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please download and install Node.js from: https://nodejs.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies!"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

echo ""
echo "Starting server and opening browser..."
echo ""
echo "Press Ctrl+C to stop the server."
echo "================================================"

# Open browser after a short delay
(sleep 2 && open http://localhost:3001) &

# Start the server
cd server
node index.js
