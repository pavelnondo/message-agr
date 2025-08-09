import asyncio
import logging
import ssl
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
import json

from crud import (
    async_session, engine, Base, 
    get_chats, get_chat, get_messages, create_chat, create_message, 
    get_stats, get_chats_with_last_messages, get_chat_messages, get_chat_by_user_id,
    delete_chat, get_bot_settings, get_bot_setting, update_bot_setting,
    update_chat_manager_confirmation
)
from sqlalchemy.ext.asyncio import AsyncSession
import aiohttp
import os

from config import settings, DATABASE_URL
from cache import cache_service
from ai_processor import ai_processor
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time

# Secrets must come from environment; do not hardcode defaults
TELEGRAM_BOT_TOKEN = settings.bot_token
N8N_WEBHOOK_URL = settings.n8n_webhook_url

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP Requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])
AI_REQUEST_COUNT = Counter('ai_requests_total', 'Total AI Requests', ['status'])
AI_REQUEST_LATENCY = Histogram('ai_request_duration_seconds', 'AI request latency')

# Pydantic models for API
class ChatCreate(BaseModel):
    user_id: str

class MessageCreate(BaseModel):
    chat_id: int
    message: str
    message_type: str  # 'question' or 'answer'

class ChatUpdate(BaseModel):
    is_awaiting_manager_confirmation: Optional[bool] = None

class BotSettingUpdate(BaseModel):
    value: str

# Telegram webhook models
class TelegramMessage(BaseModel):
    message_id: int
    from_user: Optional[Dict[str, Any]] = None
    chat: Optional[Dict[str, Any]] = None
    text: Optional[str] = None
    date: Optional[int] = None

class TelegramUpdate(BaseModel):
    update_id: int
    message: Optional[TelegramMessage] = None

# Database dependency
async def get_db():
    async with async_session() as session:
        yield session

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                self.active_connections.remove(connection)

manager = ConnectionManager()

# Database initialization
async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    await init_db()
    
    # Start background tasks
    asyncio.create_task(telegram_polling_task())
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")

