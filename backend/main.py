import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text, select, func

from crud import (
    get_chats, get_chat, get_chat_by_user_id, create_chat, get_messages, 
    create_message, get_chats_with_last_messages, get_stats, delete_chat,
    get_bot_settings, get_bot_setting, update_bot_setting, update_chat_ai_status,
    Chat  # Import Chat model for auto-reactivation task
)
from shared import get_database_url
from auth import auth_handler, UserLogin, UserRegister, UserResponse, TokenResponse
from user_crud import (
    create_user, get_user_by_username, get_user_by_id, get_users_by_tenant,
    update_user, delete_user, get_all_tenants, create_tenant
)
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
    ai_enabled: Optional[bool] = None  # Frontend still uses ai_enabled

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
        self.active_connections: List[WebSocket] = []

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
                pass

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
    asyncio.create_task(auto_ai_reactivation_task())
    
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
            
            # Process the message (this includes forwarding to n8n with proper tenant_id)
            await process_telegram_message(message_data)
        
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
            chat.ai = chat_update.ai_enabled  # Map frontend ai_enabled to DB ai column
            chat.waiting = not chat_update.ai_enabled  # When AI is off, waiting for manager
        
        await db.commit()
        await db.refresh(chat)

        # Notify websocket listeners about chat updates
        await manager.broadcast(json.dumps({
            "type": "chat_update",
            "data": {
                "id": str(chat.id),
                "user_id": chat.user_id or chat.name,  # Use user_id if available, fallback to name
                "ai_enabled": chat.ai,  # Map DB ai column to frontend ai_enabled
                "is_awaiting_manager_confirmation": chat.is_awaiting_manager_confirmation,
                "created_at": chat.created_at.isoformat() if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
            }
        }))

        # Broadcast stats update when chat state changes
        await broadcast_stats_update(db)

        # Return the chat with proper field mapping for frontend
        return {
            "id": chat.id,
            "user_id": chat.user_id,
            "ai_enabled": chat.ai,  # Map DB ai column to frontend ai_enabled
            "is_awaiting_manager_confirmation": chat.is_awaiting_manager_confirmation,
            "created_at": chat.created_at.isoformat() if chat.created_at else None,
            "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
        }
    except Exception as e:
        logger.error(f"Error updating chat: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/chats/{chat_id}")
