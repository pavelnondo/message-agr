// API Configuration - designed for both local dev and production behind nginx
// Use same-origin relative paths by default so nginx can proxy /api and /ws
const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = typeof window !== 'undefined' ? window.location.host : 'localhost';

export const API_CONFIG = {
  // Empty means use same origin, e.g., http(s)://host
  API_URL: '',
  // WebSocket base, e.g., ws(s)://host
  WS_BASE: `${wsProtocol}://${host}`,
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
