# Message Aggregator VPS Deployment Guide

## Prerequisites
- VPS with Ubuntu/Debian
- Existing PostgreSQL installation
- SSH access to your VPS

## Step 1: Connect to Your VPS
```bash
ssh root@217.151.231.249
```

## Step 2: Run the Deployment Script
```bash
# Download and run the deployment script
curl -O https://raw.githubusercontent.com/your-repo/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

## Step 3: Upload Your Application Files
You have several options:

### Option A: Using SCP (from your local machine)
```bash
scp -r ./backend root@217.151.231.249:/opt/message_aggregator/
scp -r ./frontend root@217.151.231.249:/opt/message_aggregator/
```

### Option B: Using Git (if you have a repository)
```bash
# On the VPS
cd /opt/message_aggregator
git clone <your-repository-url> .
```

### Option C: Manual upload
Upload the `backend/` and `frontend/` folders to `/opt/message_aggregator/` on your VPS.

## Step 4: Set Up the Database

### Connect to PostgreSQL
```bash
sudo -u postgres psql
```

### Create the database (if needed)
```sql
CREATE DATABASE message_aggregator;
```

### Run the database setup script
```bash
# On the VPS
cd /opt/message_aggregator
sudo -u postgres psql -d message_aggregator -f setup_database.sql
```

## Step 5: Configure Environment Variables

Edit the `.env` file with your actual credentials:

```bash
nano /opt/message_aggregator/.env
```

Update these values:
```env
# Database configuration - Use your existing PostgreSQL credentials
DATABASE_URL=postgresql+asyncpg://postgres:your_actual_password@localhost:5432/message_aggregator

# Telegram Bot configuration - Add your bot token
BOT_TOKEN=your_actual_telegram_bot_token

# N8N Webhook URL - Update with your domain
N8N_WEBHOOK_URL=http://217.151.231.249:5678/webhook/your_webhook_id
```

## Step 6: Build and Start the Application

```bash
cd /opt/message_aggregator

# Build the containers
docker-compose build

# Start all services
docker-compose up -d

# Check the status
docker-compose ps

# View logs
docker-compose logs -f
```

## Step 7: Configure Firewall (if needed)

```bash
# Allow HTTP and HTTPS
ufw allow 80
ufw allow 443
ufw allow 5678

# If you want to allow specific ports for management
ufw allow 9001  # MinIO console
ufw allow 15672 # RabbitMQ management
```

## Step 8: Test the Application

Your application will be available at:
- **Main Application**: http://217.151.231.249
- **API Endpoint**: http://217.151.231.249:5678
- **MinIO Console**: http://217.151.231.249:9001
- **RabbitMQ Management**: http://217.151.231.249:15672

## Step 9: Set Up Domain (Optional)

If you have a domain name:

1. Point your domain to your VPS IP: `217.151.231.249`
2. Update the `.env` file with your domain:
   ```env
   N8N_WEBHOOK_URL=http://yourdomain.com:5678/webhook/your_webhook_id
   ```
3. Restart the services:
   ```bash
   docker-compose restart
   ```

## Management Commands

### View logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Restart services
```bash
docker-compose restart
docker-compose restart backend
docker-compose restart frontend
```

### Stop all services
```bash
docker-compose down
```

### Update the application
```bash
cd /opt/message_aggregator
git pull  # if using git
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Check if services are running
```bash
docker ps
docker-compose ps
```

### Check database connection
```bash
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

### Check nginx configuration
```bash
docker exec nginx nginx -t
```

### View real-time logs
```bash
docker-compose logs -f --tail=100
```

## Security Considerations

1. **Change default passwords** in the `.env` file
2. **Set up SSL/TLS** for production use
3. **Configure firewall** to only allow necessary ports
4. **Regular backups** of the database
5. **Monitor logs** for any issues

## Backup Database

```bash
# Create a backup
sudo -u postgres pg_dump message_aggregator > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
sudo -u postgres psql message_aggregator < backup_file.sql
```

## Performance Optimization

1. **Database indexes** are already created in the setup script
2. **Connection pooling** is configured in the backend
3. **Caching** with Redis is available
4. **Load balancing** can be added with multiple nginx instances

Your application should now be running successfully on your VPS! 🚀 