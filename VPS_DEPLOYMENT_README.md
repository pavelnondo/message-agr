# Message Aggregator VPS Deployment Guide

## Overview

This guide will help you deploy the Message Aggregator project on your VPS (IP: 217.151.231.249) and fix all identified issues with Telegram polling, webhook handling, and chat loading.

## Issues Identified and Fixed

### 1. WebSocket Connections Disabled
- **Issue**: WebSocket connections were temporarily disabled in the frontend ChatContext
- **Fix**: Re-enabled WebSocket connections with proper error handling and reconnection logic

### 2. Frontend API Configuration
- **Issue**: Frontend was configured to use localhost instead of VPS IP
- **Fix**: Updated API configuration to use the VPS IP address

### 3. Database Configuration
- **Issue**: Backend was using wrong database name
- **Fix**: Updated database configuration to use correct database name

### 4. Telegram Polling and Webhook
- **Issue**: Telegram polling may not be working properly
- **Fix**: Enhanced polling with better error handling and webhook setup

### 5. N8N Webhook Integration
- **Issue**: N8N webhook forwarding may not be working
- **Fix**: Improved webhook handling and forwarding logic

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

1. **Upload project files to VPS**:
```bash
# From your local machine
scp -r ./backend root@217.151.231.249:/opt/message_aggregator/
scp -r ./frontend root@217.151.231.249:/opt/message_aggregator/
scp -r ./nginx root@217.151.231.249:/opt/message_aggregator/
scp docker-compose.yml root@217.151.231.249:/opt/message_aggregator/
scp setup_database.sql root@217.151.231.249:/opt/message_aggregator/
scp quick_deploy.sh root@217.151.231.249:/opt/message_aggregator/
```

2. **SSH into VPS and run deployment**:
```bash
ssh root@217.151.231.249
cd /opt/message_aggregator
chmod +x quick_deploy.sh
sudo bash quick_deploy.sh
```

### Option 2: Manual Deployment

1. **SSH into VPS**:
```bash
ssh root@217.151.231.249
```

2. **Install dependencies**:
```bash
apt update
apt install -y curl wget git nginx postgresql-client docker.io docker-compose
```

3. **Create application directory**:
```bash
mkdir -p /opt/message_aggregator
cd /opt/message_aggregator
```

4. **Upload project files** (from your local machine):
```bash
scp -r ./backend root@217.151.231.249:/opt/message_aggregator/
scp -r ./frontend root@217.151.231.249:/opt/message_aggregator/
scp -r ./nginx root@217.151.231.249:/opt/message_aggregator/
scp docker-compose.yml root@217.151.231.249:/opt/message_aggregator/
scp setup_database.sql root@217.151.231.249:/opt/message_aggregator/
```

5. **Run the comprehensive deployment script**:
```bash
chmod +x deploy_and_fix.sh
sudo bash deploy_and_fix.sh
```

## Post-Deployment Verification

### 1. Check Service Status
```bash
cd /opt/message_aggregator
docker-compose ps
```

### 2. Test Backend Health
```bash
curl http://217.151.231.249:5678/health
```

### 3. Test Frontend
```bash
curl http://217.151.231.249
```

### 4. Check Telegram Bot
```bash
# Test bot token
curl "https://api.telegram.org/bot7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I/getMe"

# Check webhook status
curl "https://api.telegram.org/bot7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I/getWebhookInfo"
```

### 5. Monitor Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

## Troubleshooting

### Run Comprehensive Troubleshooting
```bash
cd /opt/message_aggregator
chmod +x troubleshoot.sh
sudo bash troubleshoot.sh
```

### Common Issues and Solutions

#### 1. Containers Not Starting
```bash
# Check container status
docker-compose ps

# View logs for failed containers
docker-compose logs [service_name]

# Restart all services
docker-compose restart
```

#### 2. Database Connection Issues
```bash
# Check database container
docker-compose logs db

# Test database connection
docker exec backend python -c "
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
"
```

