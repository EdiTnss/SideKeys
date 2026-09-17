@echo off
rem Double-click this (or the desktop shortcut) to open Voicing Lab.
rem It starts the page server, starts the AI proxy, then opens the app in Chrome.
rem Two console windows stay open: closing them stops the servers.
setlocal
title Voicing Lab
cd /d "%~dp0"

echo Starting Voicing Lab...
echo.

rem The page needs a server: ES modules do not load from file:// .
netstat -ano | findstr /c:":3000" | findstr /c:"LISTENING" >nul
if errorlevel 1 (
  echo   page server     : starting on port 3000
  start "Voicing Lab page - close this window to stop" cmd /k npx --yes serve . -l 3000
) else (
  echo   page server     : already running on port 3000
)

rem The proxy is only needed for Ask Claude and Reharmonize.
netstat -ano | findstr /c:":8787" | findstr /c:"LISTENING" >nul
if errorlevel 1 (
  echo   AI proxy        : starting on port 8787
  start "Voicing Lab AI proxy - close this window to stop" cmd /k npm --prefix worker run dev
) else (
  echo   AI proxy        : already running on port 8787
)

echo.
echo Waiting for the servers...
rem ping, not timeout: timeout refuses to run when input is redirected.
ping -n 6 127.0.0.1 >nul

set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%BROWSER%" (
  start "" "%BROWSER%" "http://localhost:3000"
) else (
  rem Web MIDI needs Chrome or Edge; the default browser may not have it.
  start "" "http://localhost:3000"
)

echo.
echo Voicing Lab is open at http://localhost:3000
echo Close the two server windows when you are done.
ping -n 4 127.0.0.1 >nul
endlocal