async def hide_chat_endpoint(chat_id: int, db: AsyncSession = Depends(get_db)):
    """Hide a chat from frontend (not delete from DB)"""
    try:
        # Get the chat to mark as hidden
        chat = await get_chat(db, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Mark chat as hidden instead of deleting
        chat.hidden = True
        await db.commit()
        await db.refresh(chat)
        
        # Broadcast chat deletion to all connected WebSocket clients
        await manager.broadcast(json.dumps({
            "type": "chat_deleted",
            "data": {
                "chat_id": str(chat_id)
            }
        }))
        
        return {"message": "Chat hidden successfully"}
    except Exception as e:
        logger.error(f"Error hiding chat: {e}")
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

        # Get chat info to determine Telegram chat_id and send manual messages to Telegram
        chat = await get_chat(db, chat_id)
        if chat and message.message_type == "answer":
            # This is a manual message from frontend (manager response)
            # Extract Telegram chat_id from user_id and send to Telegram
            telegram_chat_id = None
            if " [" in chat.user_id and chat.user_id.endswith("]"):
                try:
                    telegram_chat_id = int(chat.user_id.rsplit("[", 1)[1][:-1])
                    logger.info(f"Extracted Telegram chat_id {telegram_chat_id} from user_id {chat.user_id}")
                except Exception as e:
                    logger.warning(f"Could not extract chat_id from user_id: {e}")
            
            if telegram_chat_id:
                # Send manual message to Telegram
                telegram_success = await send_message_to_telegram(telegram_chat_id, message.message)
                if telegram_success:
                    logger.info(f"Manual message sent to Telegram chat {telegram_chat_id}")
                else:
                    logger.warning(f"Failed to send manual message to Telegram chat {telegram_chat_id}")
        
        return new_message
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/chats/{chat_id}/upload")
async def upload_file(
    chat_id: int, 
    file: UploadFile = File(...), 
    db: AsyncSession = Depends(get_db)
):
    """Upload a file to a chat (turns AI off, sends to Telegram)"""
    try:
        # Verify chat exists
        chat = await get_chat(db, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Check file size (10MB limit)
        if file.size and file.size > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File size too large")
        
        # Create uploads directory if it doesn't exist
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        import uuid
        file_extension = os.path.splitext(file.filename or "")[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Turn AI off for this chat (file uploads go to manager)
        chat.ai = False
        chat.waiting = True
        await db.commit()
        await db.refresh(chat)
        
        # Create message record for the file
        file_message = f"📎 File: {file.filename} ({file.size} bytes)" if file.size else f"📎 File: {file.filename}"
        new_message = await create_message(
            db, 
            chat_id, 
            file_message, 
            "answer"  # From manager/frontend
        )
        
        # Send file to Telegram if possible
        if chat.user_id and " [" in chat.user_id and chat.user_id.endswith("]"):
            try:
                telegram_chat_id = int(chat.user_id.rsplit("[", 1)[1][:-1])
                
                # Send file to Telegram
                telegram_success = await send_file_to_telegram(telegram_chat_id, file_path, file.filename or "file")
                if telegram_success:
                    logger.info(f"File sent to Telegram chat {telegram_chat_id}")
                else:
                    logger.warning(f"Failed to send file to Telegram chat {telegram_chat_id}")
            except Exception as e:
                logger.warning(f"Could not extract telegram chat_id or send file: {e}")
        
        # Broadcast chat update (AI turned off)
        await manager.broadcast(json.dumps({
            "type": "chat_update",
            "data": {
                "id": str(chat.id),
                "user_id": chat.user_id or chat.name,
                "ai_enabled": False,
                "is_awaiting_manager_confirmation": True,
                "created_at": chat.created_at.isoformat() if hasattr(chat, 'created_at') else None,
                "updated_at": chat.updated_at.isoformat() if hasattr(chat, 'updated_at') else None,
            }
        }))
        
        # Broadcast new message
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
        
        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "file_path": f"/api/files/{unique_filename}",
            "ai_disabled": True
        }
        
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/files/{filename}")
async def download_file(filename: str):
    """Download uploaded file"""
    file_path = os.path.join("uploads", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

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

async def broadcast_stats_update(db: AsyncSession):
    """Broadcast updated stats to all connected clients"""
    try:
        stats = await get_stats(db)
        await manager.broadcast(json.dumps({
            "type": "stats_update",
            "data": stats
        }))
        logger.info(f"Broadcasted stats update: {stats}")
    except Exception as e:
        logger.error(f"Error broadcasting stats: {e}")

@app.get("/api/ai-settings")
async def get_ai_settings():
    """Get AI settings from n8n webhook"""
    try:
        logger.info(f"=== AI SETTINGS GET REQUEST ===")
        logger.info(f"N8N_WEBHOOK_URL configured: {bool(N8N_WEBHOOK_URL)}")
        logger.info(f"N8N_WEBHOOK_URL value: {N8N_WEBHOOK_URL}")
        
        if not N8N_WEBHOOK_URL:
            logger.warning("N8N_WEBHOOK_URL not configured for AI settings")
            return {"system_message": "", "faqs": ""}
            
        logger.info(f"Attempting to fetch AI settings from N8N: {N8N_WEBHOOK_URL}")
        
        # Request current settings from n8n
        # Disable SSL verification for self-signed certificates
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as session:
            payload = {
                "action": "get_settings",
                "timestamp": datetime.utcnow().isoformat()
            }
            logger.info(f"N8N get payload: {payload}")
            
            try:
                async with session.post(N8N_WEBHOOK_URL, json=payload) as response:
                    logger.info(f"N8N response status: {response.status}")
                    
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"N8N settings data: {data}")
                        return {
                            "system_message": data.get("system_message", ""),
                            "faqs": data.get("faqs", "")
                        }
                    else:
                        response_text = await response.text()
                        logger.error(f"N8N settings fetch failed: {response.status} - {response_text}")
                        return {"system_message": "", "faqs": ""}
            except asyncio.TimeoutError:
                logger.error("Timeout while fetching from N8N webhook")
                return {"system_message": "", "faqs": ""}
                
    except Exception as e:
        logger.error(f"Error getting AI settings: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"system_message": "", "faqs": ""}

@app.post("/api/ai-settings")
async def save_ai_settings(settings: dict):
    """Save AI settings via n8n webhook"""
    try:
        logger.info(f"=== AI SETTINGS SAVE REQUEST ===")
        logger.info(f"Received settings: {settings}")
        logger.info(f"N8N_WEBHOOK_URL configured: {bool(N8N_WEBHOOK_URL)}")
        logger.info(f"N8N_WEBHOOK_URL value: {N8N_WEBHOOK_URL}")
        
        if not N8N_WEBHOOK_URL:
            logger.error("N8N_WEBHOOK_URL not configured for AI settings save")
            raise HTTPException(status_code=503, detail="N8n webhook not configured")
            
        logger.info(f"Attempting to save AI settings to N8N: {N8N_WEBHOOK_URL}")
        
        # Send settings to n8n
        # Disable SSL verification for self-signed certificates
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as session:
            payload = {
                "action": "save_settings",
                "system_message": settings.get("system_message", ""),
                "faqs": settings.get("faqs", ""),
                "timestamp": datetime.utcnow().isoformat()
            }
            logger.info(f"N8N save payload: {payload}")
            
            try:
                async with session.post(N8N_WEBHOOK_URL, json=payload) as response:
                    logger.info(f"N8N response status: {response.status}")
                    
                    if response.status == 200:
                        response_data = await response.json()
                        logger.info(f"N8N success response: {response_data}")
                        return {"message": "Settings saved successfully"}
                    else:
                        response_text = await response.text()
                        logger.error(f"N8N error response: {response.status} - {response_text}")
                        raise HTTPException(
                            status_code=500, 
                            detail=f"N8N webhook failed with status {response.status}: {response_text}"
                        )
            except asyncio.TimeoutError:
                logger.error("Timeout while connecting to N8N webhook")
                raise HTTPException(status_code=500, detail="N8N webhook timeout")
                
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except aiohttp.ClientError as e:
        logger.error(f"aiohttp ClientError saving AI settings: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Network error connecting to N8N: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error saving AI settings: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.post("/api/auth/register", response_model=TokenResponse)
async def register_user(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if tenant exists, create if it doesn't
        tenant_exists = await get_all_tenants(db)
        tenant_ids = [t["tenant_id"] for t in tenant_exists]
        
        if user_data.tenant_id not in tenant_ids:
            # Create new tenant with default settings
            tenant_created = await create_tenant(db, user_data.tenant_id)
            if not tenant_created:
                raise HTTPException(status_code=400, detail="Failed to create tenant")
        
        # Hash password and create user
        password_hash = auth_handler.hash_password(user_data.password)
        user = await create_user(db, user_data, password_hash)
        
        if not user:
            raise HTTPException(status_code=400, detail="Username or email already exists")
        
        # Create access token
        token_data = {
            "sub": str(user["id"]),
            "username": user["username"],
            "tenant_id": user["tenant_id"],
            "is_admin": user["is_admin"]
        }
        access_token = auth_handler.create_access_token(token_data)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(**user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/auth/login", response_model=TokenResponse)
async def login_user(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login user and return JWT token"""
    try:
        # Get user by username
        user = await get_user_by_username(db, user_data.username)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Verify password
        if not auth_handler.verify_password(user_data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create access token
        token_data = {
            "sub": str(user["id"]),
            "username": user["username"],
            "tenant_id": user["tenant_id"],
            "is_admin": user["is_admin"]
        }
        access_token = auth_handler.create_access_token(token_data)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(**user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging in user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(auth_handler.get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current user information"""
    try:
        user_id = int(current_user["sub"])
        user = await get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(**user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/auth/tenants")
async def get_available_tenants(db: AsyncSession = Depends(get_db)):
    """Get all available tenants"""
    try:
        tenants = await get_all_tenants(db)
        return {"tenants": tenants}
        
    except Exception as e:
        logger.error(f"Error getting tenants: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/auth/users/{tenant_id}")
async def get_tenant_users(tenant_id: str, current_user: dict = Depends(auth_handler.get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all users for a specific tenant (admin only)"""
    try:
        # Check if user is admin or belongs to the tenant
        if not current_user["is_admin"] and current_user["tenant_id"] != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        users = await get_users_by_tenant(db, tenant_id)
        return {"users": users}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tenant users: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/auth/users/{user_id}")
async def update_user_info(user_id: int, update_data: dict, current_user: dict = Depends(auth_handler.get_current_user), db: AsyncSession = Depends(get_db)):
    """Update user information (admin or self only)"""
    try:
        # Check if user is admin or updating their own profile
        if not current_user["is_admin"] and int(current_user["sub"]) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        user = await update_user(db, user_id, update_data)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(**user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/auth/users/{user_id}")
async def delete_user_endpoint(user_id: int, current_user: dict = Depends(auth_handler.get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete user (admin only)"""
    try:
        # Only admins can delete users
        if not current_user["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        success = await delete_user(db, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ============================================================================
# WEBSOCKET ENDPOINTS
# ============================================================================

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

async def send_file_to_telegram(chat_id: int, file_path: str, filename: str):
    """Send a file to Telegram"""
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN not configured, cannot send Telegram file")
        return False
    
    try:
        api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
        
        with open(file_path, 'rb') as file:
            file_content = file.read()
            
        data = aiohttp.FormData()
        data.add_field('chat_id', str(chat_id))
        data.add_field('document', file_content, filename=filename, content_type='application/octet-stream')
        
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, data=data) as resp:
                    if resp.status == 200:
                        logger.info(f"Sent file {filename} to Telegram")
                        return True
                    else:
                        body = await resp.text()
                        logger.error(f"Failed to send Telegram file: {resp.status} {body}")
                        return False
    except Exception as e:
        logger.error(f"Error sending Telegram file: {e}")
        return False

async def forward_to_n8n(message_data) -> bool:
    """Forward message to n8n webhook and handle response"""
    if not N8N_WEBHOOK_URL:
        logger.warning("N8N_WEBHOOK_URL not configured")
        return False
    
    logger.info(f"Attempting to forward message to N8N: {N8N_WEBHOOK_URL}")
    logger.info(f"Message data: {message_data}")
    
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            async with session.post(
                N8N_WEBHOOK_URL,
                json=message_data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                logger.info(f"N8N response status: {response.status}")
                
                if response.status == 200:
                    try:
                        response_data = await response.json()
                        logger.info(f"N8N response data: {response_data}")
                        
                        # Handle n8n response
                        await handle_n8n_response(message_data, response_data)
                        logger.info("Successfully processed N8N response")
                        return True
                    except Exception as e:
                        logger.error(f"Error parsing N8N response JSON: {e}")
                        response_text = await response.text()
                        logger.error(f"N8N response text: {response_text}")
                        return False
                else:
                    response_text = await response.text()
                    logger.error(f"Failed to forward message to N8N: {response.status}")
                    logger.error(f"N8N error response: {response_text}")
                    # Send fallback message to Telegram
                    await send_fallback_message(message_data)
                    return False
    except asyncio.TimeoutError:
        logger.error("Timeout while forwarding to N8N")
        await send_fallback_message(message_data)
        return False
    except Exception as e:
        logger.error(f"Error forwarding to N8N: {e}")
        import traceback
        logger.error(traceback.format_exc())
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
            # Use the full display id (includes Telegram chat id) for stable lookup
            user_id = original_message.get("user_id", "")
            
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
                        # Set AI off and waiting for manager
                        chat.ai = False
                        chat.waiting = True
                        await db.commit()
                        await db.refresh(chat)
                        
                        # Notify frontend about status change
                        await manager.broadcast(json.dumps({
                            "type": "chat_update",
                            "data": {
                                "id": str(chat.id),
                                "user_id": chat.user_id or chat.name,  # Use user_id if available, fallback to name
                                "ai_enabled": False,
                                "is_awaiting_manager_confirmation": True,  # Keep for frontend compatibility
                                "created_at": chat.created_at.isoformat(),
                                "updated_at": chat.updated_at.isoformat(),
                            }
                        }))
                        
                        # Broadcast stats update when manager handover occurs
                        await broadcast_stats_update(db)
                        
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
    
    # Start from offset 0 to get all pending messages
    offset = 0
    
    logger.info(f"Starting Telegram polling from offset: {offset}")
    
    while True:
        try:
            logger.info("Polling Telegram for updates...")
            
            # Fetch updates from Telegram
            url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
            params = {"offset": offset, "timeout": 10, "limit": 10}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if data.get("ok") and data.get("result"):
                            updates = data["result"]
                            logger.info(f"Received {len(updates)} updates from Telegram")
                            
                            for update in updates:
                                update_id = update.get("update_id")
                                message = update.get("message")
                                
                                logger.info(f"Processing update {update_id}")
                                
                                if message:
                                    # Extract message data with better validation
                                    from_user = message.get("from", {})
                                    chat_info = message.get("chat", {})
                                    
                                    # Build user display name
                                    first_name = from_user.get("first_name", "")
                                    username = from_user.get("username", "")
                                    user_id_num = from_user.get("id", "")
                                    chat_id = chat_info.get("id")
                                    
                                    display_parts = []
                                    if username:
                                        display_parts.append(username)
                                    elif first_name:
                                        display_parts.append(first_name)
                                    else:
                                        display_parts.append(str(user_id_num))
                                    
                                    user_display = f"{display_parts[0]} [{chat_id}]" if display_parts else f"User [{chat_id}]"
                                    
                                    message_data = {
                                        "message_id": message.get("message_id"),
                                        "user_id": user_display,
                                        "chat_id": chat_id,
                                        "text": message.get("text", ""),
                                        "date": message.get("date")
                                    }
                                    
                                    logger.info(f"Processing Telegram message: {message_data}")
                                    
                                    # Process the message (includes n8n forwarding if AI enabled)
                                    try:
                                        await process_telegram_message(message_data)
                                        logger.info(f"Successfully processed message from update {update_id}")
                                    except Exception as e:
                                        logger.error(f"Error processing message from update {update_id}: {e}")
                                        import traceback
                                        logger.error(traceback.format_exc())
                                
                                # Always update offset to mark this update as processed
                                offset = update_id + 1
                                logger.info(f"Updated offset to: {offset}")
                        else:
                            logger.info("No new updates from Telegram")
                    else:
                        logger.error(f"Telegram API error: {response.status}")
                        response_text = await response.text()
                        logger.error(f"Telegram API response: {response_text}")
                        await asyncio.sleep(30)  # Wait before retrying on error
                        
        except Exception as e:
            logger.error(f"Error in Telegram polling: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await asyncio.sleep(30)  # Wait before retrying on error
        
        # Add delay between polling attempts to avoid excessive API calls
        await asyncio.sleep(5)

async def auto_ai_reactivation_task():
    """Background task to automatically reactivate AI after 10 minutes of client silence"""
    logger.info("Starting auto AI reactivation task...")
    
    while True:
        try:
            async with AsyncSessionLocal() as db:
                # Find chats that are waiting for manager but haven't had client messages for 10+ minutes
                ten_minutes_ago = datetime.utcnow() - timedelta(minutes=10)
                
                result = await db.execute(
                    select(Chat).filter(
                        Chat.waiting == True,
                        Chat.ai == False,
                        Chat.last_client_message_at.isnot(None),
                        Chat.last_client_message_at < ten_minutes_ago
                    )
                )
                chats_to_reactivate = result.scalars().all()
                
                for chat in chats_to_reactivate:
                    logger.info(f"Auto-reactivating AI for chat {chat.id} after 10 minutes of silence")
                    
                    # Turn AI back on
                    chat.ai = True
                    chat.waiting = False
                    await db.commit()
                    await db.refresh(chat)
                    
                    # Broadcast status change to frontend
                    await manager.broadcast(json.dumps({
                        "type": "chat_update",
                        "data": {
                            "id": str(chat.id),
                            "user_id": chat.user_id or chat.name,
                            "ai_enabled": True,
                            "is_awaiting_manager_confirmation": False,
                            "created_at": chat.created_at.isoformat() if hasattr(chat, 'created_at') and chat.created_at else None,
                            "updated_at": chat.updated_at.isoformat() if hasattr(chat, 'updated_at') and chat.updated_at else None,
                        }
                    }))
                    
                    # AI reactivated silently - no message sent to client
                
                if chats_to_reactivate:
                    logger.info(f"Auto-reactivated AI for {len(chats_to_reactivate)} chats")
                    # Broadcast stats update after auto-reactivation
                    await broadcast_stats_update(db)
                    
        except Exception as e:
            logger.error(f"Error in auto AI reactivation task: {e}")
            import traceback
            logger.error(traceback.format_exc())
        
        # Check every 2 minutes for chats to reactivate
        await asyncio.sleep(120)

async def process_telegram_message(message_data: dict):
    """Process incoming Telegram message"""
    try:
        logger.info(f"Processing Telegram message: {message_data}")
        
        # Check if this is a file/photo message
        has_file = message_data.get("photo") or message_data.get("document") or message_data.get("video") or message_data.get("audio")
        
        # Validate message data - must have text OR file
        if not message_data.get("text") and not has_file:
            logger.warning("Received message with no text or file, skipping")
            return
            
        # Use the full display id (includes Telegram chat id) for stable lookup
        user_id = message_data.get("user_id", "")
        if not user_id:
            logger.error("No user_id in message data, skipping")
            return
        
        logger.info(f"Processing message from user: {user_id}")
        
        # Create or get chat for this user
        async with AsyncSessionLocal() as db:
            try:
                chat = await get_chat_by_user_id(db, user_id)
                if not chat:
                    logger.info(f"Creating new chat for user: {user_id}")
                    chat = await create_chat(db, user_id)
                else:
                    logger.info(f"Found existing chat {chat.id} for user: {user_id}")
                
                # Create message record
                logger.info(f"Saving message to database for chat {chat.id}")
                
                # Determine message content and if AI should be disabled
                if has_file:
                    # For files/photos, turn off AI and set waiting for manager
                    chat.ai = False
                    chat.waiting = True
                    await db.commit()
                    await db.refresh(chat)
                    
                    # Create file message
                    if message_data.get("photo"):
                        message_text = f"📷 Photo received" + (f": {message_data['text']}" if message_data.get("text") else "")
                    elif message_data.get("document"):
                        doc_name = message_data["document"].get("file_name", "document")
                        message_text = f"📎 Document received: {doc_name}" + (f"\n{message_data['text']}" if message_data.get("text") else "")
                    elif message_data.get("video"):
                        message_text = f"🎥 Video received" + (f": {message_data['text']}" if message_data.get("text") else "")
                    elif message_data.get("audio"):
                        message_text = f"🎵 Audio received" + (f": {message_data['text']}" if message_data.get("text") else "")
                    else:
                        message_text = f"📎 File received" + (f": {message_data['text']}" if message_data.get("text") else "")
                    
                    logger.info(f"File message received, AI disabled for chat {chat.id}")
                else:
                    message_text = message_data["text"]
                
                created = await create_message(
                    db, 
                    chat.id, 
                    message_text, 
                    "question"
                )
                
                # Update last client message timestamp for auto AI reactivation
                chat.last_client_message_at = func.now()
                
                # Unhide chat if it was hidden (restore to frontend when client messages back)
                if chat.hidden:
                    chat.hidden = False
                
                await db.commit()
                await db.refresh(chat)
                
                logger.info(f"Message saved with ID: {created.id}")

                # Notify websocket listeners about new message
                try:
                    await manager.broadcast(json.dumps({
                        "type": "new_message",
                        "data": {
                            "id": str(created.id),
                            "chat_id": str(chat.id),
                            "message": message_text,
                            "message_type": "question",
                            "created_at": created.created_at.isoformat() if created.created_at else datetime.utcnow().isoformat(),
                            "user_id": user_id
                        }
                    }))
                    logger.info(f"Broadcasted new message notification for chat {chat.id}")
                except Exception as e:
                    logger.error(f"Error broadcasting new message: {e}")

                # Notify websocket listeners about chat updates
                try:
                    await manager.broadcast(json.dumps({
                        "type": "chat_update",
                        "data": {
                            "id": str(chat.id),
                            "user_id": chat.user_id or chat.name,  # Use user_id if available, fallback to name
                            "ai_enabled": chat.ai,  # Map DB ai column to frontend ai_enabled
                            "is_awaiting_manager_confirmation": chat.is_awaiting_manager_confirmation,
                            "created_at": chat.created_at.isoformat(),
                            "updated_at": chat.updated_at.isoformat(),
                        }
                    }))
                    logger.info(f"Broadcasted chat update notification for chat {chat.id}")
                except Exception as e:
                    logger.error(f"Error broadcasting chat update: {e}")

                # Broadcast stats update (new message increases message count, may change AI status)
                try:
                    await broadcast_stats_update(db)
                except Exception as e:
                    logger.error(f"Error broadcasting stats update: {e}")

                # Forward to n8n only if AI is enabled and not waiting for manager
                if N8N_WEBHOOK_URL and chat.ai and not chat.waiting:
                    logger.info(f"Forwarding message to N8N for chat {chat.id}")
                    # Prefer Telegram chat id when available; else try to parse from display id
                    telegram_chat_id = message_data.get("chat_id")
                    if telegram_chat_id is None:
                        disp = message_data.get("user_id", "")
                        if " [" in disp and disp.endswith("]"):
                            try:
                                telegram_chat_id = int(disp.rsplit("[", 1)[1][:-1])
                                logger.info(f"Extracted Telegram chat_id {telegram_chat_id} from user_id")
                            except Exception as e:
                                logger.warning(f"Could not extract chat_id from user_id: {e}")
                                telegram_chat_id = None
                    
                    try:
                        # Get the current user's tenant_id from the database
                        # For now, we'll use a default tenant_id since this is called from Telegram webhook
                        # In a real implementation, you'd need to map Telegram users to tenant_ids
                        current_tenant_id = "default"  # Default tenant for Telegram messages
                        
                        n8n_success = await forward_to_n8n({
                            "chat_id": telegram_chat_id,
                            "user_id": message_data.get("user_id"),
                            "text": message_data.get("text", ""),
                            "message_type": "question",
                            "timestamp": datetime.utcnow().isoformat(),
                            "tenant_id": current_tenant_id  # Use current user's tenant_id
                        })
                        
                        if n8n_success:
                            logger.info("Message successfully forwarded to N8N")
                        else:
                            logger.warning("Failed to forward message to N8N")
                    except Exception as e:
                        logger.error(f"Error forwarding to N8N: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                else:
                    logger.info(f"Not forwarding to N8N - AI enabled: {chat.ai}, Waiting for manager: {chat.waiting}")
                    
            except Exception as e:
                logger.error(f"Error in database operations: {e}")
                import traceback
                logger.error(traceback.format_exc())
                raise  # Re-raise to be caught by outer exception handler
        
    except Exception as e:
        logger.error(f"Error processing Telegram message: {e}")
        import traceback
        logger.error(traceback.format_exc())

@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint"""
    return {
        "active_websocket_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
