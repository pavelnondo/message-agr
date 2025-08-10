import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text

from crud import (
    get_chats, get_chat, get_chat_by_user_id, create_chat, get_messages, 
    create_message, get_chats_with_last_messages, get_stats, delete_chat,
    get_bot_settings, get_bot_setting, update_bot_setting, update_chat_ai_status
)
from shared import get_database_url
import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
BOT_TOKEN = os.getenv("BOT_TOKEN")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL")

# Create async engine and session
DATABASE_URL = get_database_url()
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Pydantic models
class ChatCreate(BaseModel):
    user_id: str

class MessageCreate(BaseModel):
    chat_id: int
    message: str
    message_type: str  # 'question' or 'answer'

class ChatUpdate(BaseModel):
    is_awaiting_manager_confirmation: Optional[bool] = None
    ai_enabled: Optional[bool] = None

class BotSettingUpdate(BaseModel):
    value: str

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
    async with AsyncSessionLocal() as session:
        yield session

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove dead connections
                self.active_connections.remove(connection)

manager = ConnectionManager()

async def init_db():
    """Initialize database and ensure CASCADE constraints"""
    try:
        from crud import Base
        
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            # Ensure ON DELETE CASCADE for messages.chat_id
            try:
                await conn.execute(text("""
                    ALTER TABLE messages 
                    DROP CONSTRAINT IF EXISTS messages_chat_id_fkey;
                """))
                await conn.execute(text("""
                    ALTER TABLE messages 
                    ADD CONSTRAINT messages_chat_id_fkey 
                    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;
                """))
                logger.info("Ensured messages.chat_id FK has ON DELETE CASCADE")
            except Exception as e:
                logger.warning(f"Could not enforce ON DELETE CASCADE for messages.chat_id: {e}")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

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
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/chats/{chat_id}")
async def read_chat(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific chat"""
    try:
        chat = await get_chat(db, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat
    except Exception as e:
        logger.error(f"Error getting chat: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/chats")
async def create_chat_endpoint(chat: ChatCreate, db: AsyncSession = Depends(get_db)):
    """Create a new chat"""
    try:
        new_chat = await create_chat(db, chat.user_id)
        return new_chat
    except Exception as e:
        logger.error(f"Error creating chat: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/chats/{chat_id}")
async def update_chat(chat_id: int, chat_update: ChatUpdate, db: AsyncSession = Depends(get_db)):
    """Update a chat"""
    try:
        chat = await get_chat(db, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        if chat_update.is_awaiting_manager_confirmation is not None:
            chat.is_awaiting_manager_confirmation = chat_update.is_awaiting_manager_confirmation
        if chat_update.ai_enabled is not None:
            chat.ai_enabled = chat_update.ai_enabled
        
        await db.commit()
        await db.refresh(chat)
        return chat
    except Exception as e:
        logger.error(f"Error updating chat: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/chats/{chat_id}")
async def delete_chat_endpoint(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chat and all its messages"""
    try:
        success = await delete_chat(db, chat_id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"message": "Chat deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting chat: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/chats/{chat_id}/messages")
async def read_messages(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Get all messages for a specific chat"""
    try:
        messages = await get_messages(db, chat_id)
        # Return a plain list for simplicity; frontend can accept both
        return messages
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/chats/{chat_id}/messages")
async def send_message(chat_id: int, message: MessageCreate, db: AsyncSession = Depends(get_db)):
    """Send a message to a specific chat"""
    try:
        new_message = await create_message(
            db, 
            chat_id, 
            message.message, 
            message.message_type
        )
        
        # Broadcast new message to websockets with full payload
        await manager.broadcast(json.dumps({
            "type": "new_message",
            "data": {
                "id": str(new_message.id),
                "chat_id": str(new_message.chat_id),
                "message": new_message.message,
                "message_type": new_message.message_type,
                "created_at": new_message.created_at.isoformat(),
            }
        }))

        # Forward to n8n if configured
        if N8N_WEBHOOK_URL:
            await forward_to_n8n({
                "chat_id": chat_id,
                "message": message.message,
                "message_type": message.message_type,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        return new_message
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/bot-settings")
async def get_bot_settings_endpoint(db: AsyncSession = Depends(get_db)):
    """Get all bot settings"""
    try:
        settings = await get_bot_settings(db)
        return settings
    except Exception as e:
        logger.error(f"Error getting bot settings: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/bot-settings/{key}")
async def get_bot_setting_endpoint(key: str, db: AsyncSession = Depends(get_db)):
    """Get a specific bot setting"""
    try:
        setting = await get_bot_setting(db, key)
        if not setting:
            raise HTTPException(status_code=404, detail="Setting not found")
        return {"key": key, "value": setting}
    except Exception as e:
        logger.error(f"Error getting bot setting: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/bot-settings/{key}")
async def update_bot_setting_endpoint(key: str, setting_update: BotSettingUpdate, db: AsyncSession = Depends(get_db)):
    """Update a bot setting"""
    try:
        setting = await update_bot_setting(db, key, setting_update.value)
        return setting
    except Exception as e:
        logger.error(f"Error updating bot setting: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/stats")
async def get_chat_stats(db: AsyncSession = Depends(get_db)):
    """Get chat and message statistics"""
    try:
        stats = await get_stats(db)
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.websocket("/ws/messages")
async def messages_websocket(websocket: WebSocket):
    """WebSocket endpoint for message updates"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"Message: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/updates")
async def updates_websocket(websocket: WebSocket):
    """WebSocket endpoint for chat updates"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"Update: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def send_message_to_telegram(chat_id: int, text: str):
    """Send a message to Telegram (placeholder for future implementation)"""
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN not configured, cannot send Telegram message")
        return False
    
    try:
        api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {"chat_id": chat_id, "text": text}
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, json=payload) as resp:
                if resp.status == 200:
                    logger.info("Sent message to Telegram")
                    return True
                else:
                    body = await resp.text()
                    logger.error(f"Failed to send Telegram message: {resp.status} {body}")
                    return False
    except Exception as e:
        logger.error(f"Error sending Telegram message: {e}")
        return False

async def forward_to_n8n(message_data) -> bool:
    """Forward message to n8n webhook and handle response"""
    if not N8N_WEBHOOK_URL:
        logger.warning("N8N_WEBHOOK_URL not configured")
        return False
    
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            async with session.post(
                N8N_WEBHOOK_URL,
                json=message_data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    response_data = await response.json()
                    logger.info(f"N8n response: {response_data}")
                    
                    # Handle n8n response
                    await handle_n8n_response(message_data, response_data)
                    return True
                else:
                    logger.error(f"Failed to forward message to n8n: {response.status}")
                    # Send fallback message to Telegram
                    await send_fallback_message(message_data)
                    return False
    except Exception as e:
        logger.error(f"Error forwarding to n8n: {e}")
        # Send fallback message to Telegram
        await send_fallback_message(message_data)
        return False

async def handle_n8n_response(original_message: dict, n8n_response: dict):
    """Handle response from n8n webhook"""
    try:
        # Extract the answer from n8n response
        answer = n8n_response.get("answer", "")
        manager_handover = n8n_response.get("manager", "false") == "true"
        
        if answer:
            # Extract user_id from original message
            user_id = original_message.get("user_id", "")
            if " [" in user_id:
                user_id = user_id.split(" [")[0]
            
            # Get chat
            async with AsyncSessionLocal() as db:
                chat = await get_chat_by_user_id(db, user_id)
                if chat:
                    # Save the AI response to database
                    await create_message(
                        db, 
                        chat.id, 
                        answer, 
                        "answer"
                    )
                    
                    # Send response to Telegram using original Telegram chat id when available
                    telegram_chat_id = original_message.get("chat_id")
                    if telegram_chat_id is not None:
                        await send_message_to_telegram(int(telegram_chat_id), answer)
                    
                    # Notify frontend about new AI response
                    await manager.broadcast(json.dumps({
                        "type": "new_message",
                        "data": {
                            "chat_id": str(chat.id),
                            "message": answer,
                            "message_type": "answer",
                            "user_id": user_id
                        }
                    }))
                    
                    # If manager handover is requested, update chat status
                    if manager_handover:
                        await update_chat_ai_status(db, chat.id, False)
                        
                        # Notify frontend about status change
                        await manager.broadcast(json.dumps({
                            "type": "chat_update",
                            "data": {
                                "id": str(chat.id),
                                "user_id": chat.user_id,
                                "ai_enabled": False,
                                "is_awaiting_manager_confirmation": True,
                                "created_at": chat.created_at.isoformat(),
                                "updated_at": chat.updated_at.isoformat(),
                            }
                        }))
                        
    except Exception as e:
        logger.error(f"Error handling n8n response: {e}")

async def send_fallback_message(message_data: dict):
    """Send fallback message when n8n fails"""
    try:
        user_id = message_data.get("user_id", "")
        if " [" in user_id:
            user_id = user_id.split(" [")[0]
        
        async with AsyncSessionLocal() as db:
            chat = await get_chat_by_user_id(db, user_id)
            if chat:
                fallback_message = "Sorry, I'm having trouble processing your message right now. Please try again later."
                await send_message_to_telegram(chat.id, fallback_message)
                
                # Save fallback message to database
                await create_message(db, chat.id, fallback_message, "answer")
                
                # Notify frontend
                await manager.broadcast(json.dumps({
                    "type": "new_message",
                    "data": {
                        "chat_id": str(chat.id),
                        "message": fallback_message,
                        "message_type": "answer",
                        "user_id": user_id
                    }
                }))
    except Exception as e:
        logger.error(f"Error sending fallback message: {e}")

@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    """Monitor all requests for debugging"""
    start_time = datetime.now()
    response = await call_next(request)
    process_time = datetime.now() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time.total_seconds():.3f}s")
    return response

@app.middleware("http")
async def rate_limiter(request: Request, call_next):
    # Simple rate limiting - can be enhanced
    response = await call_next(request)
    return response

async def telegram_polling_task():
    """Background task for Telegram polling"""
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN not configured, skipping Telegram polling")
        return
    
    logger.info("Starting Telegram polling...")
    offset = 0  # Track the last update_id we've processed
    
    while True:
        try:
            # Fetch updates from Telegram
            url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
            params = {"offset": offset, "timeout": 30}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if data.get("ok") and data.get("result"):
                            for update in data["result"]:
                                update_id = update.get("update_id")
                                message = update.get("message")
                                
                                if message and update_id > offset:
                                    offset = update_id + 1  # Mark as processed
                                    
                                    # Extract message data
                                    message_data = {
                                        "message_id": message.get("message_id"),
                                        "user_id": f"{message['from'].get('first_name', '')} {message['from'].get('username', '')} [{message['from'].get('id', '')}]",
                                        "text": message.get("text", ""),
                                        "date": message.get("date")
                                    }
                                    
                                    logger.info(f"Received Telegram message: {message_data}")
                                    
                                    # Process the message
                                    await process_telegram_message(message_data)
                                    
                                    # Forward to n8n
                                    await forward_to_n8n(message_data)
                        else:
                            logger.debug("No new updates from Telegram")
                    else:
                        logger.error(f"Telegram API error: {response.status}")
                        
        except Exception as e:
            logger.error(f"Error in Telegram polling: {e}")
            await asyncio.sleep(60)  # Wait longer on error

async def process_telegram_message(message_data: dict):
    """Process incoming Telegram message"""
    try:
        logger.info(f"Processing Telegram message: {message_data}")
        
        # Extract username without the [id] part
        user_id = message_data.get("user_id", "")
        if " [" in user_id:
            user_id = user_id.split(" [")[0]
        
        # Create or get chat for this user
        async with AsyncSessionLocal() as db:
            chat = await get_chat_by_user_id(db, user_id)
            if not chat:
                chat = await create_chat(db, user_id)
            
            # Create message record
            await create_message(
                db, 
                chat.id, 
                message_data["text"], 
                "question"
            )

            # Notify websocket listeners about new message
            await manager.broadcast(json.dumps({
                "type": "new_message",
                "data": {
                    "chat_id": str(chat.id),
                    "message": message_data["text"],
                    "message_type": "question",
                    "user_id": user_id
                }
            }))

            # Notify websocket listeners about chat updates
            await manager.broadcast(json.dumps({
                "type": "chat_update",
                "data": {
                    "id": str(chat.id),
                    "user_id": chat.user_id,
                    "ai_enabled": chat.ai_enabled,
                    "is_awaiting_manager_confirmation": chat.is_awaiting_manager_confirmation,
                    "created_at": chat.created_at.isoformat(),
                    "updated_at": chat.updated_at.isoformat(),
                }
            }))
        
    except Exception as e:
        logger.error(f"Error processing Telegram message: {e}")

@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint"""
    return {
        "active_websocket_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5678)
