#!/usr/bin/env python3
"""
Migration script to add is_awaiting_manager_confirmation column to chats table
"""
import asyncio
import logging
from sqlalchemy import text
from crud import async_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    """Add is_awaiting_manager_confirmation column to chats table"""
    async with async_session() as session:
        try:
            # Check if column already exists
            result = await session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'chats' 
                AND column_name = 'is_awaiting_manager_confirmation'
            """))
            
            if result.fetchone():
                logger.info("Column is_awaiting_manager_confirmation already exists")
                return
            
            # Add the column
            await session.execute(text("""
                ALTER TABLE chats 
                ADD COLUMN is_awaiting_manager_confirmation BOOLEAN DEFAULT FALSE
            """))
            
            await session.commit()
            logger.info("Successfully added is_awaiting_manager_confirmation column to chats table")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            await session.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(migrate())
