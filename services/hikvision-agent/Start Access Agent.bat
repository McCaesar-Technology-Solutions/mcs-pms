@echo off
title MOJO Access Agent
cd /d "%~dp0"

echo.
echo  MOJO Access Agent
echo  =================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed on this PC.
  echo.
  echo Install the LTS version from https://nodejs.org
  echo Then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo No settings file yet.
  echo.
  echo 1. In MOJO go to Owner - Access
  echo 2. Click Start setup, then Copy full .env
  echo 3. Ask your installer to paste that into a file named .env
  echo    in this same folder, then run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing components ^(one time^)...
  call npm install
  if errorlevel 1 (
    echo Install failed. Check internet connection and try again.
    pause
    exit /b 1
  )
)

echo Starting... Keep this window open while the hotel is operating.
echo Close the window only when you want to stop door sync.
echo.
call npm start
pause
