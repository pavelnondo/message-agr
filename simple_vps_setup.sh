#!/bin/bash

# Simple VPS Setup Script for Message Aggregator
# Run this on your VPS

set -e

echo "🚀 Simple Setup for Message Aggregator on VPS"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash simple_vps_setup.sh"
    exit 1
fi

# Update system
echo "📦 Updating system..."
apt update

# Install Docker (handle containerd conflict)
echo "🐳 Installing Docker..."
apt remove -y containerd docker.io docker-compose || true
apt install -y docker.io docker-compose

# Start and enable Docker
echo "🐳 Starting Docker..."
systemctl start docker
systemctl enable docker

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/message_aggregator
cd /opt/message_aggregator

# Clone the repository from GitHub
echo "📥 Cloning repository from GitHub..."
git clone https://github.com/pavelnondo/message-agr.git .
rm -rf .git  # Remove git history to avoid conflicts

# Set up the database
echo "🗄️ Setting up database..."
# Create database if it doesn't exist
sudo -u postgres psql -c "CREATE DATABASE message_aggregator;" 2>/dev/null || echo "Database already exists"

# Run the database setup script
echo "📊 Creating database tables..."
sudo -u postgres psql -d message_aggregator -f setup_database.sql

# Create production .env file
echo "⚙️ Creating production environment configuration..."
cat > .env << 'EOF'
# Database configuration - Update with your actual PostgreSQL credentials
DATABASE_URL=postgresql+asyncpg://postgres:your_actual_password@localhost:5432/message_aggregator

# MinIO configuration
MINIO_LOGIN=minioadmin
MINIO_PWD=minioadmin

# Telegram Bot configuration - Update with your bot token
BOT_TOKEN=your_telegram_bot_token

# N8N Webhook URL - Update with your domain
N8N_WEBHOOK_URL=http://217.151.231.249:5678/webhook/your_webhook_id

# Redis configuration
REDIS_URL=redis://localhost:6379

# RabbitMQ configuration
RABBITMQ_URL=amqp://admin:admin123@localhost:5672/

# Production settings
ENVIRONMENT=production
DEBUG=false
EOF

# Update docker-compose.yml for production (port 80 instead of 3000)
echo "🐳 Updating Docker Compose for production..."
sed -i 's/"0.0.0.0:3000:8080"/"0.0.0.0:80:8080"/' docker-compose.yml

# Build and start the application
echo "🔨 Building and starting the application..."
docker-compose build
docker-compose up -d

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 80
ufw allow 443
ufw allow 5678
ufw allow 9001
ufw allow 15672

echo "✅ Setup complete!"
echo ""
echo "🌐 Your application is now available at:"
echo "   - Main app: http://217.151.231.249"
echo "   - API: http://217.151.231.249:5678"
echo "   - MinIO: http://217.151.231.249:9001"
echo "   - RabbitMQ: http://217.151.231.249:15672"
echo ""
echo "📋 Next steps:"
echo "1. Update the .env file with your actual credentials:"
echo "   nano /opt/message_aggregator/.env"
echo "2. Restart the services:"
echo "   docker-compose restart"
echo "3. Check the logs:"
echo "   docker-compose logs -f" 