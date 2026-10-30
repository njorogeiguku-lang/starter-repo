@echo off
title FlowForge AI sharing link
echo FlowForge must already be running in phone mode on port 4173.
echo Keep this window open for as long as you want the sharing link to work.
echo The link is temporary. Visitors also need the invite code shown by the app.
echo.
ssh.exe -o ServerAliveInterval=60 -R 80:127.0.0.1:4173 nokey@localhost.run
echo.
echo The sharing link has closed. Close this window when finished.
pause