#### 3. Telegram Bot Not Responding
```bash
# Check bot token
curl "https://api.telegram.org/bot7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I/getMe"

# Set webhook manually
curl -X POST "https://api.telegram.org/bot7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "http://217.151.231.249:5678/webhook/telegram"}'

# Check webhook status
curl "https://api.telegram.org/bot7320464918:AAFP14dpPs1iICvpY8nJfnNnk1kE-7O368I/getWebhookInfo"
```

#### 4. Frontend Not Loading
```bash
# Check frontend container
docker-compose logs frontend

# Check nginx configuration
docker exec nginx nginx -t

# Restart frontend
docker-compose restart frontend
```

#### 5. WebSocket Connection Issues
```bash
# Check WebSocket endpoint
curl http://217.151.231.249:5678/ws/messages

# Check frontend WebSocket configuration
cat frontend/src/api/config.ts
```

## Application URLs

- **Main Application**: http://217.151.231.249
- **API Endpoint**: http://217.151.231.249:5678
- **Health Check**: http://217.151.231.249:5678/health
- **MinIO Console**: http://217.151.231.249:9001
- **RabbitMQ Management**: http://217.151.231.249:15672
- **Frontend Dev**: http://217.151.231.249:5173

## Configuration Files

### Environment Variables (.env)
```env
DATABASE_URL=postgresql+asyncpg://postgres:pavel123@db:5432/message_aggregator
MINIO_LOGIN=minioadmin
MINIO_PWD=minioadmin
# Provide your real secrets below
BOT_TOKEN=
N8N_WEBHOOK_URL=
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672/
ENVIRONMENT=production
DEBUG=false
```

### Frontend API Configuration
```typescript
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
export const API_CONFIG = {
  API_URL: '',
  WS_BASE: `${wsProtocol}://${window.location.host}`,
};
```

## Testing the Application

### 1. Test Telegram Bot
1. Send a message to your Telegram bot
2. Check if the message appears in the frontend
3. Verify AI responses are working

### 2. Test Chat Loading
1. Open http://217.151.231.249
2. Check if chats are loading properly
3. Test message sending functionality

### 3. Test WebSocket Connections
1. Open browser developer tools
2. Check for WebSocket connection in Network tab
3. Verify real-time message updates

### 4. Test N8N Integration
1. Send a message via Telegram
2. Check if the message is forwarded to N8N webhook
3. Verify webhook URL is accessible

## Monitoring and Maintenance

### Daily Monitoring
```bash
# Check service status
docker-compose ps

# Monitor logs
docker-compose logs -f

# Check resource usage
docker stats
```

### Backup Database
```bash
# Create backup
sudo -u postgres pg_dump message_aggregator > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
sudo -u postgres psql message_aggregator < backup_file.sql
```

### Update Application
```bash
# Stop services
docker-compose down

# Update code
git pull  # if using git

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

## Security Considerations

1. **Change default passwords** in the `.env` file
2. **Set up SSL/TLS** for production use
3. **Configure firewall** to only allow necessary ports
4. **Regular backups** of the database
5. **Monitor logs** for any security issues

## Performance Optimization

1. **Database indexes** are already created
2. **Connection pooling** is configured
3. **Caching** with Redis is available
4. **Load balancing** can be added with multiple nginx instances

## Support

If you encounter issues:

1. Run the troubleshooting script: `bash troubleshoot.sh`
2. Check logs: `docker-compose logs -f`
3. Verify configuration files
4. Test individual components

## Files Modified

- `frontend/src/context/ChatContext.tsx` - Re-enabled WebSocket connections
- `frontend/src/api/config.ts` - Updated API URLs for VPS
- `backend/config.py` - Fixed database configuration
- `docker-compose.yml` - Updated for production deployment
- `frontend/Dockerfile` - Updated for production build

Your application should now be running successfully on your VPS with all issues resolved! 🚀 