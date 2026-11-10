@echo off
REM Serves the page on http://localhost:8000 (needed for "Use my location" and place search)
cd /d "%~dp0"
start "" http://localhost:8000
where python >nul 2>nul && (python -m http.server 8000 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 8000 -c-1 & goto :eof)
echo Python or Node.js is required to run the local server.
pause

