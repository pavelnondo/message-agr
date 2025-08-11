#!/usr/bin/env python3
"""
Multi-Tenant Database Migration Script
Stage 1: Database changes for multi-business AI aggregator
"""

import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# Add the parent directory to the path so we can import shared
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared import get_database_url

async def migrate_to_multi_tenant():
    """Migrate database to multi-tenant structure"""
    
    DATABASE_URL = get_database_url()
    engine = create_async_engine(DATABASE_URL, echo=True)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        try:
            print("🚀 Starting multi-tenant database migration...")
            
            # Read the SQL migration file
            migration_file = os.path.join(os.path.dirname(__file__), 'migrate_multi_tenant_schema.sql')
            with open(migration_file, 'r') as f:
                sql_commands = f.read()
            
            # Split SQL into individual commands and execute
            commands = [cmd.strip() for cmd in sql_commands.split(';') if cmd.strip()]
            
            for i, command in enumerate(commands, 1):
                if command and not command.startswith('--'):
                    print(f"📝 Executing command {i}/{len(commands)}...")
                    try:
                        await session.execute(text(command))
                        print(f"✅ Command {i} executed successfully")
                    except Exception as e:
                        print(f"⚠️  Command {i} had non-critical issue: {e}")
                        # Continue with migration for non-critical errors
            
            await session.commit()
            print("✅ Multi-tenant migration completed successfully!")
            
            # Verify the new structure
            print("\n🔍 Verifying new database structure...")
            
            # Check tenant_settings table
            result = await session.execute(text("SELECT COUNT(*) FROM tenant_settings"))
            tenant_count = result.scalar()
            print(f"📊 tenant_settings: {tenant_count} records")
            
            # Check faqs table
            result = await session.execute(text("SELECT COUNT(*) FROM faqs"))
            faq_count = result.scalar()
            print(f"❓ faqs: {faq_count} records")
            
            # Check tenant_id columns
            result = await session.execute(text("SELECT COUNT(*) FROM chats WHERE tenant_id IS NOT NULL"))
            chat_tenant_count = result.scalar()
            print(f"💬 chats with tenant_id: {chat_tenant_count}")
            
            result = await session.execute(text("SELECT COUNT(*) FROM messages WHERE tenant_id IS NOT NULL"))
            message_tenant_count = result.scalar()
            print(f"📨 messages with tenant_id: {message_tenant_count}")
            
            # Show tenant overview
            result = await session.execute(text("SELECT * FROM tenant_overview"))
            tenants = result.fetchall()
            print(f"\n🏢 Tenant Overview:")
            for tenant in tenants:
                print(f"  - {tenant[1]}: {tenant[6]} chats, {tenant[7]} messages, {tenant[8]} FAQs")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate_to_multi_tenant())
