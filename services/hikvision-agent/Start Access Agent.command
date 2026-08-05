#!/bin/bash
cd "$(dirname "$0")"
clear
echo ""
echo " MOJO Access Agent"
echo " ================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed on this Mac."
  echo ""
  echo "Install the LTS version from https://nodejs.org"
  echo "Then double-click this file again."
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -f .env ]; then
  echo "No settings file yet."
  echo ""
  echo "1. In MOJO go to Owner → Access"
  echo "2. Click Start setup, then Copy full .env"
  echo "3. Ask your installer to paste that into a file named .env"
  echo "   in this same folder, then run this again."
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing components (one time)..."
  npm install || {
    echo "Install failed. Check internet connection and try again."
    read -r -p "Press Enter to close..."
    exit 1
  }
fi

echo "Starting... Keep this window open while the hotel is operating."
echo "Close the window only when you want to stop door sync."
echo ""
npm start
read -r -p "Press Enter to close..."
