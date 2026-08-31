@echo off
REM Linewatch — Chris Decker
REM Double-click. This PC becomes house DNS.
cd /d "%~dp0..\.."
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org then double-click again.
  pause
  exit /b 1
)
node install\setup.mjs
pause
