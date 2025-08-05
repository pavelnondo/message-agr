#!/bin/bash

# Complete VPS Setup Script for Message Aggregator
# This script installs everything needed and deploys the application

set -e

echo "🚀 Complete Setup for Message Aggregator on VPS"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash complete_vps_setup.sh"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update

# Remove any conflicting Docker packages
echo "🧹 Cleaning up existing Docker installations..."
apt remove -y docker docker.io docker-compose containerd || true
apt autoremove -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y curl wget git nginx postgresql-client

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Start and enable Docker
echo "🐳 Starting Docker..."
systemctl start docker
systemctl enable docker

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

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
echo ""
echo "🔧 Useful commands:"
echo "   - Check status: docker-compose ps"
echo "   - View logs: docker-compose logs -f"
echo "   - Restart: docker-compose restart"
echo "   - Stop: docker-compose down" 