app = FastAPI(lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/webhook/{webhook_id}")
async def telegram_webhook(webhook_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Telegram webhook"""
    try:
        body = await request.json()
        logger.info(f"Received webhook: {webhook_id}")
        
        # Process the webhook data
        if "message" in body:
            chat_obj = body["message"].get("chat", {})
            from_obj = body["message"].get("from", {})
            chat_id_num = chat_obj.get("id")
            from_id_num = from_obj.get("id")
            username = from_obj.get("username")
            first_name = from_obj.get("first_name")
            last_name = from_obj.get("last_name")
            chat_title = chat_obj.get("title")
            # Build a stable, human-friendly display id that includes chat_id
            display_name_parts = []
            if username:
                display_name_parts.append(username)
            elif first_name or last_name:
                display_name_parts.append(" ".join([p for p in [first_name, last_name] if p]))
            elif chat_title:
                display_name_parts.append(chat_title)
            elif from_id_num:
                display_name_parts.append(str(from_id_num))
            display_id = (display_name_parts[0] if display_name_parts else str(chat_id_num)) + f" [{chat_id_num}]"

            message_data = {
                "chat_id": chat_id_num,
                "user_id": display_id,
                "text": body["message"].get("text", ""),
                "message_id": body["message"]["message_id"],
                "date": body["message"]["date"]
            }
            
            # Process the message
            await process_telegram_message(message_data)
            
            # Forward to n8n if configured
            if N8N_WEBHOOK_URL:
                await forward_to_n8n({
                    "chat_id": message_data["chat_id"],
                    "user_id": message_data["user_id"],
                    "text": message_data["text"],
                    "message_type": "question",
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API Endpoints
@app.get("/api/chats", response_model=List[Dict[str, Any]])
async def read_chats(db: AsyncSession = Depends(get_db)):
    """Get all chats"""
    try:
        # Return chats with their last message for better frontend preview
        chats = await get_chats_with_last_messages(db)
        return chats
    except Exception as e:
        logger.error(f"Error getting chats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats/{chat_id}")
async def read_chat(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific chat"""
    try:
        chat = await get_chat(db, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        return {
            "id": str(chat.id),
            "user_id": chat.user_id,
            "is_awaiting_manager_confirmation": chat.is_awaiting_manager_confirmation,
            "created_at": chat.created_at.isoformat(),
            "updated_at": chat.updated_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chats")
async def create_chat_endpoint(chat: ChatCreate, db: AsyncSession = Depends(get_db)):
    """Create a new chat"""
    try:
        # Check if chat already exists for this user
        existing_chat = await get_chat_by_user_id(db, chat.user_id)
        if existing_chat:
            return {
                "id": str(existing_chat.id),
                "user_id": existing_chat.user_id,
                "is_awaiting_manager_confirmation": existing_chat.is_awaiting_manager_confirmation,
                "created_at": existing_chat.created_at.isoformat(),
                "updated_at": existing_chat.updated_at.isoformat()
            }
        
        new_chat = await create_chat(db, chat.user_id)
        return {
            "id": str(new_chat.id),
            "user_id": new_chat.user_id,
            "is_awaiting_manager_confirmation": new_chat.is_awaiting_manager_confirmation,
            "created_at": new_chat.created_at.isoformat(),
            "updated_at": new_chat.updated_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Error creating chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/chats/{chat_id}")
async def update_chat(chat_id: int, chat_update: ChatUpdate, db: AsyncSession = Depends(get_db)):
    """Update a chat"""
    try:
        if chat_update.is_awaiting_manager_confirmation is not None:
            updated_chat = await update_chat_manager_confirmation(
                db, chat_id, chat_update.is_awaiting_manager_confirmation
            )
            if not updated_chat:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            return {
                "id": str(updated_chat.id),
                "user_id": updated_chat.user_id,
                "is_awaiting_manager_confirmation": updated_chat.is_awaiting_manager_confirmation,
                "created_at": updated_chat.created_at.isoformat(),
                "updated_at": updated_chat.updated_at.isoformat()
            }
        
        return {"message": "No updates provided"}
    except Exception as e:
        logger.error(f"Error updating chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chats/{chat_id}")
async def delete_chat_endpoint(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chat"""
    try:
        success = await delete_chat(db, chat_id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        return {"message": "Chat deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats/{chat_id}/messages")
async def read_messages(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Get messages for a chat"""
    try:
        messages = await get_chat_messages(db, chat_id)
        return messages
    except Exception as e:
        logger.error(f"Error getting messages for chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/messages")
async def create_message_endpoint(msg: MessageCreate, db: AsyncSession = Depends(get_db)):
    """Create a new message"""
    try:
        if msg.message_type not in ['question', 'answer']:
            raise HTTPException(status_code=400, detail="message_type must be 'question' or 'answer'")
        
        new_message = await create_message(db, msg.chat_id, msg.message, msg.message_type)

        # If this is an answer from manager/AI, forward to Telegram client
        if msg.message_type == 'answer':
            try:
                chat = await get_chat(db, msg.chat_id)
                if chat and chat.user_id:
                    await send_message_to_telegram(int(chat.user_id), msg.message)
            except Exception as te:
                logger.error(f"Failed to forward answer to Telegram: {te}")

        # Forward message event to n8n as well (both question and answer)
        try:
            chat = await get_chat(db, msg.chat_id)
            await forward_to_n8n({
                "chat_id": msg.chat_id,
                "user_id": chat.user_id if chat else None,
                "text": msg.message,
                "message_type": msg.message_type,
                "timestamp": datetime.now().isoformat(),
            })
        except Exception as e:
            logger.error(f"Failed to forward message to n8n: {e}")
        
        # Broadcast to WebSocket clients
        message_data = {
            "id": str(new_message.id),
            "chat_id": str(new_message.chat_id),
            "message": new_message.message,
            "message_type": new_message.message_type,
            "created_at": new_message.created_at.isoformat()
        }
        await manager.broadcast(json.dumps({
            "type": "new_message",
            "data": message_data
        }))
        
        return message_data
    except Exception as e:
        logger.error(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Bot Settings API
@app.get("/api/bot-settings")
async def get_bot_settings_endpoint(db: AsyncSession = Depends(get_db)):
    """Get all bot settings"""
    try:
        settings = await get_bot_settings(db)
        return settings
    except Exception as e:
        logger.error(f"Error getting bot settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bot-settings/{key}")
async def get_bot_setting_endpoint(key: str, db: AsyncSession = Depends(get_db)):
    """Get a specific bot setting"""
    try:
        value = await get_bot_setting(db, key)
        if value is None:
            raise HTTPException(status_code=404, detail="Setting not found")
        
        return {"key": key, "value": value}
    except Exception as e:
        logger.error(f"Error getting bot setting {key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/bot-settings/{key}")
async def update_bot_setting_endpoint(key: str, setting_update: BotSettingUpdate, db: AsyncSession = Depends(get_db)):
    """Update a bot setting"""
    try:
        updated_setting = await update_bot_setting(db, key, setting_update.value)
        return {"key": updated_setting.key, "value": updated_setting.value}
    except Exception as e:
        logger.error(f"Error updating bot setting {key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_chat_stats(db: AsyncSession = Depends(get_db)):
    """Get chat statistics"""
    try:
        stats = await get_stats(db)
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoints
@app.websocket("/ws/messages")
async def messages_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/updates")
async def updates_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Telegram integration
async def send_message_to_telegram(chat_id: int, text: str):
    """Send message to Telegram"""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram bot token not configured")
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = {"chat_id": chat_id, "text": text}
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=data) as response:
            return await response.json()

async def forward_to_n8n(message_data):
    """Forward message to n8n webhook"""
    if not N8N_WEBHOOK_URL:
        logger.warning("N8N webhook URL not configured")
        return
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(N8N_WEBHOOK_URL, json=message_data) as response:
                if response.status == 200:
                    logger.info("Message forwarded to n8n successfully")
                else:
                    logger.error(f"Failed to forward message to n8n: {response.status}")
    except Exception as e:
        logger.error(f"Error forwarding to n8n: {e}")

# Middleware for monitoring
@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(process_time)
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    return response

# Rate limiting middleware
@app.middleware("http")
async def rate_limiter(request: Request, call_next):
    # Simple rate limiting - can be enhanced
    client_ip = request.client.host
    # Add rate limiting logic here if needed
    return await call_next(request)

# Background task for Telegram polling
async def telegram_polling_task():
    """Background task for Telegram polling"""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram bot token not configured, skipping polling")
        return
    
    logger.info("Starting Telegram polling task")
    
    while True:
        try:
            # Implement Telegram polling logic here
            # This is a placeholder - implement actual polling
            await asyncio.sleep(30)  # Poll every 30 seconds
        except Exception as e:
            logger.error(f"Error in Telegram polling: {e}")
            await asyncio.sleep(60)  # Wait longer on error

async def process_telegram_message(message_data: dict):
    """Process incoming Telegram message"""
    try:
        logger.info(f"Processing Telegram message: {message_data}")
        
        # Create or get chat for this user
        async with async_session() as db:
            # Use human-friendly composite id (includes chat id) for stable matching and display
            chat_key = str(message_data.get("user_id") or message_data.get("chat_id"))
            chat = await get_chat_by_user_id(db, chat_key)
            if not chat:
                chat = await create_chat(db, chat_key)
            
            # Create message record
            await create_message(
                db, 
                chat.id, 
                message_data["text"], 
                "question"
            )

            # Notify websocket listeners about chat updates so frontend can refresh list
            await manager.broadcast(json.dumps({
                "type": "chat_update",
                "data": {
                    "id": str(chat.id),
                    "user_id": chat.user_id,
                    "is_awaiting_manager_confirmation": chat.is_awaiting_manager_confirmation,
                    "created_at": chat.created_at.isoformat(),
                    "updated_at": chat.updated_at.isoformat(),
                }
            }))
        
        # Process with AI if needed
        # This would integrate with your AI processing logic
        
    except Exception as e:
        logger.error(f"Error processing Telegram message: {e}")

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5678)
