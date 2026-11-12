@echo off
cd /d "%~dp0"
node tools\start-schedule-preview.cjs
if errorlevel 1 pause
