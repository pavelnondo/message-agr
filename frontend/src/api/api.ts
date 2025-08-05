
import { API_CONFIG, ENDPOINTS } from './config';

// Types for API responses
export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: Date;
  tags: string[];
  unreadCount: number;
  waitingForResponse: boolean;
  aiEnabled: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  content: string;
  sender: 'user' | 'ai' | 'operator' | 'client';
  timestamp: Date;
  type: 'text' | 'image';
  imageUrl?: string;
}

export interface ChatStats {
  totalChats: number;
  waitingForResponse: number;
  aiChats: number;
}

export interface AIContext {
  systemMessage: string;
  faqs: string;
  lastUpdated: Date;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

// Chat operations
export async function getChats(): Promise<Chat[]> {
  try {
    const response = await fetch(`${API_CONFIG.API_URL}${ENDPOINTS.CHATS}`);
    if (!response.ok) throw new Error('Failed to fetch chats');
    const data = await response.json();
    return data.map((chat: any) => ({
      id: chat.id.toString(),
      name: chat.name || chat.uuid || 'Unknown',
      lastMessage: chat.last_message?.content || '',
      timestamp: chat.last_message?.timestamp ? new Date(chat.last_message.timestamp) : new Date(),
      tags: chat.tags || [],
      unreadCount: 0, // Adjust if you have unread logic
      waitingForResponse: chat.waiting || false,
      aiEnabled: chat.ai || false,
    }));
  } catch (error) {
    console.warn('Backend not available, using mock data');
    return [
      {
        id: '1',
        name: 'Telegram Chat 1',
        lastMessage: 'Hello from Telegram!',
        timestamp: new Date(),
        tags: ['telegram'],
        unreadCount: 0,
        waitingForResponse: false,
        aiEnabled: false,
      },
      {
        id: '2',
        name: 'AI Chat 2',
        lastMessage: 'AI response here',
        timestamp: new Date(),
        tags: ['ai'],
        unreadCount: 0,
        waitingForResponse: false,
        aiEnabled: true,
      }
    ];
  }
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const response = await fetch(`${API_CONFIG.API_URL}${ENDPOINTS.CHAT_MESSAGES}/${chatId}/messages`);
  if (!response.ok) throw new Error('Failed to fetch messages');
  const data = await response.json();
  return data.map((message: any) => ({
    id: message.id.toString(),
    chatId: message.chat_id.toString(),
    content: message.message,
    sender: message.ai ? 'ai' : 'user',
    timestamp: new Date(message.created_at),
    type: message.message_type || 'text',
    imageUrl: message.image_url,
  }));
}

export async function sendMessage(chatId: string, content: string, type: 'text' | 'image' = 'text'): Promise<Message> {
  const payload = {
    chat_id: parseInt(chatId),
    message: content,
    message_type: type,
    ai: false
  };
  const response = await fetch(`${API_CONFIG.API_URL}${ENDPOINTS.MESSAGES}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Failed to send message');
  const data = await response.json();
  return {
    id: data.id.toString(),
    chatId: data.chat_id.toString(),
    content: data.message,
    sender: data.ai ? 'ai' : 'user',
    timestamp: new Date(data.created_at),
    type: data.message_type || 'text',
    imageUrl: data.image_url,
  };
}

export async function updateChatTags(chatId: string, tags: string[]): Promise<void> {
  const response = await fetch(`${API_CONFIG.API_URL}${ENDPOINTS.CHATS}/${chatId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags })
  });
  if (!response.ok) throw new Error('Failed to update tags');
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(`${API_CONFIG.API_URL}${ENDPOINTS.CHATS}/${chatId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete chat');
}

export async function toggleAI(chatId: string, enabled: boolean): Promise<void> {
  const response = await fetch(`${API_CONFIG.API_URL}${ENDPOINTS.CHATS}/${chatId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ai: enabled })
  });
  if (!response.ok) throw new Error('Failed to toggle AI');
}

export async function markAsRead(chatId: string): Promise<void> {
  // TODO: Connect to backend: PUT `${API_CONFIG.API_URL}${ENDPOINTS.MARK_READ}/${chatId}`
  console.log('API: Marking chat as read:', chatId);
}

export async function getChatStats(): Promise<ChatStats> {
  try {
    const response = await fetch(`${API_CONFIG.API_URL}${ENDPOINTS.STATS}`);
    if (!response.ok) throw new Error('Failed to fetch chat stats');
    return await response.json();
  } catch (error) {
    console.warn('Backend not available, using mock stats');
    return {
      totalChats: 2,
      waitingForResponse: 0,
      aiChats: 1,
    };
  }
}

