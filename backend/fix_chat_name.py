#!/usr/bin/env python3
"""
Fix chat name to display properly
"""

import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# Add the parent directory to the path so we can import shared
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared import get_database_url

def extract_display_name(user_id: str) -> str:
    """Extract display name from user_id (e.g., 'Pavel 🐾' from 'Pavel 🐾 sifisonondo [5636526615]')"""
    if not user_id:
        return "Unknown"
    
    # Remove telegram ID in brackets first
    if " [" in user_id:
        name_part = user_id.split(" [")[0]
    else:
        name_part = user_id
    
    # Split into words
    parts = name_part.split()
    if not parts:
        return "Unknown"
    
    # Keep first word (name) and any parts with emojis/special characters
    display_parts = [parts[0]]  # Always include first part (the name)
    
    for part in parts[1:]:
        # Check if part contains emojis or special characters
        if any(ord(char) > 127 for char in part):  # Non-ASCII characters (emojis)
            display_parts.append(part)
        else:
            # Stop at first regular ASCII word (likely username)
            break
    
    return " ".join(display_parts)

async def fix_chat_names():
    """Fix chat names to display properly"""
    
    DATABASE_URL = get_database_url()
    engine = create_async_engine(DATABASE_URL, echo=True)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        try:
            print("Fixing chat names...")
            
            # Get all chats that need name fixing
            result = await session.execute(text("""
                SELECT id, user_id, name FROM chats WHERE user_id LIKE '%[%]%'
            """))
            
            chats = result.fetchall()
            
            for chat in chats:
                chat_id, user_id, current_name = chat
                new_name = extract_display_name(user_id)
                
                if new_name != current_name:
                    print(f"Updating chat {chat_id}: '{current_name}' -> '{new_name}'")
                    
                    await session.execute(text("""
                        UPDATE chats SET name = :new_name WHERE id = :chat_id
                    """), {"new_name": new_name, "chat_id": chat_id})
            
            await session.commit()
            print("✅ Successfully fixed chat names")
            
        except Exception as e:
            print(f"❌ Error fixing chat names: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_chat_names())
