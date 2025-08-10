#!/bin/bash

# Comprehensive Troubleshooting Script for Message Aggregator
# This script checks all aspects of the application and fixes issues

set -e

echo "🔍 Starting comprehensive troubleshooting for Message Aggregator"

# VPS IP address
VPS_IP="217.151.231.249"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARNING" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash troubleshoot.sh"
    exit 1
fi

cd /opt/message_aggregator

echo "📋 Checking system status..."

# Check 1: Docker and Docker Compose
echo "🔍 Check 1: Docker and Docker Compose"
if command -v docker &> /dev/null; then
    print_status "OK" "Docker is installed"
    docker --version
else
    print_status "ERROR" "Docker is not installed"
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl start docker
    systemctl enable docker
fi

if command -v docker-compose &> /dev/null; then
    print_status "OK" "Docker Compose is installed"
    docker-compose --version
else
    print_status "ERROR" "Docker Compose is not installed"
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Check 2: Container Status
echo "🔍 Check 2: Container Status"
if docker-compose ps | grep -q "Up"; then
    print_status "OK" "Containers are running"
    docker-compose ps
else
    print_status "ERROR" "Containers are not running"
    echo "Starting containers..."
    docker-compose up -d
    sleep 10
fi

# Check 3: Database Connection
echo "🔍 Check 3: Database Connection"
if docker exec backend python -c "
import asyncio
from crud import engine
async def test():
    try:
        async with engine.begin() as conn:
            result = await conn.execute('SELECT 1')
            print('Database connection successful')
    except Exception as e:
        print(f'Database connection failed: {e}')
asyncio.run(test())
" 2>/dev/null | grep -q "successful"; then
    print_status "OK" "Database connection is working"
else
    print_status "ERROR" "Database connection failed"
    echo "Checking database container..."
    docker-compose logs db
fi

# Check 4: Backend Health
echo "🔍 Check 4: Backend Health"
if curl -f http://localhost:5678/health 2>/dev/null; then
    print_status "OK" "Backend is healthy"
else
    print_status "ERROR" "Backend health check failed"
    echo "Checking backend logs..."
    docker-compose logs backend
fi

# Check 5: Frontend Access
echo "🔍 Check 5: Frontend Access"
if curl -f http://localhost:80 2>/dev/null; then
    print_status "OK" "Frontend is accessible"
else
    print_status "ERROR" "Frontend is not accessible"
    echo "Checking frontend logs..."
    docker-compose logs frontend
fi

# Check 6: Telegram Bot Token
echo "🔍 Check 6: Telegram Bot Token"
BOT_TOKEN=$(grep "BOT_TOKEN" .env | cut -d'=' -f2)
if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "your_telegram_bot_token" ]; then
    print_status "OK" "Telegram bot token is configured"
    
    # Test bot token
    if curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe" | grep -q '"ok":true'; then
        print_status "OK" "Telegram bot token is valid"
    else
        print_status "ERROR" "Telegram bot token is invalid"
    fi
else
    print_status "ERROR" "Telegram bot token is not configured"
fi

# Check 7: WebSocket Connection
echo "🔍 Check 7: WebSocket Connection"
if curl -f http://localhost:5678/ws/messages 2>/dev/null; then
    print_status "OK" "WebSocket endpoint is accessible"
else
    print_status "WARNING" "WebSocket endpoint may not be working"
fi

# Check 8: N8N Webhook URL
echo "🔍 Check 8: N8N Webhook URL"
N8N_URL=$(grep "N8N_WEBHOOK_URL" .env | cut -d'=' -f2)
if [ -n "$N8N_URL" ] && [ "$N8N_URL" != "http://yourdomain.com:5678/webhook/your_webhook_id" ]; then
    print_status "OK" "N8N webhook URL is configured"
    
    # Test webhook endpoint
    if curl -X POST "$N8N_URL" -H "Content-Type: application/json" -d '{"test": "data"}' 2>/dev/null; then
        print_status "OK" "N8N webhook is accessible"
    else
        print_status "WARNING" "N8N webhook may not be accessible"
    fi
else
    print_status "ERROR" "N8N webhook URL is not configured"
fi

# Check 9: Port Accessibility
echo "🔍 Check 9: Port Accessibility"
PORTS=(80 5678 9001 15672 5173)
for port in "${PORTS[@]}"; do
    if netstat -tuln | grep -q ":$port "; then
        print_status "OK" "Port $port is open"
    else
        print_status "ERROR" "Port $port is not open"
    fi
done

# Check 10: Firewall Configuration
echo "🔍 Check 10: Firewall Configuration"
if ufw status | grep -q "Status: active"; then
    print_status "OK" "Firewall is active"
    for port in "${PORTS[@]}"; do
        if ufw status | grep -q "$port"; then
            print_status "OK" "Port $port is allowed in firewall"
        else
            print_status "ERROR" "Port $port is not allowed in firewall"
            echo "Adding port $port to firewall..."
            ufw allow $port
        fi
    done
else
    print_status "WARNING" "Firewall is not active"
fi

# Check 11: Log Analysis
echo "🔍 Check 11: Log Analysis"
echo "Checking for errors in logs..."

