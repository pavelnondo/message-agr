# N8N Workflow Database Deployment Guide

This guide will help you set up the database tables and update the application to work with the n8n workflow requirements.

## Overview

The database schema has been updated to support the n8n workflow with the following tables:

1. **`bot_settings`** - Stores AI configuration (system messages, FAQs)
2. **`chats`** - Tracks chat sessions and manager confirmation status
3. **`messages`** - Stores conversation history with question/answer types

## Prerequisites

- PostgreSQL installed and running on your VPS
- Access to the VPS via SSH
- The updated code files

## Step 1: Database Setup

### On the VPS, run the database setup:

```bash
# Connect to your VPS
ssh your-user@your-vps-ip

# Navigate to the project directory
cd /path/to/message_aggregator

# Make the deployment script executable (if on Linux)
chmod +x deploy_database.sh

# Run the database deployment
./deploy_database.sh
```

### Manual Database Setup (if script fails):

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database (if it doesn't exist)
CREATE DATABASE message_aggregator;

# Connect to the database
\c message_aggregator

# Exit psql
\q

# Apply the schema
sudo -u postgres psql -d message_aggregator -f setup_database.sql
```

## Step 2: Verify Database Setup

Check that the tables were created correctly:

```bash
sudo -u postgres psql -d message_aggregator -c "\dt"
```

You should see:
- `bot_settings`
- `chats` 
- `messages`

Check that bot settings were populated:

```bash
sudo -u postgres psql -d message_aggregator -c "SELECT key FROM bot_settings;"
```

You should see:
- `system_message`
- `faqs`

## Step 3: Update Application

The backend and frontend have been updated to work with the new schema. The changes include:

### Backend Changes:
- Updated database models in `backend/crud.py`
- Updated API endpoints in `backend/main.py`
- New bot settings API endpoints
- Simplified chat and message structure

### Frontend Changes:
- Updated API types in `frontend/src/api/api.ts`
- Updated endpoints in `frontend/src/api/config.ts`
- New bot settings management

## Step 4: Deploy Updated Application

### Option A: Using Docker Compose

```bash
# Stop the current services
docker-compose down

# Rebuild and start with new code
docker-compose up -d --build
```

### Option B: Manual Deployment

```bash
# Restart the backend service
sudo systemctl restart message-aggregator

# Check the logs
sudo journalctl -u message-aggregator -f

# Test the API
curl http://localhost:3001/health
```

## Step 5: Test the Application

### Test API Endpoints:

```bash
# Health check
curl http://localhost:3001/health

# Get bot settings
curl http://localhost:3001/api/bot-settings

# Get chats
curl http://localhost:3001/api/chats

# Get stats
curl http://localhost:3001/api/stats
```

### Test Frontend:

1. Open your browser and navigate to the application
2. Check that the chat interface loads correctly
3. Verify that messages display properly
4. Test sending messages

## Step 6: Configure n8n Integration

The database is now ready for n8n workflow integration. The key features:

### Database Tables for n8n:

1. **`bot_settings`** - Contains:
   - `system_message`: AI operational instructions
   - `faqs`: FAQ answers and brand information

2. **`chats`** - Contains:
   - `user_id`: Telegram user ID
   - `is_awaiting_manager_confirmation`: Flag for manager review

3. **`messages`** - Contains:
   - `message_type`: 'question' or 'answer'
   - `message`: The actual message content

### API Endpoints for n8n:

- `GET /api/bot-settings` - Get all bot settings
- `GET /api/bot-settings/{key}` - Get specific setting
- `PUT /api/bot-settings/{key}` - Update setting
- `GET /api/chats` - Get all chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/{id}/messages` - Get chat messages
- `POST /api/messages` - Create new message

## Troubleshooting

### Database Issues:

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connection
sudo -u postgres psql -d message_aggregator -c "SELECT version();"

# Check table structure
sudo -u postgres psql -d message_aggregator -c "\d chats"
sudo -u postgres psql -d message_aggregator -c "\d messages"
sudo -u postgres psql -d message_aggregator -c "\d bot_settings"
```

### Application Issues:

```bash
# Check backend logs
sudo journalctl -u message-aggregator -f

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Test API directly
curl -v http://localhost:3001/health
```

### Common Issues:

1. **Database connection errors**: Check PostgreSQL is running and accessible
2. **Permission errors**: Ensure the application user has database access
3. **API errors**: Check the backend logs for specific error messages
4. **Frontend not loading**: Check nginx configuration and logs

## Next Steps

1. **Configure n8n workflow** to use the new API endpoints
2. **Set up Telegram webhook** to point to your application
3. **Test the complete workflow** from Telegram message to AI response
4. **Monitor the application** using the provided metrics endpoint

## API Documentation

### Chat Endpoints:

```bash
# Get all chats
GET /api/chats

# Get specific chat
GET /api/chats/{id}

# Create new chat
POST /api/chats
{
  "user_id": "telegram_user_id"
}

# Update chat
PUT /api/chats/{id}
{
  "is_awaiting_manager_confirmation": true
}

# Delete chat
DELETE /api/chats/{id}
```

### Message Endpoints:

```bash
# Get chat messages
GET /api/chats/{id}/messages

# Create message
POST /api/messages
{
  "chat_id": 123,
  "message": "Hello!",
  "message_type": "question"
}
```

### Bot Settings Endpoints:

```bash
# Get all settings
GET /api/bot-settings

# Get specific setting
GET /api/bot-settings/system_message

# Update setting
PUT /api/bot-settings/system_message
{
  "value": "New system message content"
}
```

## Support

If you encounter issues:

1. Check the logs: `sudo journalctl -u message-aggregator -f`
2. Verify database connectivity
3. Test API endpoints directly
4. Check nginx configuration and logs

The application is now ready to work with your n8n workflow!
