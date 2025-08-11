#!/usr/bin/env python3
"""
Migration to add session_id column to chats table for device separation
"""

import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from shared import get_database_url

async def migrate():
    """Add session_id column to chats table"""
    engine = create_async_engine(get_database_url())
    
    async with engine.begin() as conn:
        # Check if session_id column already exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'chats' AND column_name = 'session_id'
        """))
        
        if result.fetchone():
            print("session_id column already exists, skipping migration")
            return
        
        # Add session_id column
        await conn.execute(text("""
            ALTER TABLE chats 
            ADD COLUMN session_id VARCHAR(100)
        """))
        
        print("Successfully added session_id column to chats table")

if __name__ == "__main__":
    asyncio.run(migrate())
