#!/usr/bin/env python3
"""
Test script to verify Telegram polling logic locally
"""
import asyncio
import aiohttp
import os
from datetime import datetime

# Test configuration
BOT_TOKEN = "7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I"

async def test_telegram_polling():
    """Test the improved Telegram polling logic"""
    print("🧪 Testing Telegram Polling Logic")
    print("=" * 50)
    
    if not BOT_TOKEN:
        print("❌ BOT_TOKEN not configured")
        return
    
    # Start from offset 0 to get all pending messages
    offset = 0
    
    print(f"📡 Starting polling from offset: {offset}")
    
    try:
        # Fetch updates from Telegram
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
        params = {"offset": offset, "timeout": 10, "limit": 10}
        
        async with aiohttp.ClientSession() as session:
            print(f"🌐 Making request to: {url}")
            print(f"📋 Parameters: {params}")
            
            async with session.get(url, params=params) as response:
                print(f"📊 Response status: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get("ok") and data.get("result"):
                        updates = data["result"]
                        print(f"✅ Received {len(updates)} updates from Telegram")
                        
                        for i, update in enumerate(updates, 1):
                            update_id = update.get("update_id")
                            message = update.get("message")
                            
                            print(f"\n📨 Update {i}:")
                            print(f"   ID: {update_id}")
                            
                            if message:
                                # Extract message data
                                message_data = {
                                    "message_id": message.get("message_id"),
                                    "user_id": f"{message['from'].get('first_name', '')} {message['from'].get('username', '')} [{message['from'].get('id', '')}]",
                                    "chat_id": message.get("chat", {}).get("id"),
                                    "text": message.get("text", ""),
                                    "date": message.get("date")
                                }
                                
                                print(f"   📱 Message: {message_data}")
                                
                                # Simulate processing
                                print(f"   ✅ Would process message: '{message_data['text'][:50]}...'")
                            else:
                                print(f"   ⚠️  No message content in update")
                            
                            # Update offset
                            new_offset = update_id + 1
                            print(f"   📈 Would update offset to: {new_offset}")
                    else:
                        print("ℹ️  No new updates from Telegram")
                        print(f"   Response: {data}")
                else:
                    print(f"❌ Telegram API error: {response.status}")
                    text = await response.text()
                    print(f"   Error details: {text}")
                    
    except Exception as e:
        print(f"💥 Error in polling test: {e}")
        import traceback
        traceback.print_exc()

async def test_bot_info():
    """Test bot configuration"""
    print("\n🤖 Testing Bot Configuration")
    print("=" * 50)
    
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/getMe"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("ok"):
                        bot_info = data["result"]
                        print(f"✅ Bot is working!")
                        print(f"   Username: @{bot_info.get('username')}")
                        print(f"   Name: {bot_info.get('first_name')}")
                        print(f"   ID: {bot_info.get('id')}")
                    else:
                        print(f"❌ Bot API returned error: {data}")
                else:
                    print(f"❌ HTTP error: {response.status}")
                    
    except Exception as e:
        print(f"💥 Error testing bot: {e}")

async def main():
    """Run all tests"""
    await test_bot_info()
    await test_telegram_polling()
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")
    print("\n💡 If you see updates above, the polling logic should work!")
    print("💡 If no updates, send a message to the bot and run again.")

if __name__ == "__main__":
    asyncio.run(main())
