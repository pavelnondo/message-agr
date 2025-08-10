import httpx
import asyncio
from typing import Optional, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from config import settings
import logging

logger = logging.getLogger(__name__)

class AIProcessingError(Exception):
    """Custom exception for AI processing errors"""
    pass

class ResilientSession:
    """HTTP session with retry logic and timeout handling"""
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.session = None
    
    async def __aenter__(self):
        self.session = httpx.AsyncClient(timeout=self.timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.aclose()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError))
    )
    async def post(self, url: str, json: Dict[str, Any]) -> httpx.Response:
        """Make POST request with retry logic"""
        if not self.session:
            raise AIProcessingError("Session not initialized")
        
        response = await self.session.post(url, json=json)
        response.raise_for_status()
        return response

class AIProcessor:
    """Handles AI processing with n8n integration"""
    
    def __init__(self):
        self.webhook_url = settings.n8n_webhook_url
        self.timeout = settings.ai_timeout
        self.max_retries = settings.max_retries
        self.failure_count = 0
        self.circuit_open = False
    
    async def process_message(self, message_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process message through n8n AI service"""
        
        # Check circuit breaker
        if self.circuit_open:
            logger.warning("Circuit breaker is open, using fallback response")
            return self.get_fallback_response()
        
        try:
            # Prepare request payload
            payload = {
                "chat_id": message_data.get("chat_id"),
                "text": message_data.get("text", ""),
                "context": await self.get_context(message_data.get("chat_id")),
                "timestamp": message_data.get("timestamp"),
                "user_id": message_data.get("user_id")
            }
            
            # Make request with retry logic
            async with ResilientSession(timeout=self.timeout) as session:
                response = await session.post(self.webhook_url, json=payload)
                
                # Reset failure count on success
                self.failure_count = 0
                self.circuit_open = False
                
                return self.parse_response(response)
                
        except Exception as e:
            logger.error(f"AI processing failed: {e}")
            self.failure_count += 1
            
            # Open circuit breaker after multiple failures
            if self.failure_count >= self.max_retries:
                self.circuit_open = True
                logger.error("Circuit breaker opened due to repeated failures")
            
            return self.get_fallback_response()
    
    async def get_context(self, chat_id: Optional[str]) -> Dict[str, Any]:
        """Get conversation context for AI processing"""
        if not chat_id:
            return {}
        
        # This could be enhanced to include:
        # - Recent message history
        # - User preferences
        # - Conversation state
        # - Brand-specific context
        
        return {
            "chat_id": chat_id,
            "message_count": 0,  # Could be fetched from cache
            "user_type": "telegram",
            "language": "en"
        }
    
    def parse_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Parse n8n response"""
        try:
            data = response.json()
            
            # Handle different response formats
            if isinstance(data, dict):
                return {
                    "success": True,
                    "answer": data.get("answer") or data.get("text") or data.get("response"),
                    "confidence": data.get("confidence", 0.8),
                    "metadata": data.get("metadata", {})
                }
            elif isinstance(data, str):
                return {
                    "success": True,
                    "answer": data,
                    "confidence": 0.8,
                    "metadata": {}
                }
            else:
                return self.get_fallback_response()
                
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            return self.get_fallback_response()
    
    def get_fallback_response(self) -> Dict[str, Any]:
        """Get fallback response when AI processing fails"""
        return {
            "success": False,
            "answer": "I'm sorry, I'm having trouble processing your request right now. Please try again later or contact support if the issue persists.",
            "confidence": 0.0,
            "metadata": {
                "fallback": True,
                "reason": "AI service unavailable"
            }
        }
    
    async def health_check(self) -> bool:
        """Check if AI service is healthy"""
        try:
            async with ResilientSession(timeout=5) as session:
                response = await session.post(
                    self.webhook_url,
                    json={"health_check": True}
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"AI health check failed: {e}")
            return False

# Global AI processor instance
ai_processor = AIProcessor() 