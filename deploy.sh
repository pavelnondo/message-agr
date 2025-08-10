#!/bin/bash

# Message Aggregator Deployment Script for VPS
# This script deploys the application to a VPS with existing PostgreSQL

set -e

echo "🚀 Starting Message Aggregator deployment..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y curl wget git docker.io docker-compose python3 python3-pip python3-venv nginx

# Start and enable Docker
echo "🐳 Setting up Docker..."
systemctl start docker
systemctl enable docker

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/message_aggregator
cd /opt/message_aggregator

# Clone the repository (you'll need to upload your code or clone from git)
echo "📥 Setting up application files..."
# If you have a git repository, uncomment the next line:
# git clone <your-repo-url> .

# Create the application structure
mkdir -p {backend,frontend,nginx}

# Create .env file for production
echo "⚙️ Creating environment configuration..."
cat > .env << 'EOF'
# Database configuration - Update with your existing PostgreSQL credentials
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/message_aggregator

# MinIO configuration
MINIO_LOGIN=minioadmin
MINIO_PWD=minioadmin

# Telegram Bot configuration - Update with your bot token
BOT_TOKEN=your_telegram_bot_token

# N8N Webhook URL - Update with your webhook URL
N8N_WEBHOOK_URL=http://your_domain:5678/webhook/your_webhook_id

# Redis configuration
REDIS_URL=redis://localhost:6379

# RabbitMQ configuration
RABBITMQ_URL=amqp://admin:admin123@localhost:5672/

# Production settings
ENVIRONMENT=production
DEBUG=false
EOF

# Create docker-compose.yml for production
echo "🐳 Creating Docker Compose configuration..."
cat > docker-compose.yml << 'EOF'
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
      MINIO_ROOT_USER: ${MINIO_LOGIN}
      MINIO_ROOT_PASSWORD: ${MINIO_PWD}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
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
  redis_data:
  rabbitmq_data:

networks:
  app_network:
    driver: bridge
EOF

# Create nginx configuration
echo "🌐 Creating nginx configuration..."
mkdir -p nginx
cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    # Увеличиваем лимит размера файла до 10MB
    client_max_body_size 10M;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    # Main server - handles both frontend and API
    server {
        listen 8080;
        
        # WebSocket routes for backend (most specific first)
        location /ws/ {
            proxy_pass http://backend:5678/ws/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400;
            proxy_connect_timeout 86400;
            proxy_send_timeout 86400;
        }

        # Webhook routes for Telegram bot
        location /webhook/ {
            proxy_pass http://backend:5678;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 300;
            proxy_connect_timeout 300;
            proxy_send_timeout 300;
        }

        # API routes - proxy to backend (more specific than /)
        location /api/ {
            proxy_pass http://backend:5678;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 300;
            proxy_connect_timeout 300;
            proxy_send_timeout 300;
        }

        # Health endpoint - proxy to backend
        location /health {
            proxy_pass http://backend:5678;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 300;
            proxy_connect_timeout 300;
            proxy_send_timeout 300;
        }
        
        # Frontend routes - proxy to frontend (catch-all)
        location / {
            proxy_pass http://frontend:8082;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    # Backend proxy (kept for direct access)
    server {
        listen 5678;
        
        location / {
            proxy_pass http://backend:5678;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 300;
            proxy_connect_timeout 300;
            proxy_send_timeout 300;
        }

        location /ws/ {
            proxy_pass http://backend:5678;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400;
        }
    }
}
EOF

echo "✅ Deployment script created!"
echo ""
echo "📋 Next steps:"
echo "1. Upload your application files to /opt/message_aggregator/"
echo "2. Update the .env file with your PostgreSQL credentials"
echo "3. Run: docker-compose up -d"
echo ""
echo "🌐 Your application will be available at:"
echo "   - Main app: http://your_domain"
echo "   - API: http://your_domain:5678"
echo "   - MinIO: http://your_domain:9001"
echo "   - RabbitMQ: http://your_domain:15672" 