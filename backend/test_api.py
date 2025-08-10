#!/usr/bin/env python3
"""
Simple test script to verify the API endpoints work correctly.
Run this after starting the backend to test the API.
"""

import asyncio
import aiohttp
import json

async def test_api():
    """Test the main API endpoints"""
    base_url = "http://localhost:3001"
    
    async with aiohttp.ClientSession() as session:
        print("Testing API endpoints...")
        
        # Test health check
        try:
            async with session.get(f"{base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Health check: {data}")
                else:
                    print(f"❌ Health check failed: {response.status}")
        except Exception as e:
            print(f"❌ Health check error: {e}")
        
        # Test get chats
        try:
            async with session.get(f"{base_url}/api/chats") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Get chats: {len(data)} chats found")
                else:
                    print(f"❌ Get chats failed: {response.status}")
        except Exception as e:
            print(f"❌ Get chats error: {e}")
        
        # Test get stats
        try:
            async with session.get(f"{base_url}/api/stats") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Get stats: {data}")
                else:
                    print(f"❌ Get stats failed: {response.status}")
        except Exception as e:
            print(f"❌ Get stats error: {e}")
        
        # Test create a demo chat
        try:
            demo_chat = {
                "uuid": "test-uuid-123",
                "ai": True,
                "name": "Test Chat",
                "tags": ["test", "demo"],
                "messager": "telegram"
            }
            async with session.post(f"{base_url}/api/chats", json=demo_chat) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Create chat: {data}")
                    
                    # Test get messages for this chat
                    chat_id = data["id"]
                    async with session.get(f"{base_url}/api/chats/{chat_id}/messages") as msg_response:
                        if msg_response.status == 200:
                            messages = await msg_response.json()
                            print(f"✅ Get messages: {len(messages)} messages")
                        else:
                            print(f"❌ Get messages failed: {msg_response.status}")
                else:
                    print(f"❌ Create chat failed: {response.status}")
        except Exception as e:
            print(f"❌ Create chat error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api()) 