@echo off
REM Creates a Startup shortcut so the Access Agent starts when Windows logs in.
cd /d "%~dp0"

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%~dp0Start Access Agent.bat"
set "LINK=%STARTUP%\MOJO Access Agent.lnk"

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LINK%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Save()"

echo.
echo Done. The Access Agent will start automatically when this Windows user logs in.
echo.
pause
