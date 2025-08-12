// API Configuration - supports environment overrides (VITE_API_URL, VITE_WS_URL)
// Fallback to same-origin relative paths so nginx can proxy /api and /ws
const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
const envApiUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
const envWsUrl = (import.meta as any)?.env?.VITE_WS_URL as string | undefined;

export const API_CONFIG = {
  API_URL: envApiUrl ?? '',
  WS_BASE: envWsUrl ?? `${wsProtocol}://${host}`,
};

// API endpoints
export const ENDPOINTS = {
  CHATS: '/api/chats',
  MESSAGES: '/api/messages',
  CHAT_MESSAGES: '/api/chats', // /api/chats/{id}/messages
  STATS: '/api/stats',
  BOT_SETTINGS: '/api/bot-settings',
  AI_SETTINGS: '/api/ai-settings',
  WS_MESSAGES: '/ws/messages',
  WS_UPDATES: '/ws/updates',
  HEALTH: '/health',
};


