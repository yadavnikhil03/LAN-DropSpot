@echo off
title LAN DropSpot Enhanced

echo.
echo ==========================================
echo    LAN DropSpot Enhanced v2.0
echo ==========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo.
    echo Please install Python 3.8+ from https://python.org
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo [INFO] Python found:
python --version

REM Create necessary directories
if not exist "uploads" (
    echo [INFO] Creating uploads directory...
    mkdir uploads
)

REM Install dependencies
echo [INFO] Installing enhanced dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    echo.
    echo Try running: pip install --upgrade pip
    echo Then run this script again
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Dependencies installed successfully!
echo.

REM Change to backend directory and start the server
echo [INFO] Starting LAN DropSpot Enhanced server...
echo [INFO] The web interface will open automatically in your browser
echo [INFO] Press Ctrl+C to stop the server when done
echo.
cd backend
python main.py

echo.
echo [INFO] Server stopped. Press any key to exit...
pause
