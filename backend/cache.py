import json
import asyncio
from typing import Optional, Any, List, Dict
from redis.asyncio import Redis
from config import settings
import logging

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self.redis: Optional[Redis] = None
        self.default_ttl = 3600  # 1 hour
    
    async def connect(self):
        """Initialize Redis connection"""
        try:
            self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
            await self.redis.ping()
            logger.info("Redis connected successfully")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis = None
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis:
            return None
        
        try:
            value = await self.redis.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache"""
        if not self.redis:
            return False
        
        try:
            ttl = ttl or self.default_ttl
            await self.redis.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.redis:
            return False
        
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    async def get_chat_cache_key(self, chat_id: str) -> str:
        """Generate cache key for chat data"""
        return f"chat:{chat_id}"
    
    async def get_messages_cache_key(self, chat_id: str) -> str:
        """Generate cache key for chat messages"""
        return f"messages:{chat_id}"
    
    async def get_stats_cache_key(self) -> str:
        """Generate cache key for statistics"""
        return "stats:global"
    
    async def invalidate_chat_cache(self, chat_id: str):
        """Invalidate chat-related cache"""
        keys = [
            await self.get_chat_cache_key(chat_id),
            await self.get_messages_cache_key(chat_id)
        ]
        for key in keys:
            await self.delete(key)
    
    async def get_cached_chat(self, chat_id: str) -> Optional[Dict]:
        """Get cached chat data"""
        key = await self.get_chat_cache_key(chat_id)
        return await self.get(key)
    
    async def set_cached_chat(self, chat_id: str, chat_data: Dict):
        """Cache chat data"""
        key = await self.get_chat_cache_key(chat_id)
        await self.set(key, chat_data, ttl=1800)  # 30 minutes
    
    async def get_cached_messages(self, chat_id: str) -> Optional[List[Dict]]:
        """Get cached messages for chat"""
        key = await self.get_messages_cache_key(chat_id)
        return await self.get(key)
    
    async def set_cached_messages(self, chat_id: str, messages: List[Dict]):
        """Cache messages for chat"""
        key = await self.get_messages_cache_key(chat_id)
        await self.set(key, messages, ttl=900)  # 15 minutes
    
    async def get_cached_stats(self) -> Optional[Dict]:
        """Get cached statistics"""
        key = await self.get_stats_cache_key()
        return await self.get(key)
    
    async def set_cached_stats(self, stats: Dict):
        """Cache statistics"""
        key = await self.get_stats_cache_key()
        await self.set(key, stats, ttl=300)  # 5 minutes

# Global cache instance
cache_service = CacheService() 