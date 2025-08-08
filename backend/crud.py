import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, selectinload
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func, select, desc, ARRAY, and_, delete, text
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional, Dict, Any
from uuid import UUID

from shared import get_database_url
from cache import cache_service
import logging

# Database configuration
DATABASE_URL = get_database_url()

# SQLAlchemy engine and session
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

# Models
class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, nullable=False)
    ai = Column(Boolean, default=False)
    waiting = Column(Boolean, default=False)
    tags = Column(ARRAY(String), default=[])
    name = Column(String(30), default="Не известно")
    messager = Column(String(16), nullable=False, default="telegram")
    messages = relationship("Message", back_populates="chat")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    message = Column(String, nullable=False)
    message_type = Column(String, nullable=False)
    ai = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_image = Column(Boolean, default=False)
    # New: track whether message was sent by operator (manager) from the UI
    from_operator = Column(Boolean, default=False)
    chat = relationship("Chat", back_populates="messages")


# CRUD operations
async def get_chats(db: AsyncSession) -> List[Dict[str, Any]]:
    """Get all chats with caching"""
    # Try cache first
    cached_chats = await cache_service.get("chats:all")
    if cached_chats:
        logging.info("Retrieved chats from cache")
        return cached_chats
    
    # Query database
    result = await db.execute(select(Chat))
    chats = result.scalars().all()
    
    # Convert to dict format
    chat_list = []
    for chat in chats:
        chat_dict = {
            "id": str(chat.id),
            "uuid": chat.uuid,
            "name": chat.name,
            "is_ai": chat.ai,
            "tags": chat.tags,
            "messager": chat.messager,
            "created_at": chat.created_at.isoformat(),
            "updated_at": chat.updated_at.isoformat()
        }
        chat_list.append(chat_dict)
    
    # Cache the result
    await cache_service.set("chats:all", chat_list, ttl=300)  # 5 minutes
    
    logging.info(f"Retrieved {len(chat_list)} chats from database")
    return chat_list

async def get_chat(db: AsyncSession, chat_id: int):
    result = await db.execute(select(Chat).filter(Chat.id == chat_id))
    return result.scalar_one_or_none()

async def get_chat_by_uuid(db: AsyncSession, uuid: str):
    result = await db.execute(select(Chat).filter(Chat.uuid == uuid))
    return result.scalar_one_or_none()

async def get_messages(db: AsyncSession, chat_id: UUID) -> List[Dict[str, Any]]:
    """Get messages for a chat with caching"""
    cache_key = f"messages:{chat_id}"
    
    # Try cache first
    cached_messages = await cache_service.get(cache_key)
    if cached_messages:
        logging.info(f"Retrieved messages for chat {chat_id} from cache")
        return cached_messages
    
    # Query database
    result = await db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    
    # Convert to dict format
    message_list = []
    for message in messages:
        message_dict = {
            "id": str(message.id),
            "chat_id": str(message.chat_id),
            "message": message.message,
            "message_type": message.message_type,
            "ai": message.ai,
            "created_at": message.created_at.isoformat()
        }
        message_list.append(message_dict)
    
    # Cache the result
    await cache_service.set(cache_key, message_list, ttl=900)  # 15 minutes
    
    logging.info(f"Retrieved {len(message_list)} messages for chat {chat_id} from database")
    return message_list

async def create_chat(db: AsyncSession, uuid: str, ai: bool = True, name: str = "Не известно", tags: List[str] = None, messager: str = "telegram"):
    """Create a new chat and invalidate cache"""
    new_chat = Chat(
        uuid=uuid,
        ai=ai,
        name=name,
        tags=tags or [],
        messager=messager
    )
    db.add(new_chat)
    try:
        await db.commit()
        await db.refresh(new_chat)
        
        # Invalidate cache
        await cache_service.delete("chats:all")
        
        logging.info(f"Created chat {new_chat.id} with uuid {uuid}")
        return new_chat
    except SQLAlchemyError:
        await db.rollback()
        raise

async def create_message(db: AsyncSession, chat_id: UUID, message: str, message_type: str, ai: bool = False, from_operator: bool = False):
    """Create a new message and invalidate cache"""
    new_message = Message(
        chat_id=chat_id,
        message=message,
        message_type=message_type,
        ai=ai,
        from_operator=from_operator,
    )
    db.add(new_message)
    try:
        await db.commit()
        await db.refresh(new_message)
        
        # Invalidate related caches
        await cache_service.invalidate_chat_cache(str(chat_id))
        await cache_service.delete("stats:global")
        
        logging.info(f"Created message {new_message.id} for chat {chat_id}")
        return new_message
    except SQLAlchemyError:
        await db.rollback()
        raise

async def update_chat_waiting(db: AsyncSession, chat_id: int, waiting: bool):
    chat = await get_chat(db, chat_id)
    if chat:
        chat.waiting = waiting
        await db.commit()
        await db.refresh(chat)
    return chat

async def update_chat_ai(db: AsyncSession, chat_id: int, ai: bool):
    chat = await get_chat(db, chat_id)
    if chat:
        chat.ai = ai
        await db.commit()
        await db.refresh(chat)
    return chat

