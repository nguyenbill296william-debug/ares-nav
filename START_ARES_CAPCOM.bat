@echo off
title ARES-NAV // CapCom Live Wi-Fi Telemetry Server
cd /d "%~dp0"

if exist "D:\SystemUpdateHost\python.exe" (
    "D:\SystemUpdateHost\python.exe" ares_capcom_server.py
    goto :end
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    py -3 ares_capcom_server.py
    goto :end
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python ares_capcom_server.py
    goto :end
)

echo [ERROR] Python 3 executable not found. Please install Python 3 or open index.html directly.
pause

:end
