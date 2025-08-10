import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, selectinload
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func, select, desc, ARRAY, and_, delete, text, BigInteger, Text
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

# Models for n8n workflow
class BotSettings(Base):
    __tablename__ = "bot_settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Chat(Base):
    __tablename__ = "chats"
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(String(100))
    is_awaiting_manager_confirmation = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    messages = relationship("Message", back_populates="chat")

class Message(Base):
    __tablename__ = "messages"
    id = Column(BigInteger, primary_key=True, index=True)
<<<<<<< HEAD
    # Ensure referential integrity and cascading deletes when a chat is removed
    chat_id = Column(
        BigInteger,
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
    )
=======
    chat_id = Column(BigInteger, ForeignKey("chats.id"), nullable=False)
>>>>>>> 8228d43febea50de8fcd7a5522ebf1a2919278d9
    message = Column(Text, nullable=False)
    message_type = Column(String(10), nullable=False)  # 'question' or 'answer'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    chat = relationship("Chat", back_populates="messages")

# CRUD operations for bot_settings
async def get_bot_settings(db: AsyncSession) -> Dict[str, str]:
    """Get all bot settings"""
    result = await db.execute(select(BotSettings))
    settings = result.scalars().all()
    
    settings_dict = {}
    for setting in settings:
        settings_dict[setting.key] = setting.value
    
    return settings_dict

