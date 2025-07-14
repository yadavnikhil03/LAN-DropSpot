#!/bin/bash

echo "=========================================="
echo "   LAN DropSpot - File Sharing Server"
echo "=========================================="
echo

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed"
    echo
    echo "Please install Python 3.7+ using your package manager:"
    echo "  Ubuntu/Debian: sudo apt install python3 python3-pip"
    echo "  macOS: brew install python3"
    echo "  CentOS/RHEL: sudo yum install python3 python3-pip"
    echo
    exit 1
fi

echo "[INFO] Python found:"
python3 --version

# Create uploads directory
if [ ! -d "uploads" ]; then
    echo "[INFO] Creating uploads directory..."
    mkdir -p uploads
fi

# Install dependencies
echo "[INFO] Installing required packages..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    echo
    echo "Try running: pip3 install --upgrade pip"
    echo "Then run this script again"
    echo
    exit 1
fi

echo
echo "[SUCCESS] Dependencies installed successfully!"
echo
echo "=========================================="
echo "   Starting LAN DropSpot Server..."
echo "=========================================="
echo

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)

echo "Your server will be accessible at:"
echo "  - Local: http://localhost:8000"
echo "  - Network: http://$LOCAL_IP:8000"
echo
echo "Share the network URL with other devices!"
echo "Press Ctrl+C to stop the server"
echo

# Open browser (if available)
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8000 &
elif command -v open &> /dev/null; then
    open http://localhost:8000 &
fi

# Start the server
cd backend
python3 main.py
