@echo off
rem Double-click this (or the desktop shortcut) to play SideKeys.
rem
rem It opens the published game in its own browser window. There is no server to start, nothing
rem to install and nothing to wait for: the game is a PWA, so after the first visit it also opens
rem with the network down. Progress lives in the browser, under the published address, so it is
rem the same progress every time -- which a localhost server would not give you.
rem
rem To work ON the game rather than play it, use dev.cmd.
setlocal
title SideKeys

set "GAME=https://sidekeys.app/"

rem --app gives a window with no tabs and no address bar, so it behaves like an installed app.
rem Web MIDI needs a secure context, which the published HTTPS address is.
set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"

rem Edge is the other browser that implements Web MIDI; Firefox and Safari do not.
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%BROWSER%" (
  start "" "%BROWSER%" --app=%GAME%
  exit /b
)

rem Neither is installed: the default browser still shows the game, but MIDI will not work in it.
echo Chrome or Edge is needed for the MIDI keyboard; opening the default browser instead.
start "" "%GAME%"
endlocal
