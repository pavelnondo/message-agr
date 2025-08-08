#!/bin/bash

# Comprehensive Deployment and Fix Script for Message Aggregator
# This script installs the project and fixes all identified issues

set -e

echo "🚀 Starting comprehensive deployment and fix for Message Aggregator"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash deploy_and_fix.sh"
    exit 1
fi

# VPS IP address
VPS_IP="217.151.231.249"

echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y curl wget git nginx postgresql-client

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl start docker
    systemctl enable docker
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/message_aggregator
cd /opt/message_aggregator

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Copy project files (assuming we're running from the project directory)
echo "📁 Copying project files..."
cp -r ../backend ./
cp -r ../frontend ./
cp -r ../nginx ./
cp ../docker-compose.yml ./
cp ../setup_database.sql ./

# Set up the database
echo "🗄️ Setting up database..."
# Create database if it doesn't exist
sudo -u postgres psql -c "CREATE DATABASE message_aggregator;" 2>/dev/null || echo "Database already exists"

# Run the database setup script
echo "📊 Creating database tables..."
sudo -u postgres psql -d message_aggregator -f setup_database.sql

# Create production .env file with proper configuration
echo "⚙️ Creating production environment configuration..."
cat > .env << EOF
# Database configuration
DATABASE_URL=postgresql+asyncpg://postgres:pavel123@db:5432/message_aggregator

# MinIO configuration
MINIO_LOGIN=minioadmin
MINIO_PWD=minioadmin

# Telegram Bot configuration - MUST set your actual bot token
BOT_TOKEN=

# N8N Webhook URL - MUST set your actual webhook URL
N8N_WEBHOOK_URL=

# Redis configuration
REDIS_URL=redis://redis:6379

# RabbitMQ configuration
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672/

# Production settings
ENVIRONMENT=production
DEBUG=false
EOF

# Fix 1: Update frontend API configuration to use VPS IP
echo "🔧 Fix 1: Updating frontend API configuration..."
cat > frontend/src/api/config.ts << EOF
// API Configuration - Updated for VPS deployment
export const API_CONFIG = {
  API_URL: 'http://${VPS_IP}:5678',
  WS_URL: 'ws://${VPS_IP}:5678/ws', // Backend WebSocket server
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
EOF

# Fix 2: Re-enable WebSocket connections in ChatContext
echo "🔧 Fix 2: Re-enabling WebSocket connections..."
# Create a backup of the original file
cp frontend/src/context/ChatContext.tsx frontend/src/context/ChatContext.tsx.backup

# Replace the disabled WebSocket section with working implementation
cat > frontend/src/context/ChatContext.tsx << 'EOF'
import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Chat, Message, ChatStats } from '../api/api';
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
  stats: { totalChats: 0, waitingForResponse: 0, aiChats: 0 },
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
  const wsRef = useRef<WebSocket | null>(null);

  // AI auto-activation logic
  const startAIAutoActivationTimer = useCallback((chatId: string) => {
    // Clear existing timer
    if (state.aiAutoActivationTimer) {
      clearTimeout(state.aiAutoActivationTimer);
    }

    // Set new timer for 5 minutes (300000ms)
    const timer = setTimeout(async () => {
      try {
        const selectedChat = state.chats.find(chat => chat.id === chatId);
        if (selectedChat && !selectedChat.aiEnabled) {
          await api.toggleAI(chatId, true);
          dispatch({ type: 'UPDATE_CHAT', payload: { ...selectedChat, aiEnabled: true } });
        }
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

  // WebSocket connections - RE-ENABLED
  useEffect(() => {
    console.log('Initializing WebSocket connection...');
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://217.151.231.249:5678/ws/messages');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected successfully');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);
            
            if (data.type === 'message') {
              const message: Message = {
                id: data.id,
                chat_id: parseInt(data.chatId),
                content: data.content,
                message_type: data.message_type,
                ai: data.ai,
                sender: data.sender,
                created_at: data.timestamp,
                updated_at: data.timestamp
              };
              
              dispatch({ type: 'ADD_MESSAGE', payload: message });
              
              // Handle AI auto-activation
              if (data.sender === 'operator') {
                handleManagerMessage();
              } else if (data.sender === 'ai') {
                handleAIMessage();
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected, attempting to reconnect...');
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    // Clean up on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (state.aiAutoActivationTimer) {
        clearTimeout(state.aiAutoActivationTimer);
      }
    };
  }, [handleManagerMessage, handleAIMessage, state.aiAutoActivationTimer]);

  // Update ref when selected chat changes
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
        
        await api.markAsRead(chatId);
      } catch (error) {
        console.error('Failed to load messages:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load messages' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    sendMessage: async (content: string, type: 'text' | 'image' = 'text') => {
      if (!state.selectedChatId) return;
      
      try {
        const message = await api.sendMessage(state.selectedChatId, content, type);
        dispatch({ type: 'ADD_MESSAGE', payload: message });
        
        // Handle manager message for AI auto-activation
        if (message.sender === 'operator') {
          handleManagerMessage();
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to send message' });
      }
    },

    updateChatTags: async (chatId: string, tags: string[]) => {
      try {
        await api.updateChatTags(chatId, tags);
        const updatedChat = state.chats.find(chat => chat.id === chatId);
        if (updatedChat) {
          dispatch({ type: 'UPDATE_CHAT', payload: { ...updatedChat, tags } });
        }
      } catch (error) {
        console.error('Failed to update tags:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to update tags' });
      }
    },

    deleteChat: async (chatId: string) => {
      try {
        await api.deleteChat(chatId);
        dispatch({ type: 'DELETE_CHAT', payload: chatId });
      } catch (error) {
        console.error('Failed to delete chat:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to delete chat' });
      }
    },

    toggleAI: async (chatId: string, enabled: boolean) => {
      try {
        await api.toggleAI(chatId, enabled);
        const updatedChat = state.chats.find(chat => chat.id === chatId);
        if (updatedChat) {
          dispatch({ type: 'UPDATE_CHAT', payload: { ...updatedChat, aiEnabled: enabled } });
        }
        
        // Clear timer if AI is manually enabled
        if (enabled && state.aiAutoActivationTimer) {
          clearTimeout(state.aiAutoActivationTimer);
          dispatch({ type: 'SET_AI_AUTO_ACTIVATION_TIMER', payload: null });
        }
      } catch (error) {
        console.error('Failed to toggle AI:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to toggle AI' });
      }
    },

    markAsRead: async (chatId: string) => {
      try {
        await api.markAsRead(chatId);
        const updatedChat = state.chats.find(chat => chat.id === chatId);
        if (updatedChat) {
          dispatch({ type: 'UPDATE_CHAT', payload: { ...updatedChat, unreadCount: 0 } });
        }
      } catch (error) {
        console.error('Failed to mark as read:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to mark as read' });
      }
    },

    loadStats: async () => {
      try {
        const stats = await api.getChatStats();
        dispatch({ type: 'SET_STATS', payload: stats });
      } catch (error) {
        console.error('Failed to load stats:', error);
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
EOF

# Fix 3: Update backend config to use proper database name
echo "🔧 Fix 3: Updating backend database configuration..."
cat > backend/config.py << EOF
import os
from typing import Optional

class Settings:
    # Database
    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "message_aggregator"
    db_user: str = "postgres"
    db_password: str = "pavel123"
    
    # Redis
    redis_url: str = "redis://redis:6379/0"
    
    # RabbitMQ
    rabbitmq_url: str = "amqp://admin:admin123@rabbitmq:5672/"
    
    # Telegram
    bot_token: str = "7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I"
    
    # n8n
    n8n_webhook_url: str = "http://217.114.3.46:5678/webhook/76a8bfb0-a105-41a0-8553-e64a9d25ad79"
    api_url: Optional[str] = None
    
    # API Settings
    rate_limit: int = 60
    ai_timeout: int = 30
    max_retries: int = 3
    
    # Application Settings
    app_host: str = "0.0.0.0"
    minio_login: str = "minioadmin"
    minio_pwd: str = "minioadmin"
    
    # Monitoring
    prometheus_enabled: bool = True

settings = Settings()

# Database URL
DATABASE_URL = f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
EOF

# Fix 4: Update docker-compose.yml to use proper ports and fix frontend
echo "🔧 Fix 4: Updating docker-compose.yml..."
cat > docker-compose.yml << EOF
services:
  nginx:
    image: nginx:latest
    container_name: nginx
    ports:
      - "0.0.0.0:80:8080"
      - "0.0.0.0:5678:5678"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
      - frontend
    networks:
      - app_network

  backend:
    container_name: backend
    build:
      context: ./backend
    expose:
      - "5678"
    env_file:
      - .env
    environment:
      - PYTHONUNBUFFERED=1
    networks:
      - app_network

  frontend:
    container_name: frontend
    build:
      context: ./frontend
    ports:
      - "0.0.0.0:5173:8080"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    env_file:
      - .env
    environment:
      - CHOKIDAR_USEPOLLING=true
    networks:
      - app_network

  cloud:
    image: minio/minio
    container_name: cloud
    ports:
      - "0.0.0.0:9000:9000"
      - "0.0.0.0:9001:9001"
    environment:
      MINIO_ROOT_USER: \${MINIO_LOGIN}
      MINIO_ROOT_PASSWORD: \${MINIO_PWD}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - app_network

  db:
    image: postgres:15
    restart: always
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: message_aggregator
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: pavel123
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - app_network

  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app_network

  rabbitmq:
    image: rabbitmq:3-management
    restart: always
    ports:
      - "15672:15672"
      - "5672:5672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - app_network

volumes:
  minio_data:
  pgdata:
  redis_data:
  rabbitmq_data:

networks:
  app_network:
    driver: bridge
EOF

# Fix 5: Update frontend Dockerfile to build for production
echo "🔧 Fix 5: Updating frontend Dockerfile for production..."
cat > frontend/Dockerfile << EOF
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
EOF

# Create nginx config for frontend
cat > frontend/nginx.conf << EOF
server {
    listen 8080;
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Handle client-side routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Build and start the application
echo "🔨 Building and starting the application..."
docker-compose build --no-cache
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 80
ufw allow 443
ufw allow 5678
ufw allow 9001
ufw allow 15672
ufw allow 5173

# Test the application
echo "🧪 Testing the application..."

# Test backend health
echo "Testing backend health..."
curl -f http://localhost:5678/health || echo "Backend health check failed"

# Test frontend
echo "Testing frontend..."
curl -f http://localhost:80 || echo "Frontend test failed"

# Test Telegram webhook
echo "Testing Telegram webhook..."
curl -X POST http://localhost:5678/webhook/test -H "Content-Type: application/json" -d '{"test": "data"}' || echo "Webhook test failed"

echo "✅ Deployment and fixes complete!"
echo ""
echo "🌐 Your application is now available at:"
echo "   - Main app: http://${VPS_IP}"
echo "   - API: http://${VPS_IP}:5678"
echo "   - MinIO: http://${VPS_IP}:9001"
echo "   - RabbitMQ: http://${VPS_IP}:15672"
echo "   - Frontend dev: http://${VPS_IP}:5173"
echo ""
echo "📋 Fixed issues:"
echo "1. ✅ Re-enabled WebSocket connections in frontend"
echo "2. ✅ Updated API configuration to use VPS IP"
echo "3. ✅ Fixed database configuration"
echo "4. ✅ Updated docker-compose for proper port mapping"
echo "5. ✅ Updated frontend for production build"
echo ""
echo "🔧 Useful commands:"
echo "   - Check status: docker-compose ps"
echo "   - View logs: docker-compose logs -f"
echo "   - Restart: docker-compose restart"
echo "   - Stop: docker-compose down"
echo ""
echo "📝 Next steps:"
echo "1. Test Telegram bot by sending a message to your bot"
echo "2. Check if messages are being received and processed"
echo "3. Verify n8n webhook is receiving data"
echo "4. Monitor logs for any errors: docker-compose logs -f" 