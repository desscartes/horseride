@echo off
title HorseRide - Haftalik Video Onarimi
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "D:\Apps\HorseRide\server\launch-weekly-video-repair.ps1"
if errorlevel 1 pause