async def get_bot_setting(db: AsyncSession, key: str) -> Optional[str]:
    """Get a specific bot setting"""
    result = await db.execute(select(BotSettings).filter(BotSettings.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting else None

async def update_bot_setting(db: AsyncSession, key: str, value: str):
    """Update or create a bot setting"""
    result = await db.execute(select(BotSettings).filter(BotSettings.key == key))
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = value
    else:
        setting = BotSettings(key=key, value=value)
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    return setting

# CRUD operations for chats
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
            "user_id": chat.user_id,
            "is_awaiting_manager_confirmation": chat.is_awaiting_manager_confirmation,
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

async def get_chat_by_user_id(db: AsyncSession, user_id: str):
    result = await db.execute(select(Chat).filter(Chat.user_id == user_id))
    return result.scalar_one_or_none()

async def create_chat(db: AsyncSession, user_id: str):
    """Create a new chat"""
    chat = Chat(user_id=user_id)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    
    # Clear cache
    await cache_service.delete("chats:all")
    
    return chat

async def update_chat_manager_confirmation(db: AsyncSession, chat_id: int, is_awaiting: bool):
    """Update chat manager confirmation status"""
    result = await db.execute(select(Chat).filter(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    
    if chat:
        chat.is_awaiting_manager_confirmation = is_awaiting
        await db.commit()
        await db.refresh(chat)
        
        # Clear cache
        await cache_service.delete("chats:all")
        
        return chat
    return None

# CRUD operations for messages
async def get_messages(db: AsyncSession, chat_id: int) -> List[Dict[str, Any]]:
    """Get messages for a chat with caching"""
    cache_key = f"messages:{chat_id}"
    
    # Try cache first
    cached_messages = await cache_service.get(cache_key)
    if cached_messages:
        logging.info(f"Retrieved messages for chat {chat_id} from cache")
        return cached_messages
    
    # Query database
    result = await db.execute(
        select(Message)
        .filter(Message.chat_id == chat_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    
    # Convert to dict format
    message_list = []
    for message in messages:
<<<<<<< HEAD
        normalized_type = 'answer' if message.message_type == 'answer' else 'question'
=======
>>>>>>> 8228d43febea50de8fcd7a5522ebf1a2919278d9
        message_dict = {
            "id": str(message.id),
            "chat_id": str(message.chat_id),
            "message": message.message,
<<<<<<< HEAD
            "message_type": normalized_type,
=======
            "message_type": message.message_type,
>>>>>>> 8228d43febea50de8fcd7a5522ebf1a2919278d9
            "created_at": message.created_at.isoformat()
        }
        message_list.append(message_dict)
    
    # Cache the result
    await cache_service.set(cache_key, message_list, ttl=300)  # 5 minutes
    
    logging.info(f"Retrieved {len(message_list)} messages for chat {chat_id} from database")
    return message_list

async def create_message(db: AsyncSession, chat_id: int, message: str, message_type: str):
    """Create a new message"""
    if message_type not in ['question', 'answer']:
        raise ValueError("message_type must be 'question' or 'answer'")
    
    message_obj = Message(
        chat_id=chat_id,
        message=message,
        # Normalize to the allowed set 'question' | 'answer'
        message_type='answer' if message_type == 'answer' else 'question'
    )
    db.add(message_obj)
    await db.commit()
    await db.refresh(message_obj)
    
    # Clear cache
    await cache_service.delete(f"messages:{chat_id}")
    
    return message_obj

async def get_chat_messages(db: AsyncSession, chat_id: int) -> List[Dict[str, Any]]:
    """Get all messages for a specific chat"""
    return await get_messages(db, chat_id)

async def get_chats_with_last_messages(db: AsyncSession, limit: int = 20) -> List[Dict[str, Any]]:
<<<<<<< HEAD
    """Get chats with their last message and total message count per chat"""
    query = text(
        """
        SELECT
          c.id,
          c.user_id,
          c.is_awaiting_manager_confirmation,
          c.created_at,
          c.updated_at,
          lm.id AS message_id,
          lm.message,
          lm.message_type,
          lm.created_at AS message_created_at,
          (SELECT COUNT(*) FROM messages m2 WHERE m2.chat_id = c.id) AS message_count
        FROM chats c
        LEFT JOIN LATERAL (
          SELECT m.*
          FROM messages m
          WHERE m.chat_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) lm ON true
        ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
        LIMIT :limit
        """
    )

    result = await db.execute(query, {"limit": limit})
    rows = result.fetchall()

    chat_list: List[Dict[str, Any]] = []
    for row in rows:
        last_type = row[7] if row[7] == "answer" else ("question" if row[5] else None)
        chat_dict: Dict[str, Any] = {
=======
    """Get chats with their last message"""
    # This is a complex query that gets the last message for each chat
    query = text("""
        SELECT DISTINCT ON (c.id) 
            c.id, c.user_id, c.is_awaiting_manager_confirmation, 
            c.created_at, c.updated_at,
            m.id as message_id, m.message, m.message_type, m.created_at as message_created_at
        FROM chats c
        LEFT JOIN messages m ON c.id = m.chat_id
        ORDER BY c.id, m.created_at DESC
        LIMIT :limit
    """)
    
    result = await db.execute(query, {"limit": limit})
    rows = result.fetchall()
    
    chat_list = []
    for row in rows:
        chat_dict = {
>>>>>>> 8228d43febea50de8fcd7a5522ebf1a2919278d9
            "id": str(row[0]),
            "user_id": row[1],
            "is_awaiting_manager_confirmation": row[2],
            "created_at": row[3].isoformat() if row[3] else None,
            "updated_at": row[4].isoformat() if row[4] else None,
<<<<<<< HEAD
            "message_count": int(row[9] or 0),
            "last_message": (
                {
                    "id": str(row[5]) if row[5] else None,
                    "message": row[6] if row[6] else None,
                    "message_type": last_type,
                    "created_at": row[8].isoformat() if row[8] else None,
                }
                if row[5]
                else None
            ),
        }
        chat_list.append(chat_dict)

=======
            "last_message": {
                "id": str(row[5]) if row[5] else None,
                "message": row[6] if row[6] else None,
                "message_type": row[7] if row[7] else None,
                "created_at": row[8].isoformat() if row[8] else None
            } if row[5] else None
        }
        chat_list.append(chat_dict)
    
>>>>>>> 8228d43febea50de8fcd7a5522ebf1a2919278d9
    return chat_list

async def get_stats(db: AsyncSession) -> Dict[str, int]:
    """Get chat and message statistics"""
    # Count total chats
    chat_count_result = await db.execute(select(func.count(Chat.id)))
    total_chats = chat_count_result.scalar()
    
    # Count total messages
    message_count_result = await db.execute(select(func.count(Message.id)))
    total_messages = message_count_result.scalar()
    
    # Count chats awaiting manager confirmation
    awaiting_count_result = await db.execute(
        select(func.count(Chat.id)).filter(Chat.is_awaiting_manager_confirmation == True)
    )
    awaiting_manager = awaiting_count_result.scalar()
    
    return {
        "total_chats": total_chats,
        "total_messages": total_messages,
        "awaiting_manager_confirmation": awaiting_manager
    }

async def delete_chat(db: AsyncSession, chat_id: int) -> bool:
    """Delete a chat and all its messages"""
    result = await db.execute(select(Chat).filter(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    
    if chat:
        await db.delete(chat)
        await db.commit()
        
        # Clear cache
        await cache_service.delete("chats:all")
        await cache_service.delete(f"messages:{chat_id}")
        
        return True
    return False