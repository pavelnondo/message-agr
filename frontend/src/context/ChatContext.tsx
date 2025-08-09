
import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Chat, Message, ChatStats } from '../api/api';
import { API_CONFIG } from '../api/config';
import * as api from '../api/api';

interface ChatState {
  chats: Chat[];
  selectedChatId: string | null;
  messages: Message[];
  stats: ChatStats;
  loading: boolean;
  error: string | null;
  searchTerm: string;
  selectedTags: string[];
  newMessageIndicator: boolean;
  // AI auto-activation state
  lastManagerMessageTime: number | null;
  aiAutoActivationTimer: NodeJS.Timeout | null;
}

type ChatAction =
  | { type: 'SET_CHATS'; payload: Chat[] }
  | { type: 'SET_SELECTED_CHAT'; payload: string | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_CHAT'; payload: Chat }
  | { type: 'DELETE_CHAT'; payload: string }
  | { type: 'SET_STATS'; payload: ChatStats }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SEARCH_TERM'; payload: string }
  | { type: 'SET_SELECTED_TAGS'; payload: string[] }
  | { type: 'SET_NEW_MESSAGE_INDICATOR'; payload: boolean }
  | { type: 'SET_LAST_MANAGER_MESSAGE_TIME'; payload: number | null }
  | { type: 'SET_AI_AUTO_ACTIVATION_TIMER'; payload: NodeJS.Timeout | null };

const initialState: ChatState = {
  chats: [],
  selectedChatId: null,
  messages: [],
  stats: { total_chats: 0, total_messages: 0, awaiting_manager_confirmation: 0 },
  loading: false,
  error: null,
  searchTerm: '',
  selectedTags: [],
  newMessageIndicator: false,
  lastManagerMessageTime: null,
  aiAutoActivationTimer: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CHATS':
      return { ...state, chats: action.payload };
    case 'SET_SELECTED_CHAT':
      return { ...state, selectedChatId: action.payload, newMessageIndicator: false };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_CHAT':
      return {
        ...state,
        chats: state.chats.map(chat =>
          chat.id === action.payload.id ? action.payload : chat
        ),
      };
    case 'DELETE_CHAT':
      return {
        ...state,
        chats: state.chats.filter(chat => chat.id !== action.payload),
        selectedChatId: state.selectedChatId === action.payload ? null : state.selectedChatId,
      };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.payload };
    case 'SET_SELECTED_TAGS':
      return { ...state, selectedTags: action.payload };
    case 'SET_NEW_MESSAGE_INDICATOR':
      return { ...state, newMessageIndicator: action.payload };
    case 'SET_LAST_MANAGER_MESSAGE_TIME':
      return { ...state, lastManagerMessageTime: action.payload };
    case 'SET_AI_AUTO_ACTIVATION_TIMER':
      return { ...state, aiAutoActivationTimer: action.payload };
    default:
      return state;
  }
}

interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  actions: {
    loadChats: () => Promise<void>;
    selectChat: (chatId: string) => Promise<void>;
    sendMessage: (content: string, type?: 'text' | 'image') => Promise<void>;
    updateChatTags: (chatId: string, tags: string[]) => Promise<void>;
    deleteChat: (chatId: string) => Promise<void>;
    toggleAI: (chatId: string, enabled: boolean) => Promise<void>;
    markAsRead: (chatId: string) => Promise<void>;
    loadStats: () => Promise<void>;
    setSearchTerm: (term: string) => void;
    setSelectedTags: (tags: string[]) => void;
    handleManagerMessage: () => void;
    handleAIMessage: () => void;
  };
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const selectedChatIdRef = useRef<string | null>(null);

  // AI auto-activation logic
  const startAIAutoActivationTimer = useCallback((chatId: string) => {
    // Clear existing timer
    if (state.aiAutoActivationTimer) {
      clearTimeout(state.aiAutoActivationTimer);
    }

    // Set new timer for 5 minutes (300000ms)
    const timer = setTimeout(async () => {
      try {
        // AI is considered always ON; no-op
      } catch (error) {
        console.error('Failed to auto-activate AI:', error);
      }
    }, 300000); // 5 minutes

    dispatch({ type: 'SET_AI_AUTO_ACTIVATION_TIMER', payload: timer });
  }, [state.aiAutoActivationTimer, state.chats]);

  const handleManagerMessage = useCallback(() => {
    if (state.selectedChatId) {
      dispatch({ type: 'SET_LAST_MANAGER_MESSAGE_TIME', payload: Date.now() });
      startAIAutoActivationTimer(state.selectedChatId);
    }
  }, [state.selectedChatId, startAIAutoActivationTimer]);

  const handleAIMessage = useCallback(() => {
    // Clear timer when AI responds
    if (state.aiAutoActivationTimer) {
      clearTimeout(state.aiAutoActivationTimer);
      dispatch({ type: 'SET_AI_AUTO_ACTIVATION_TIMER', payload: null });
    }
    dispatch({ type: 'SET_LAST_MANAGER_MESSAGE_TIME', payload: null });
  }, [state.aiAutoActivationTimer]);

  // WebSocket connections - enabled with reconnection logic
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(`${API_CONFIG.WS_BASE}/ws/messages`);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_message') {
              const payload = data.data;
              const message: Message = {
                id: String(payload.id),
                chat_id: String(payload.chat_id),
                message: payload.message,
                message_type: payload.message_type,
                created_at: payload.created_at,
              };
              dispatch({ type: 'ADD_MESSAGE', payload: message });
            }
          } catch {}
        };

        ws.onclose = () => {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          try { ws && ws.close(); } catch {}
        };
      } catch (e) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws && ws.close(); } catch {}
      if (state.aiAutoActivationTimer) {
        clearTimeout(state.aiAutoActivationTimer);
      }
    };
  }, [state.aiAutoActivationTimer]);

  // Update ref when selected chat changes - using callback to avoid useEffect
  const updateSelectedChatRef = useCallback((chatId: string | null) => {
    selectedChatIdRef.current = chatId;
  }, []);

  const actions = {
    loadChats: async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const chats = await api.getChats();
        dispatch({ type: 'SET_CHATS', payload: chats });
      } catch (error) {
        console.error('Failed to load chats:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load chats' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    selectChat: async (chatId: string) => {
      try {
        updateSelectedChatRef(chatId);
        dispatch({ type: 'SET_SELECTED_CHAT', payload: chatId });
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const messages = await api.getMessages(chatId);
        dispatch({ type: 'SET_MESSAGES', payload: messages });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load messages' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    sendMessage: async (content: string, type: 'text' | 'image' = 'text') => {
      if (!state.selectedChatId) return;
      
      try {
        const message = await api.sendMessage(state.selectedChatId, content, 'answer');
        dispatch({ type: 'ADD_MESSAGE', payload: message });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to send message' });
      }
    },

    updateChatTags: async (chatId: string, tags: string[]) => {
      try {
        // No-op: tags not supported by backend schema currently
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to update tags' });
      }
    },

    deleteChat: async (chatId: string) => {
      try {
        await api.deleteChat(chatId);
        dispatch({ type: 'DELETE_CHAT', payload: chatId });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to delete chat' });
      }
    },

    toggleAI: async (_chatId: string, _enabled: boolean) => {
      // No-op: AI is always ON by default in UI for now
      return;
    },

    markAsRead: async (chatId: string) => {
      try {
        // Not implemented in backend
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to mark as read' });
      }
    },

    loadStats: async () => {
      try {
        const stats = await api.getChatStats();
        dispatch({ type: 'SET_STATS', payload: stats });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load stats' });
      }
    },

    setSearchTerm: (term: string) => {
      dispatch({ type: 'SET_SEARCH_TERM', payload: term });
    },

    setSelectedTags: (tags: string[]) => {
      dispatch({ type: 'SET_SELECTED_TAGS', payload: tags });
    },

    handleManagerMessage,
    handleAIMessage,
  };

  return (
    <ChatContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