async def get_stats(db: AsyncSession) -> Dict[str, int]:
    """Get statistics with caching"""
    # Try cache first
    cached_stats = await cache_service.get("stats:global")
    if cached_stats:
        logging.info("Retrieved stats from cache")
        return cached_stats
    
    # Query database
    total_result = await db.execute(select(func.count(Chat.id)))
    total = total_result.scalar()
    
    ai_result = await db.execute(select(func.count(Chat.id)).filter(Chat.ai == True))
    ai_count = ai_result.scalar()
    
    pending_result = await db.execute(
        select(func.count(Chat.id)).filter(
            and_(Chat.waiting == True)
        )
    )
    pending = pending_result.scalar()
    
    stats = {
        "total": total,
        "ai": ai_count,
        "pending": pending
    }
    
    # Cache the result
    await cache_service.set("stats:global", stats, ttl=300)  # 5 minutes
    
    logging.info(f"Retrieved stats: {stats}")
    return stats

async def get_chats_with_last_messages(db: AsyncSession, limit: int = 20) -> List[Dict[str, Any]]:
    """Get all chats with their last message"""
    # First get all chats
    query = select(Chat).order_by(desc(Chat.id))
    if limit:
        query = query.limit(limit)
    result = await db.execute(query)
    chats = result.scalars().all()
    
    chats_with_messages = []
    for chat in chats:
        # Get only the last message for each chat
        last_message_query = (
            select(Message)
            .where(Message.chat_id == chat.id)
            .order_by(desc(Message.id))
            .limit(1)
        )
        last_message_result = await db.execute(last_message_query)
        last_message = last_message_result.scalar_one_or_none()
        
        chat_dict = {
            "id": str(chat.id),  # Convert to string as frontend expects
            "name": chat.name,
            "lastMessage": last_message.message if last_message else "",
            "timestamp": last_message.created_at if last_message else chat.created_at,
            "tags": chat.tags or [],
            "unreadCount": 0,  # TODO: Implement unread count
            "waitingForResponse": chat.waiting,
            "aiEnabled": chat.ai
        }
        
        chats_with_messages.append(chat_dict)
    
    return chats_with_messages

async def get_chat_messages(db: AsyncSession, chat_id: int) -> List[Dict[str, Any]]:
    """Get all messages for a specific chat"""
    # Remove pagination: page and limit
    query = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at) # Oldest first for proper chat flow
        # Removed: .limit(limit)
        # Removed: .offset(offset)
    )
    
    result = await db.execute(query);
    messages = result.scalars().all();
    
    # Prepare messages in the format expected by the frontend
    result: List[Dict[str, Any]] = []
    for msg in messages:
        if msg.ai:
            sender = "ai"
        else:
            sender = "operator" if getattr(msg, "from_operator", False) else "client"
        result.append({
            "id": msg.id,
            "content": msg.message,
            "message_type": msg.message_type,
            "ai": msg.ai,
            "sender": sender,
            "timestamp": msg.created_at.isoformat() if msg.created_at else None,
            "chatId": str(chat_id),
            "is_image": msg.is_image,
        })
    return result

async def add_chat_tag(db: AsyncSession, chat_id: int, tag: str) -> dict:
    chat = await get_chat(db, chat_id)
    if not chat:
        return {"message": "error"}
    
    try:
        # Инициализируем tags как пустой список, если None
        if chat.tags is None:
            chat.tags = []
        
        # Добавляем тег, если его еще нет
        if tag not in chat.tags:
            chat.tags = chat.tags + [tag]  # Создаем новый список для ARRAY
        
        await db.commit()
        await db.refresh(chat)
        return {"success": True, "tags": chat.tags}
    except Exception as e:
        await db.rollback()
        return {"message": "error"}

async def remove_chat_tag(db: AsyncSession, chat_id: int, tag: str) -> dict:
    chat = await get_chat(db, chat_id)
    if not chat:
        return {"message": "error"}
    
    try:
        # Инициализируем tags как пустой список, если None
        if chat.tags is None:
            chat.tags = []
        
        # Удаляем тег, если он есть
        if tag in chat.tags:
            chat.tags = [t for t in chat.tags if t != tag]  # Создаем новый список без тега
        
        await db.commit()
        await db.refresh(chat)
        return {"success": True, "tags": chat.tags}
    except Exception as e:
        await db.rollback()
        return {"message": "error"}

async def delete_chat(db: AsyncSession, chat_id: int) -> bool:
    """Delete a chat and all its messages"""
    try:
        # Get the chat
        chat = await get_chat(db, chat_id)
        if not chat:
            return False
        
        # Use raw SQL to delete messages first
        await db.execute(text(f"DELETE FROM messages WHERE chat_id = {chat_id}"))
        
        # Delete the chat
        await db.delete(chat)
        await db.commit()
        
        # Invalidate cache
        try:
            await cache_service.delete("chats:all")
            await cache_service.delete("stats:global")
        except:
            pass  # Cache might not be available
        
        logging.info(f"Deleted chat {chat_id}")
        return True
    except Exception as e:
        await db.rollback()
        logging.error(f"Error deleting chat {chat_id}: {e}")
        return False