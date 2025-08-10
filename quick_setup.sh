#!/bin/bash

# Quick Setup Script for Message Aggregator on VPS
# Run this script on your VPS: ssh root@217.151.231.249

set -e

echo "🚀 Quick Setup for Message Aggregator on VPS"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash quick_setup.sh"
    exit 1
fi

# Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
apt install -y docker.io docker-compose
systemctl start docker
systemctl enable docker

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/message_aggregator
cd /opt/message_aggregator

# Create the application structure
mkdir -p {backend,frontend,nginx}

echo "✅ Basic setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Upload your backend/ and frontend/ folders to /opt/message_aggregator/"
echo "2. Run the database setup: sudo -u postgres psql -d message_aggregator -f setup_database.sql"
echo "3. Configure .env file with your PostgreSQL credentials"
echo "4. Run: docker-compose up -d"
echo ""
echo "🌐 Your application will be available at:"
echo "   - Main app: http://217.151.231.249"
echo "   - API: http://217.151.231.249:5678" 