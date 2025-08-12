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

// API endpoints - Updated for n8n workflow
export const ENDPOINTS = {
  CHATS: '/api/chats',
  MESSAGES: '/api/messages',
  CHAT_MESSAGES: '/api/chats', // Will be used as /api/chats/{id}/messages
  STATS: '/api/stats',
  BOT_SETTINGS: '/api/bot-settings',
  AI_SETTINGS: '/api/ai-settings',
  WS_MESSAGES: '/ws/messages',
  WS_UPDATES: '/ws/updates',
  HEALTH: '/health',
};