export async function getAIContext(): Promise<AIContext> {
  // TODO: Connect to backend: GET `${API_CONFIG.API_URL}${ENDPOINTS.AI_CONTEXT}`
  console.log('API: Fetching AI context');
  return {
    systemMessage: 'You are a helpful customer service assistant. Be professional and friendly.',
    faqs: 'Q: How do I reset my password?\nA: Click "Forgot Password" on the login page.',
    lastUpdated: new Date(),
  };
}

export async function updateAIContext(systemMessage: string, faqs: string): Promise<void> {
  // TODO: Connect to backend: PUT `${API_CONFIG.API_URL}${ENDPOINTS.AI_CONTEXT}`
  console.log('API: Updating AI context:', systemMessage, faqs);
}

export async function getFAQs(): Promise<FAQ[]> {
  // TODO: Connect to backend: GET `${API_CONFIG.API_URL}${ENDPOINTS.FAQ}`
  console.log('API: Fetching FAQs');
  
  return [
    {
      id: '1',
      question: 'How do I reset my password?',
      answer: 'You can reset your password by clicking on the "Forgot Password" link on the login page.',
      category: 'account',
    },
    {
      id: '2',
      question: 'What are your business hours?',
      answer: 'We are open Monday through Friday, 9 AM to 6 PM EST.',
      category: 'general',
    },
  ];
}

export async function updateFAQ(faq: FAQ): Promise<void> {
  // TODO: Connect to backend: PUT `${API_CONFIG.API_URL}${ENDPOINTS.FAQ}/${faq.id}`
  console.log('API: Updating FAQ:', faq);
}

export async function deleteFAQ(faqId: string): Promise<void> {
  // TODO: Connect to backend: DELETE `${API_CONFIG.API_URL}${ENDPOINTS.FAQ}/${faqId}`
  console.log('API: Deleting FAQ:', faqId);
}

// WebSocket connection for real-time updates
export function connectMessagesWebSocket(onMessage: (message: Message) => void): WebSocket | null {
  console.log('API: Connecting to WebSocket:', `${API_CONFIG.WS_URL}/messages`);
  
  try {
    const ws = new WebSocket(`${API_CONFIG.WS_URL}/messages`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          const message: Message = {
            id: data.id.toString(),
            chatId: data.chatId,
            content: data.content,
            sender: data.sender,
            timestamp: new Date(data.timestamp),
            type: data.message_type || 'text',
            imageUrl: data.imageUrl,
          };
          onMessage(message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Don't throw error, just log it to prevent app crashes
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      // Attempt to reconnect after a delay if not a normal closure
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connectMessagesWebSocket(onMessage);
        }, 5000);
      }
    };
    
    return ws;
  } catch (error) {
    console.error('Failed to connect to WebSocket:', error);
    // Return null instead of throwing to prevent app crashes
    return null;
  }
}

export function connectChatUpdatesWebSocket(onChatUpdate: (chat: Chat) => void): WebSocket | null {
  console.log('API: Connecting to chat updates WebSocket:', `${API_CONFIG.WS_URL}/updates`);
  
  try {
    const ws = new WebSocket(`${API_CONFIG.WS_URL}/updates`);
    
    ws.onopen = () => {
      console.log('Chat updates WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_update') {
          const chat: Chat = {
            id: data.id.toString(),
            name: data.name || data.uuid || 'Unknown',
            lastMessage: data.last_message?.content || '',
            timestamp: data.last_message?.timestamp ? new Date(data.last_message.timestamp) : new Date(),
            tags: data.tags || [],
            unreadCount: 0,
            waitingForResponse: data.waiting || false,
            aiEnabled: data.ai || false,
          };
          onChatUpdate(chat);
        }
      } catch (error) {
        console.error('Error parsing chat update:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('Chat updates WebSocket error:', error);
      // Don't throw error, just log it to prevent app crashes
    };
    
    ws.onclose = (event) => {
      console.log('Chat updates WebSocket disconnected:', event.code, event.reason);
      // Attempt to reconnect after a delay if not a normal closure
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('Attempting to reconnect chat updates WebSocket...');
          connectChatUpdatesWebSocket(onChatUpdate);
        }, 5000);
      }
    };
    
    return ws;
  } catch (error) {
    console.error('Failed to connect to chat updates WebSocket:', error);
    // Return null instead of throwing to prevent app crashes
    return null;
  }
}
