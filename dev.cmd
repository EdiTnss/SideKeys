@echo off
rem Double-click this to work ON SideKeys. To play it, use start.cmd instead.
rem
rem It starts the game's dev server (Vite, hot reload) and opens it in Chrome. Pass "lab" to also
rem serve the analyzer bench and the local AI proxy, which only the bench needs:
rem   dev.cmd lab
rem Each server takes its own console window; closing a window stops that server. Note the game's
rem progress here is kept under localhost, separately from the progress at the published address.
setlocal
title SideKeys dev
cd /d "%~dp0"

echo Starting SideKeys dev...
echo.

rem The game: Vite on 5173, importing ..\src untouched.
netstat -ano | findstr /c:":5173" | findstr /c:"LISTENING" >nul
if errorlevel 1 (
  echo   game  : starting on port 5173
  start "SideKeys game dev server - close this window to stop" cmd /k npm --prefix app run dev
) else (
  echo   game  : already on port 5173
)

if /i "%~1"=="lab" (
  rem The bench needs a server of some kind: ES modules do not load from file:// .
  netstat -ano | findstr /c:":3000" | findstr /c:"LISTENING" >nul
  if errorlevel 1 (
    echo   lab   : starting on port 3000
    start "SideKeys lab - close this window to stop" cmd /k npx --yes serve . -l 3000
  ) else (
    echo   lab   : already on port 3000
  )

  rem The proxy is only for Ask Claude and Reharmonize, and both live in the bench.
  netstat -ano | findstr /c:":8787" | findstr /c:"LISTENING" >nul
  if errorlevel 1 (
    echo   proxy : starting on port 8787
    start "SideKeys AI proxy - close this window to stop" cmd /k npm --prefix worker run dev
  ) else (
    echo   proxy : already on port 8787
  )
)

echo.
echo Waiting for the dev server...
rem ping, not timeout: timeout refuses to run when input is redirected.
ping -n 6 127.0.0.1 >nul

set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%BROWSER%" (
  start "" "%BROWSER%" "http://localhost:5173"
) else (
  rem Web MIDI needs Chrome or Edge; the default browser may have neither.
  start "" "http://localhost:5173"
)

echo.
echo The game is at http://localhost:5173
if /i "%~1"=="lab" echo The bench is at http://localhost:3000
echo Close the server windows when you are done.
ping -n 4 127.0.0.1 >nul
endlocal
