import os
from typing import Optional

class Settings:
    # Database
    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "pavel"
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
    app_host: str = "localhost"
    minio_login: str = "minioadmin"
    minio_pwd: str = "minioadmin"
    
    # Monitoring
    prometheus_enabled: bool = True

settings = Settings()

# Database URL
DATABASE_URL = f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}" 