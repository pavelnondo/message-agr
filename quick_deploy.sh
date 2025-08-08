#!/bin/bash

# Quick Deploy Script for Message Aggregator VPS
# Run this script on your VPS to install and fix the project

set -e

echo "🚀 Quick Deploy for Message Aggregator"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash quick_deploy.sh"
    exit 1
fi

VPS_IP="217.151.231.249"

echo "📦 Installing dependencies..."
apt update
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
echo "📁 Setting up application directory..."
mkdir -p /opt/message_aggregator
cd /opt/message_aggregator

# Stop any existing containers
docker-compose down 2>/dev/null || true

# Download the project files (you'll need to upload these to the VPS)
echo "📥 Please upload the project files to /opt/message_aggregator/"
echo "   You can use scp or git clone to get the files"
echo "   Then run this script again"

# Check if files exist
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Project files not found. Please upload them first."
    echo "   You can use: scp -r ./backend root@$VPS_IP:/opt/message_aggregator/"
    echo "   Or clone from git if available"
    exit 1
fi

# Set up database
echo "🗄️ Setting up database..."
sudo -u postgres psql -c "CREATE DATABASE message_aggregator;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -d message_aggregator -f setup_database.sql

# Create .env file
echo "⚙️ Creating environment configuration..."
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://postgres:pavel123@db:5432/message_aggregator
MINIO_LOGIN=minioadmin
MINIO_PWD=minioadmin
# MUST SET BEFORE RUNNING
BOT_TOKEN=
N8N_WEBHOOK_URL=
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672/
ENVIRONMENT=production
DEBUG=false
EOF

# Fix frontend API configuration
echo "🔧 Fixing frontend API configuration..."
if [ -f "frontend/src/api/config.ts" ]; then
    cat > frontend/src/api/config.ts << EOF
export const API_CONFIG = {
  API_URL: 'http://$VPS_IP:5678',
  WS_URL: 'ws://$VPS_IP:5678/ws',
};

export const ENDPOINTS = {
  CHATS: '/api/chats',
  MESSAGES: '/api/messages',
  CHAT_MESSAGES: '/api/chats',
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
fi

# Fix backend config
echo "🔧 Fixing backend configuration..."
if [ -f "backend/config.py" ]; then
    cat > backend/config.py << EOF
import os
from typing import Optional

class Settings:
    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "message_aggregator"
    db_user: str = "postgres"
    db_password: str = "pavel123"
    redis_url: str = "redis://redis:6379/0"
    rabbitmq_url: str = "amqp://admin:admin123@rabbitmq:5672/"
    bot_token: str = "7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I"
    n8n_webhook_url: str = "http://217.114.3.46:5678/webhook/76a8bfb0-a105-41a0-8553-e64a9d25ad79"
    api_url: Optional[str] = None
    rate_limit: int = 60
    ai_timeout: int = 30
    max_retries: int = 3
    app_host: str = "0.0.0.0"
    minio_login: str = "minioadmin"
    minio_pwd: str = "minioadmin"
    prometheus_enabled: bool = True

settings = Settings()
DATABASE_URL = f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
EOF
fi

# Update docker-compose for production
echo "🔧 Updating docker-compose for production..."
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

# Build and start
echo "🔨 Building and starting application..."
docker-compose build --no-cache
docker-compose up -d

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 80
ufw allow 443
ufw allow 5678
ufw allow 9001
ufw allow 15672
ufw allow 5173

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 30

# Test services
echo "🧪 Testing services..."
curl -f http://localhost:5678/health && echo "Backend OK" || echo "Backend failed"
curl -f http://localhost:80 && echo "Frontend OK" || echo "Frontend failed"

# Set up Telegram webhook
echo "🔧 Setting up Telegram webhook..."
BOT_TOKEN="7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I"
WEBHOOK_URL="http://$VPS_IP:5678/webhook/telegram"
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{\"url\": \"$WEBHOOK_URL\"}"

echo "✅ Quick deploy complete!"
echo ""
echo "🌐 Your application is available at:"
echo "   - Main app: http://$VPS_IP"
echo "   - API: http://$VPS_IP:5678"
echo "   - MinIO: http://$VPS_IP:9001"
echo "   - RabbitMQ: http://$VPS_IP:15672"
echo ""
echo "📋 Next steps:"
echo "1. Test the Telegram bot"
echo "2. Check logs: docker-compose logs -f"
echo "3. Run troubleshooting: bash troubleshoot.sh" 