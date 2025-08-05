// API Configuration - All backend URLs are configurable via environment variables
export const API_CONFIG = {
  API_URL: 'http://localhost:3000',
  WS_URL: 'ws://localhost:3000/ws', // Backend WebSocket server
};

// API endpoints
export const ENDPOINTS = {
  CHATS: '/api/chats',
  MESSAGES: '/api/messages',
  CHAT_MESSAGES: '/api/chats', // Will be used as /api/chats/{id}/messages
  AI_CONTEXT: '/api/ai/context',
  FAQ: '/api/faq',
  SEND_MESSAGE: '/api/messages/send',
  UPDATE_TAGS: '/api/chats/tags',
  DELETE_CHAT: '/api/chats',
  TOGGLE_AI: '/api/chats/ai',
  MARK_READ: '/api/chats/read',
  STATS: '/api/stats',
};
