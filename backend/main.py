import asyncio
import logging
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
    update_chat_waiting, update_chat_ai, get_stats, 
    get_chats_with_last_messages, get_chat_messages, get_chat_by_uuid,
    add_chat_tag, remove_chat_tag, delete_chat
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
    uuid: str
    ai: bool = False
    name: str = "Unknown"
    tags: List[str] = []
    messager: str = "telegram"

class MessageCreate(BaseModel):
    chat_id: int
    message: str
    message_type: str
    ai: bool = False
    from_operator: bool = False

class ChatUpdate(BaseModel):
    waiting: Optional[bool] = None
    ai: Optional[bool] = None
    tags: Optional[List[str]] = None

class TagCreate(BaseModel):
    tag: str

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
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

# Create connection managers
messages_manager = ConnectionManager()
updates_manager = ConnectionManager()

# Database initialization
async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

# Application lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("STARTUP EVENT CALLED - Testing if this runs")
    
    # Initialize database
    await init_db()
    
    # Connect to cache
    # await cache_service.connect()
    
    # Start Telegram polling
    asyncio.create_task(telegram_polling_task())
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    await cache_service.disconnect()
    logger.info("Application shutdown complete")

# Create FastAPI app
app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Telegram webhook endpoint
@app.post("/webhook/{webhook_id}")
async def telegram_webhook(webhook_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Telegram webhook messages"""
    try:
        # Get the raw JSON data
        data = await request.json()
        logger.info(f"Received webhook data: {data}")
        
        # Process the update
        if "message" in data:
            message_data = data["message"]
            
            # Extract message information
            chat_id = message_data.get("chat", {}).get("id")
            user_id = message_data.get("from", {}).get("id")
            text = message_data.get("text", "")
            message_id = message_data.get("message_id")
            
            if chat_id and text:
                # Check if chat exists, create if not
                chat_uuid = str(chat_id)
                existing_chat = await get_chat_by_uuid(db, chat_uuid)
                
                if not existing_chat:
                    # Create new chat
                    chat_name = message_data.get("chat", {}).get("title") or message_data.get("chat", {}).get("first_name", "Unknown")
                    existing_chat = await create_chat(
                        db,
                        chat_uuid,
                        True,  # AI ON by default
                        chat_name,
                        [],
                        "telegram",
                    )
                    logger.info(f"Created new chat for Telegram user {chat_id}")
                
                # Create message
                new_message = await create_message(
                    db, 
                    existing_chat.id, 
                    text, 
                    "text", 
                    False  # not AI
                )
                
                # Broadcast to WebSocket clients
                message_data = {
                    "type": "message",
                    "chatId": str(existing_chat.id),
                    "content": text,
                    "message_type": "text",
                    "ai": False,
                    "sender": "client",  # Telegram messages are from client
                    "timestamp": new_message.created_at.isoformat(),
                    "id": new_message.id
                }
                await messages_manager.broadcast(json.dumps(message_data))
                
                logger.info(f"Processed Telegram message: {text[:50]}...")
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Failed to process webhook")

# Chat endpoints
@app.get("/api/chats", response_model=List[Dict[str, Any]])
async def read_chats(db: AsyncSession = Depends(get_db)):
    """Get all chats with their last messages"""
    try:
        chats_data = await get_chats_with_last_messages(db)
        logger.info(f"Retrieved {len(chats_data)} chats")
        return chats_data
    except Exception as e:
        logger.error(f"Error retrieving chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chats")

@app.get("/api/chats/{chat_id}")
async def read_chat(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific chat by ID"""
    try:
        chat = await get_chat(db, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chat")

@app.post("/api/chats")
async def create_chat_endpoint(chat: ChatCreate, db: AsyncSession = Depends(get_db)):
    """Create a new chat"""
    try:
        new_chat = await create_chat(
            db, 
            chat.uuid, 
            chat.ai, 
            chat.name, 
            chat.tags, 
            chat.messager
        )
        logger.info(f"Created new chat with ID: {new_chat.id}")
        return new_chat
    except Exception as e:
        logger.error(f"Error creating chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat")

@app.put("/api/chats/{chat_id}")
async def update_chat(chat_id: int, chat_update: ChatUpdate, db: AsyncSession = Depends(get_db)):
    """Update a chat's properties"""
    try:
        chat = await get_chat(db, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        if chat_update.waiting is not None:
            chat.waiting = chat_update.waiting
        if chat_update.ai is not None:
            chat.ai = chat_update.ai
        if chat_update.tags is not None:
            chat.tags = chat_update.tags
        
        await db.commit()
        await db.refresh(chat)
        logger.info(f"Updated chat {chat_id}")
        return chat
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update chat")

@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chat"""
    try:
        success = await delete_chat(db, chat_id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        logger.info(f"Deleted chat {chat_id}")
        return {"message": "Chat deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete chat")

# Message endpoints
@app.get("/api/chats/{chat_id}/messages")
async def read_messages(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Get all messages for a specific chat"""
    try:
        messages = await get_chat_messages(db, chat_id)
        logger.info(f"Retrieved {len(messages)} messages for chat {chat_id}")
        return messages
    except Exception as e:
        logger.error(f"Error retrieving messages for chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve messages")

@app.post("/api/messages")
async def create_message_endpoint(msg: MessageCreate, db: AsyncSession = Depends(get_db)):
    """Create a new message"""
    try:
        # Verify chat exists
        chat = await get_chat(db, msg.chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # If operator is intervening, disable AI for this chat
        if msg.from_operator:
            try:
                chat.ai = False
                await db.commit()
                await db.refresh(chat)
            except Exception as e:
                logger.error(f"Failed to disable AI on operator message: {e}")

        # Create message
        new_message = await create_message(
            db,
            msg.chat_id,
            msg.message,
            msg.message_type,
            msg.ai,
            msg.from_operator,
        )

        # If this is an operator message (manager), send to Telegram
        if msg.from_operator and not msg.ai:
            try:
                # Extract Telegram chat ID from chat UUID
                telegram_chat_id = int(chat.uuid)
                await send_message_to_telegram(telegram_chat_id, msg.message)
                logger.info(f"Sent message to Telegram chat {telegram_chat_id}")
            except Exception as e:
                logger.error(f"Failed to send message to Telegram: {e}")

        # Broadcast message to WebSocket clients
        message_data = {
            "type": "message",
            "chatId": str(new_message.chat_id),
            "content": new_message.message,
            "message_type": new_message.message_type,
            "ai": new_message.ai,
            "sender": (
                "ai" if new_message.ai else ("operator" if msg.from_operator else "client")
            ),
            "timestamp": new_message.created_at.isoformat(),
            "id": new_message.id
        }
        await messages_manager.broadcast(json.dumps(message_data))
        
        logger.info(f"Created message {new_message.id} for chat {msg.chat_id}")
        return new_message
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail="Failed to create message")

# Tag endpoints
@app.post("/api/chats/{chat_id}/tags")
async def add_tag(chat_id: int, tag_data: TagCreate, db: AsyncSession = Depends(get_db)):
    """Add a tag to a chat"""
    try:
        result = await add_chat_tag(db, chat_id, tag_data.tag)
        if result.get("message") == "error":
            raise HTTPException(status_code=404, detail="Chat not found")
        logger.info(f"Added tag '{tag_data.tag}' to chat {chat_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding tag to chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add tag")

@app.delete("/api/chats/{chat_id}/tags/{tag}")
async def remove_tag(chat_id: int, tag: str, db: AsyncSession = Depends(get_db)):
    """Remove a tag from a chat"""
    try:
        result = await remove_chat_tag(db, chat_id, tag)
        if result.get("message") == "error":
            raise HTTPException(status_code=404, detail="Chat not found")
        logger.info(f"Removed tag '{tag}' from chat {chat_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing tag from chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove tag")

# Stats endpoint
@app.get("/api/stats")
async def get_chat_stats(db: AsyncSession = Depends(get_db)):
    """Get chat statistics"""
    try:
        stats = await get_stats(db)
        logger.info(f"Retrieved stats: {stats}")
        return stats
    except Exception as e:
        logger.error(f"Error retrieving stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve stats")

# WebSocket endpoints
@app.websocket("/ws/messages")
async def messages_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time message updates"""
    await messages_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for now - you can add message processing logic here
            await messages_manager.broadcast(data)
    except WebSocketDisconnect:
        messages_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        messages_manager.disconnect(websocket)

@app.websocket("/ws/updates")
async def updates_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time chat updates"""
    await updates_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for now - you can add update processing logic here
            await updates_manager.broadcast(data)
    except WebSocketDisconnect:
        updates_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        updates_manager.disconnect(websocket)

async def send_message_to_telegram(chat_id: int, text: str):
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as resp:
            return await resp.json()

async def forward_to_n8n(message_data):
    """Forward message payload to n8n webhook if configured."""
    if not N8N_WEBHOOK_URL:
        logger.debug("N8N_WEBHOOK_URL not configured; skipping forward")
        return {"skipped": True}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(N8N_WEBHOOK_URL, json=message_data, timeout=15) as resp:
                try:
                    return await resp.json()
                except Exception:
                    return {"status": resp.status}
    except Exception as e:
        logger.error(f"Failed to forward to n8n: {e}")
        return {"error": str(e)}

@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    """Monitor HTTP requests for metrics"""
    start_time = time.time()
    response = await call_next(request)
    latency = time.time() - start_time
    
    REQUEST_COUNT.labels(
        request.method,
        request.url.path,
        response.status_code
    ).inc()
    
    REQUEST_LATENCY.labels(
        request.method,
        request.url.path
    ).observe(latency)
    
    return response

@app.middleware("http")
async def rate_limiter(request: Request, call_next):
    """Rate limiting middleware"""
    client_ip = request.client.host
    key = f"rate_limit:{client_ip}"
    
    # Check rate limit
    current_count = await cache_service.get(key) or 0
    if current_count >= settings.rate_limit:
        raise HTTPException(status_code=429, detail="Too many requests")
    
    # Increment counter
    await cache_service.set(key, current_count + 1, ttl=60)
    
    response = await call_next(request)
    return response

async def telegram_polling_task():
    """Enhanced Telegram polling with better error handling"""
    logger.info("Starting Telegram polling task...")
    last_update_id = None
    while True:
        try:
            url = f"https://api.telegram.org/bot{settings.bot_token}/getUpdates"
            params = {"timeout": 30}
            if last_update_id:
                params["offset"] = last_update_id + 1
            
            logger.debug(f"Polling Telegram API: {url}")
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=35) as resp:
                    data = await resp.json()
                    
                    if data.get("result"):
                        logger.info(f"Received {len(data['result'])} updates from Telegram")
                    
                    for update in data.get("result", []):
                        last_update_id = update["update_id"]
                        message = update.get("message")
                        if not message:
                            continue
                        
                        chat_id = message.get("chat", {}).get("id")
                        text = message.get("text", "")
                        
                        if chat_id and text:
                            logger.info(f"Processing message from chat {chat_id}: {text[:50]}...")
                            await process_telegram_message(message)
                            
        except Exception as e:
            logger.error(f"Polling error: {e}")
            await asyncio.sleep(5)  # Longer delay on error
        else:
            await asyncio.sleep(2)

async def process_telegram_message(message_data: dict):
    """Process Telegram message with caching and AI integration"""
    try:
        chat_id = message_data.get("chat", {}).get("id")
        text = message_data.get("text", "")
        user_id = message_data.get("from", {}).get("id")
        
        async with async_session() as db:
            # Get or create chat
            chat_uuid = str(chat_id)
            existing_chat = await get_chat_by_uuid(db, chat_uuid)
            
            if not existing_chat:
                chat_name = message_data.get("chat", {}).get("title") or message_data.get("chat", {}).get("first_name", "Unknown")
                existing_chat = await create_chat(db, chat_uuid, False, chat_name, [], "telegram")
            
            # Create user message
            new_message = await create_message(db, existing_chat.id, text, "text", False)
            
            # Cache invalidation
            await cache_service.invalidate_chat_cache(str(existing_chat.id))
            
            # Broadcast to frontend
            message_data = {
                "type": "message",
                "chatId": str(existing_chat.id),
                "content": text,
                "message_type": "text",
                "ai": False,
                "sender": "client",  # Telegram messages are from client
                "timestamp": new_message.created_at.isoformat(),
                "id": new_message.id
            }
            await messages_manager.broadcast(json.dumps(message_data))
            
            # Forward raw message to n8n if configured
            try:
                await forward_to_n8n({
                    "source": "telegram",
                    "chat_id": chat_id,
                    "user_id": user_id,
                    "text": text,
                    "internal_chat_id": existing_chat.id,
                    "timestamp": new_message.created_at.isoformat(),
                })
            except Exception as e:
                logger.error(f"Forward to n8n failed: {e}")

            # Only forward to n8n / process AI if chat AI is enabled
            ai_response = None
            if existing_chat.ai:
                ai_start_time = time.time()
                # Forward raw message to n8n for workflow handling as well
                try:
                    await forward_to_n8n({
                        "source": "telegram",
                        "chat_id": chat_id,
                        "user_id": user_id,
                        "text": text,
                        "internal_chat_id": existing_chat.id,
                        "timestamp": new_message.created_at.isoformat(),
                    })
                except Exception as e:
                    logger.error(f"Forward to n8n failed: {e}")

                ai_response = await ai_processor.process_message({
                    "chat_id": chat_id,
                    "text": text,
                    "user_id": user_id,
                    "timestamp": new_message.created_at.isoformat(),
                })

                AI_REQUEST_LATENCY.observe(time.time() - ai_start_time)

            if ai_response and ai_response.get("success"):
                flags = (ai_response.get("metadata") or {}).get("flags") or {}
                waiting = bool(flags.get("waiting", False))
                ai_enabled = not bool(flags.get("ai_off", False))

                # Update chat flags based on n8n output
                try:
                    chat_obj = await get_chat(db, existing_chat.id)
                    if chat_obj:
                        chat_obj.waiting = waiting
                        chat_obj.ai = ai_enabled
                        await db.commit()
                        await db.refresh(chat_obj)
                except Exception as e:
                    logger.error(f"Failed to update chat flags from n8n: {e}")

                # Send AI response to Telegram
                await send_message_to_telegram(chat_id, ai_response["answer"])
                
                # Store AI response
                ai_message = await create_message(db, existing_chat.id, ai_response["answer"], "text", True)
                
                # Broadcast AI response
                ai_message_data = {
                    "type": "message",
                    "chatId": str(existing_chat.id),
                    "content": ai_response["answer"],
                    "message_type": "text",
                    "ai": True,
                    "sender": "ai",  # AI responses
                    "timestamp": ai_message.created_at.isoformat(),
                    "id": ai_message.id
                }
                await messages_manager.broadcast(json.dumps(ai_message_data))
                
                AI_REQUEST_COUNT.labels("success").inc()
            else:
                AI_REQUEST_COUNT.labels("failed").inc()
                
            logger.info(f"Processed Telegram message: {text[:50]}...")
            
    except Exception as e:
        logger.error(f"Error processing Telegram message: {e}")
        AI_REQUEST_COUNT.labels("error").inc()

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5678)
