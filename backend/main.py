import os
import asyncio
import socket
import uuid
import re
import webbrowser
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Set
import qrcode
from io import BytesIO
import base64
import json

from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
import uvicorn

# Configuration using environment variables
class Settings(BaseSettings):
    port: int = 8000
    host: str = "0.0.0.0"
    cleanup_interval_minutes: int = 30
    file_expiry_minutes: int = 30
    max_file_size_mb: int = 100
    debug: bool = False
    
    class Config:
        env_file = ".env"

settings = Settings()

app = FastAPI(
    title="LAN DropSpot Enhanced",
    description="Zero-setup drag-and-drop file sharing with real-time updates",
    version="2.0.0",
    debug=settings.debug
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory setup
BASE_DIR = Path(__file__).parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
FRONTEND_DIR = BASE_DIR / "frontend"

UPLOAD_DIR.mkdir(exist_ok=True)

# File registry and WebSocket connections
file_registry: Dict[str, dict] = {}
websocket_connections: Set[WebSocket] = set()

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and other security issues"""
    # Remove any path separators and dangerous characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = re.sub(r'\.\.+', '.', filename)  # Remove multiple dots
    filename = filename.strip('. ')  # Remove leading/trailing dots and spaces
    
    # Ensure filename is not empty and not too long
    if not filename:
        filename = "unnamed_file"
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:250] + ext
    
    return filename

def get_local_ip():
    """Get the local IP address of the machine"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"

def generate_qr_code(url: str) -> str:
    """Generate QR code and return as base64 PNG"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

async def broadcast_to_websockets(message: dict):
    """Broadcast message to all connected WebSocket clients"""
    if websocket_connections:
        disconnected = set()
        for websocket in websocket_connections:
            try:
                await websocket.send_text(json.dumps(message))
            except:
                disconnected.add(websocket)
        
        # Remove disconnected clients
        websocket_connections.difference_update(disconnected)

async def cleanup_expired_files():
    """Background task to clean up expired files"""
    while True:
        try:
            current_time = datetime.now()
            expired_files = []
            
            for file_id, info in list(file_registry.items()):
                if current_time > info['expires_at']:
                    expired_files.append(file_id)
                    
                    # Remove physical file
                    file_path = UPLOAD_DIR / info['safe_filename']
                    if file_path.exists():
                        file_path.unlink()
                        print(f"🗑️ Cleaned up expired file: {info['original_name']}")
            
            # Remove from registry and notify clients
            for file_id in expired_files:
                del file_registry[file_id]
                await broadcast_to_websockets({
                    'type': 'file_expired',
                    'file_id': file_id
                })
                
        except Exception as e:
            print(f"Error in cleanup task: {e}")
        
        # Check based on configured interval
        await asyncio.sleep(settings.cleanup_interval_minutes * 60)

@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    asyncio.create_task(cleanup_expired_files())
    
    local_ip = get_local_ip()
    print(f"\n🚀 LAN DropSpot Enhanced Server Started!")
    print(f"📡 Local Access: http://localhost:{settings.port}")
    print(f"🌐 Network Access: http://{local_ip}:{settings.port}")
    print(f"⚙️ File expiry: {settings.file_expiry_minutes} minutes")
    print(f"🧹 Cleanup interval: {settings.cleanup_interval_minutes} minutes")
    print(f"📁 Upload directory: {UPLOAD_DIR}")
    print("-" * 60)

# Serve frontend files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the main frontend page"""
    try:
        html_path = FRONTEND_DIR / "index.html"
        with open(html_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Frontend not found</h1><p>Please ensure frontend/index.html exists</p>",
            status_code=404
        )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    websocket_connections.add(websocket)
    
    try:
        # Send current file list to new client
        files_data = await get_files_data()
        await websocket.send_text(json.dumps({
            'type': 'initial_files',
            'files': files_data['files']
        }))
        
        # Keep connection alive
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_connections.discard(websocket)

async def get_files_data():
    """Get current files data"""
    active_files = []
    local_ip = get_local_ip()
    current_time = datetime.now()
    
    for file_id, info in file_registry.items():
        if current_time < info['expires_at']:
            time_remaining = info['expires_at'] - current_time
            minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
            
            download_url = f"http://{local_ip}:{settings.port}/api/download/{file_id}"
            
            active_files.append({
                'id': file_id,
                'name': info['original_name'],
                'size': info['size'],
                'download_url': download_url,
                'qr_code': generate_qr_code(download_url),
                'uploaded_at': info['uploaded_at'].isoformat(),
                'expires_at': info['expires_at'].isoformat(),
                'minutes_remaining': minutes_remaining,
                'seconds_remaining': int(time_remaining.total_seconds())
            })
    
    return {
        'files': active_files,
        'server_ip': local_ip,
        'total_files': len(active_files)
    }

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload one or more files with enhanced security"""
    if not files or files[0].filename == '':
        raise HTTPException(status_code=400, detail="No files provided")
    
    uploaded_files = []
    local_ip = get_local_ip()
    
    for file in files:
        if not file.filename:
            continue
        
        # Check file size
        content = await file.read()
        if len(content) > settings.max_file_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Maximum size: {settings.max_file_size_mb}MB"
            )
        
        # Generate secure file ID and sanitize filename
        file_id = str(uuid.uuid4())
        original_name = file.filename
        sanitized_name = sanitize_filename(original_name)
        safe_filename = f"{file_id}_{sanitized_name}"
        file_path = UPLOAD_DIR / safe_filename
        
        # Save file securely
        try:
            with open(file_path, "wb") as f:
                f.write(content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
        # Calculate expiry
        expires_at = datetime.now() + timedelta(minutes=settings.file_expiry_minutes)
        
        # Register file
        file_info = {
            'safe_filename': safe_filename,
            'original_name': original_name,
            'size': len(content),
            'uploaded_at': datetime.now(),
            'expires_at': expires_at,
            'content_type': file.content_type or 'application/octet-stream'
        }
        file_registry[file_id] = file_info
        
        # Generate download URL and QR code
        download_url = f"http://{local_ip}:{settings.port}/api/download/{file_id}"
        qr_code_base64 = generate_qr_code(download_url)
        
        file_data = {
            'id': file_id,
            'name': original_name,
            'size': len(content),
            'download_url': download_url,
            'qr_code': qr_code_base64,
            'uploaded_at': file_info['uploaded_at'].isoformat(),
            'expires_at': expires_at.isoformat(),
            'minutes_remaining': settings.file_expiry_minutes,
            'seconds_remaining': settings.file_expiry_minutes * 60
        }
        
        uploaded_files.append(file_data)
        
        # Broadcast new file to WebSocket clients
        await broadcast_to_websockets({
            'type': 'file_uploaded',
            'file': file_data
        })
    
    return {
        'success': True,
        'message': f'Successfully uploaded {len(uploaded_files)} file(s)',
        'files': uploaded_files,
        'server_ip': local_ip
    }

@app.get("/api/files")
async def list_files():
    """Get list of all active files"""
    return await get_files_data()

@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    """Download a file by its UUID"""
    # Validate UUID format
    try:
        uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID format")
    
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found or expired")
    
    file_info = file_registry[file_id]
    file_path = UPLOAD_DIR / file_info['safe_filename']
    
    if not file_path.exists():
        del file_registry[file_id]
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Check if file has expired
    if datetime.now() > file_info['expires_at']:
        file_path.unlink()
        del file_registry[file_id]
        raise HTTPException(status_code=410, detail="File has expired")
    
    # Broadcast download event
    await broadcast_to_websockets({
        'type': 'file_downloaded',
        'file_id': file_id,
        'filename': file_info['original_name']
    })
    
    return FileResponse(
        path=str(file_path),
        filename=file_info['original_name'],
        media_type=file_info['content_type']
    )

@app.get("/api/qr/{file_id}")
async def get_qr_code(file_id: str):
    """Get QR code for a specific file"""
    try:
        uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID format")
    
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    local_ip = get_local_ip()
    download_url = f"http://{local_ip}:{settings.port}/api/download/{file_id}"
    qr_code_base64 = generate_qr_code(download_url)
    
    return {
        'qr_code': qr_code_base64,
        'download_url': download_url
    }

@app.delete("/api/delete/{file_id}")
async def delete_file(file_id: str):
    """Manually delete a file"""
    try:
        uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID format")
    
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_info = file_registry[file_id]
    file_path = UPLOAD_DIR / file_info['safe_filename']
    
    # Remove physical file
    if file_path.exists():
        file_path.unlink()
    
    # Remove from registry
    del file_registry[file_id]
    
    # Broadcast deletion
    await broadcast_to_websockets({
        'type': 'file_deleted',
        'file_id': file_id
    })
    
    return {'success': True, 'message': 'File deleted successfully'}

@app.get("/api/status")
async def get_status():
    """Get server status and configuration"""
    return {
        'status': 'running',
        'local_ip': get_local_ip(),
        'active_files': len(file_registry),
        'upload_directory': str(UPLOAD_DIR),
        'server_time': datetime.now().isoformat(),
        'config': {
            'port': settings.port,
            'file_expiry_minutes': settings.file_expiry_minutes,
            'cleanup_interval_minutes': settings.cleanup_interval_minutes,
            'max_file_size_mb': settings.max_file_size_mb
        }
    }

def open_browser():
    """Open the default browser after a short delay"""
    time.sleep(1.5)  # Wait for server to fully start
    local_ip = get_local_ip()
    url = f"http://{local_ip}:{settings.port}"
    print(f"\n🌐 Opening browser at: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    print("\n" + "="*50)
    print("🚀 Starting LAN DropSpot Enhanced Server...")
    print("="*50)
    
    local_ip = get_local_ip()
    print(f"📍 Local IP: {local_ip}")
    print(f"🔗 URL: http://{local_ip}:{settings.port}")
    print(f"📁 Upload Directory: {UPLOAD_DIR}")
    print("="*50 + "\n")
    
    # Open browser in a separate thread
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        access_log=True
    )
