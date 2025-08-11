#!/usr/bin/env python3
"""
Migration script to add hidden field to chats table
"""

import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# Add the parent directory to the path so we can import shared
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared import get_database_url

async def add_hidden_field():
    """Add hidden column to chats table"""
    
    DATABASE_URL = get_database_url()
    engine = create_async_engine(DATABASE_URL, echo=True)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        try:
            print("Adding hidden column to chats table...")
            
            # Add the new column
            await session.execute(text("""
                ALTER TABLE chats 
                ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE
            """))
            
            await session.commit()
            print("✅ Successfully added hidden column")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_hidden_field())
