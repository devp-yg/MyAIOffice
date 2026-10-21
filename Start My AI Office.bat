@echo off
cd /d "%~dp0"
set "ARCH=%PROCESSOR_ARCHITECTURE%"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "ARCH=ARM64"
if /I "%ARCH%"=="ARM64" (
  set "NODE_EXE=%~dp0runtime\node\windows-arm64\node.exe"
) else (
  set "NODE_EXE=%~dp0runtime\node\windows-x64\node.exe"
)
if exist "%NODE_EXE%" (
  set "NODE_COMMAND=%NODE_EXE%"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js 24 or later is required. Install it or use a complete release ZIP.
    pause
    exit /b 1
  )
  set "NODE_COMMAND=node"
)
start "My AI Office Server" /min %NODE_COMMAND% "%~dp0server.mjs"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4173
echo The office is running. Close the minimized server window to stop it.
pause
