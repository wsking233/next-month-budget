@echo off
setlocal
cd /d "%~dp0"
rem Use the desktop runtime when available; do not change the global PATH.
set "NEXT_MONTH_RUNTIME=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies"
if exist "%NEXT_MONTH_RUNTIME%\bin\fallback\pnpm.cmd" (
  set "PATH=%NEXT_MONTH_RUNTIME%\node\bin;%NEXT_MONTH_RUNTIME%\bin\fallback;%PATH%"
  call "%NEXT_MONTH_RUNTIME%\bin\fallback\pnpm.cmd" %*
  exit /b
)
call pnpm %*
exit /b