# Check backend logs for errors
if docker-compose logs backend | grep -i "error\|exception\|traceback" | tail -5; then
    print_status "WARNING" "Found errors in backend logs"
else
    print_status "OK" "No errors found in backend logs"
fi

# Check frontend logs for errors
if docker-compose logs frontend | grep -i "error\|exception\|traceback" | tail -5; then
    print_status "WARNING" "Found errors in frontend logs"
else
    print_status "OK" "No errors found in frontend logs"
fi

# Check nginx logs for errors
if docker-compose logs nginx | grep -i "error\|exception\|traceback" | tail -5; then
    print_status "WARNING" "Found errors in nginx logs"
else
    print_status "OK" "No errors found in nginx logs"
fi

# Fix 1: Update Telegram webhook if needed
echo "🔧 Fix 1: Setting up Telegram webhook"
BOT_TOKEN=$(grep "BOT_TOKEN" .env | cut -d'=' -f2)
if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "your_telegram_bot_token" ]; then
    WEBHOOK_URL="http://$VPS_IP:5678/webhook/telegram"
    echo "Setting webhook URL: $WEBHOOK_URL"
    curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
         -H "Content-Type: application/json" \
         -d "{\"url\": \"$WEBHOOK_URL\"}"
    
    # Check webhook status
    WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo")
    if echo "$WEBHOOK_INFO" | grep -q '"ok":true'; then
        print_status "OK" "Telegram webhook is set up correctly"
    else
        print_status "ERROR" "Failed to set up Telegram webhook"
        echo "Webhook info: $WEBHOOK_INFO"
    fi
fi

# Fix 2: Ensure polling is working
echo "🔧 Fix 2: Ensuring Telegram polling is working"
if docker-compose logs backend | grep -q "Starting Telegram polling task"; then
    print_status "OK" "Telegram polling task is running"
else
    print_status "ERROR" "Telegram polling task is not running"
    echo "Restarting backend..."
    docker-compose restart backend
fi

# Fix 3: Check and fix frontend API configuration
echo "🔧 Fix 3: Checking frontend API configuration"
if grep -q "localhost" frontend/src/api/config.ts; then
    print_status "ERROR" "Frontend still using localhost"
    echo "Updating frontend API configuration..."
    sed -i "s/localhost/$VPS_IP/g" frontend/src/api/config.ts
    docker-compose restart frontend
else
    print_status "OK" "Frontend API configuration is correct"
fi

# Fix 4: Ensure WebSocket connections are enabled
echo "🔧 Fix 4: Checking WebSocket connections"
if grep -q "WebSocket connections temporarily disabled" frontend/src/context/ChatContext.tsx; then
    print_status "ERROR" "WebSocket connections are still disabled"
    echo "Re-enabling WebSocket connections..."
    # This would require the full ChatContext replacement from the deploy script
    print_status "WARNING" "Please run the deploy_and_fix.sh script to re-enable WebSocket connections"
else
    print_status "OK" "WebSocket connections are enabled"
fi

# Fix 5: Check database tables
echo "🔧 Fix 5: Checking database tables"
if docker exec backend python -c "
import asyncio
from crud import engine
async def check_tables():
    try:
        async with engine.begin() as conn:
            result = await conn.execute('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'')
            tables = [row[0] for row in result]
            print(f'Found tables: {tables}')
            if 'chats' in tables and 'messages' in tables:
                print('Required tables exist')
            else:
                print('Missing required tables')
    except Exception as e:
        print(f'Error checking tables: {e}')
asyncio.run(check_tables())
" 2>/dev/null | grep -q "Required tables exist"; then
    print_status "OK" "Database tables are properly set up"
else
    print_status "ERROR" "Database tables are missing"
    echo "Setting up database tables..."
    sudo -u postgres psql -d message_aggregator -f setup_database.sql
fi

# Performance check
echo "🔍 Performance Check"
echo "Checking container resource usage..."
docker stats --no-stream

echo "Checking disk usage..."
df -h

echo "Checking memory usage..."
free -h

# Final status report
echo ""
echo "📊 Final Status Report"
echo "======================"

# Count containers
RUNNING_CONTAINERS=$(docker-compose ps -q | wc -l)
TOTAL_CONTAINERS=$(docker-compose ps | grep -c "Up\|Exit")
echo "Containers: $RUNNING_CONTAINERS/$TOTAL_CONTAINERS running"

# Check if all services are responding
SERVICES=("http://localhost:80" "http://localhost:5678/health" "http://localhost:9001" "http://localhost:15672")
RESPONDING=0
for service in "${SERVICES[@]}"; do
    if curl -f "$service" >/dev/null 2>&1; then
        ((RESPONDING++))
    fi
done
echo "Services responding: $RESPONDING/${#SERVICES[@]}"

# Recommendations
echo ""
echo "💡 Recommendations:"
echo "1. Monitor logs: docker-compose logs -f"
echo "2. Test Telegram bot by sending a message"
echo "3. Check if messages appear in the frontend"
echo "4. Verify n8n webhook is receiving data"
echo "5. Set up SSL certificates for production"
echo "6. Configure proper backup strategy"
echo "7. Set up monitoring and alerting"

echo ""
echo "✅ Troubleshooting complete!"
echo "If issues persist, check the logs with: docker-compose logs -f" 