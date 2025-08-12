import { API_CONFIG, ENDPOINTS } from './config';

export interface Chat {
  id: string;
  user_id: string;
  ai_enabled: boolean;
  is_awaiting_manager_confirmation: boolean;
  created_at: string;
  updated_at: string;
  last_message?: {
    id: string;
    message: string;
    message_type: string;
    created_at: string;
  };
}

export interface Message {
  id: string;
  chat_id: string;
  message: string;
  message_type: 'question' | 'answer';
  created_at: string;
}

export interface ChatStats {
  total_chats: number;
  total_messages: number;
  awaiting_manager_confirmation: number;
}

export interface BotSettings {
  system_message?: string;
  faqs?: string;
  [key: string]: string | undefined;
}

export interface BotSetting {
  key: string;
  value: string;
}

export const api = {
  defaults: {
    headers: {
      common: {} as Record<string, string>
    }
  },
  async get(url: string) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...api.defaults.headers.common
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_CONFIG.API_URL || ''}${url}`, { method: 'GET', headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return { data: await response.json() };
  },
  async post(url: string, data?: any) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...api.defaults.headers.common
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_CONFIG.API_URL || ''}${url}`, { method: 'POST', headers, body: data ? JSON.stringify(data) : undefined });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      (error as any).response = { data: errorData, status: response.status };
      throw error;
    }
    return { data: await response.json() };
  },
  async put(url: string, data?: any) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...api.defaults.headers.common
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_CONFIG.API_URL || ''}${url}`, { method: 'PUT', headers, body: data ? JSON.stringify(data) : undefined });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return { data: await response.json() };
  },
  async delete(url: string) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...api.defaults.headers.common
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_CONFIG.API_URL || ''}${url}`, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return { data: await response.json() };
  }
};

export async function getChats(): Promise<Chat[]> {
  try {
    const base = API_CONFIG.API_URL || '';
    const response = await fetch(`${base}${ENDPOINTS.CHATS}`);
    if (!response.ok) throw new Error('Failed to fetch chats');
    const data = await response.json();
    return data.map((chat: any) => ({
      id: chat.id.toString(),
      user_id: chat.user_id || 'Unknown',
      ai_enabled: typeof chat.ai_enabled === 'boolean' ? chat.ai_enabled : true,
      is_awaiting_manager_confirmation: chat.is_awaiting_manager_confirmation || false,
      created_at: chat.created_at,
      updated_at: chat.updated_at,
      last_message: chat.last_message ? {
        id: chat.last_message.id.toString(),
        message: chat.last_message.message || '',
        message_type: chat.last_message.message_type || 'question',
        created_at: chat.last_message.created_at
      } : undefined
    }));
  } catch (error) {
    console.warn('Backend not available, using mock data');
    return [
      {
        id: '1',
        user_id: 'user123',
        is_awaiting_manager_confirmation: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message: {
          id: '1',
          message: 'Hello from user!',
          message_type: 'question',
          created_at: new Date().toISOString()
        }
      } as any,
    ];
  }
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const { data } = await api.get(`${ENDPOINTS.CHAT_MESSAGES}/${chatId}/messages`);
  const list = Array.isArray(data) ? data : (data.messages || []);
  return list.map((message: any) => ({
    id: message.id.toString(),
    chat_id: message.chat_id.toString(),
    message: message.message,
    message_type: message.message_type,
    created_at: message.created_at
  }));
}

export async function sendMessage(chatId: string, content: string, messageType: 'question' | 'answer' = 'question', tenant_id?: string): Promise<Message> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.CHAT_MESSAGES}/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: parseInt(chatId), message: content, message_type: messageType, tenant_id: tenant_id || 'default' })
  });
  if (!response.ok) throw new Error('Failed to send message');
  const data = await response.json();
  return { id: data.id.toString(), chat_id: data.chat_id.toString(), message: data.message, message_type: data.message_type, created_at: data.created_at };
}

export async function createChat(userId: string): Promise<Chat> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.CHATS}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
  if (!response.ok) throw new Error('Failed to create chat');
  const data = await response.json();
  return { id: data.id.toString(), user_id: data.user_id, ai_enabled: typeof data.ai_enabled === 'boolean' ? data.ai_enabled : true, is_awaiting_manager_confirmation: data.is_awaiting_manager_confirmation, created_at: data.created_at, updated_at: data.updated_at };
}

