#!/usr/bin/env python3
"""
Migration script to add last_client_message_at field to chats table
"""

import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# Add the parent directory to the path so we can import shared
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.shared import get_database_url

async def add_last_client_message_at_field():
    """Add last_client_message_at column to chats table"""
    
    DATABASE_URL = get_database_url()
    engine = create_async_engine(DATABASE_URL, echo=True)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        try:
            print("Adding last_client_message_at column to chats table...")
            
            # Add the new column
            await session.execute(text("""
                ALTER TABLE chats 
                ADD COLUMN IF NOT EXISTS last_client_message_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
            """))
            
            await session.commit()
            print("✅ Successfully added last_client_message_at column")
            
            # Initialize the field with the latest client message timestamp for existing chats
            print("Initializing last_client_message_at for existing chats...")
            
            await session.execute(text("""
                UPDATE chats 
                SET last_client_message_at = (
                    SELECT MAX(m.created_at)
                    FROM messages m 
                    WHERE m.chat_id = chats.id 
                    AND m.message_type = 'question'
                )
                WHERE last_client_message_at IS NULL
            """))
            
            await session.commit()
            print("✅ Successfully initialized last_client_message_at for existing chats")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_last_client_message_at_field())