export async function updateChat(chatId: string, updates: { ai_enabled?: boolean, is_awaiting_manager_confirmation?: boolean }): Promise<Chat> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.CHATS}/${chatId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
  if (!response.ok) throw new Error('Failed to update chat');
  const data = await response.json();
  return { id: data.id.toString(), user_id: data.user_id, ai_enabled: typeof data.ai_enabled === 'boolean' ? data.ai_enabled : true, is_awaiting_manager_confirmation: data.is_awaiting_manager_confirmation, created_at: data.created_at, updated_at: data.updated_at };
}

export async function deleteChat(chatId: string): Promise<void> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.CHATS}/${chatId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete chat');
}

export async function getChatStats(): Promise<ChatStats> {
  try {
    const base = API_CONFIG.API_URL || '';
    const response = await fetch(`${base}${ENDPOINTS.STATS}`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();
    return { total_chats: data.total_chats || 0, total_messages: data.total_messages || 0, awaiting_manager_confirmation: data.awaiting_manager_confirmation || 0 };
  } catch (error) {
    console.warn('Backend not available, using mock stats');
    return { total_chats: 2, total_messages: 10, awaiting_manager_confirmation: 1 };
  }
}

export async function getBotSettings(): Promise<BotSettings> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.BOT_SETTINGS}`);
  if (!response.ok) throw new Error('Failed to fetch bot settings');
  return await response.json();
}

export async function getBotSetting(key: string): Promise<BotSetting> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.BOT_SETTINGS}/${key}`);
  if (!response.ok) throw new Error('Failed to fetch bot setting');
  return await response.json();
}

export async function updateBotSetting(key: string, value: string): Promise<BotSetting> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.BOT_SETTINGS}/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) });
  if (!response.ok) throw new Error('Failed to update bot setting');
  return await response.json();
}

export async function getAISettings(): Promise<BotSettings> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.AI_SETTINGS}`);
  if (!response.ok) throw new Error('Failed to fetch AI settings');
  return await response.json();
}

export async function saveAISettings(settings: BotSettings): Promise<{ message: string }> {
  const base = API_CONFIG.API_URL || '';
  const response = await fetch(`${base}${ENDPOINTS.AI_SETTINGS}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
  if (!response.ok) throw new Error('Failed to save AI settings');
  return await response.json();
}

export function connectMessagesWebSocket(onMessage: (message: Message) => void): WebSocket | null {
  try {
    const wsUrl = `${API_CONFIG.WS_BASE}${ENDPOINTS.WS_MESSAGES}`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('WebSocket connected for messages');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          onMessage({ id: data.data.id.toString(), chat_id: data.data.chat_id.toString(), message: data.data.message, message_type: data.data.message_type, created_at: data.data.created_at });
        }
      } catch (error) { console.error('Error parsing WebSocket message:', error); }
    };
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket disconnected for messages');
    return ws;
  } catch (error) { console.error('Failed to connect to WebSocket:', error); return null; }
}

export function connectChatUpdatesWebSocket(onChatUpdate: (chat: Chat) => void): WebSocket | null {
  try {
    const wsUrl = `${API_CONFIG.WS_BASE}${ENDPOINTS.WS_UPDATES}`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('WebSocket connected for chat updates');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_update') {
          onChatUpdate({ id: data.data.id.toString(), user_id: data.data.user_id, ai_enabled: typeof data.data.ai_enabled === 'boolean' ? data.data.ai_enabled : true, is_awaiting_manager_confirmation: data.data.is_awaiting_manager_confirmation, created_at: data.data.created_at, updated_at: data.data.updated_at });
        }
      } catch (error) { console.error('Error parsing WebSocket message:', error); }
    };
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket disconnected for chat updates');
    return ws;
  } catch (error) { console.error('Failed to connect to WebSocket:', error); return null; }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const base = API_CONFIG.API_URL || '';
    const response = await fetch(`${base}${ENDPOINTS.HEALTH}`);
    return response.ok;
  } catch (error) { console.error('Health check failed:', error); return false; }
}


