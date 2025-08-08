import os
from typing import Optional


class Settings:
    """Application settings with environment overrides and safe defaults for Docker."""

    # Database
    db_host: str = os.getenv("DB_HOST", "db")
    db_port: int = int(os.getenv("DB_PORT", "5432"))
    db_name: str = os.getenv("DB_NAME", "message_aggregator")
    db_user: str = os.getenv("DB_USER", "postgres")
    db_password: str = os.getenv("DB_PASSWORD", "pavel123")

    # Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # RabbitMQ
    rabbitmq_url: str = os.getenv("RABBITMQ_URL", "amqp://admin:admin123@rabbitmq:5672/")

    # Telegram
    # Do NOT hardcode secrets. Must be provided via environment.
    bot_token: str = os.getenv("BOT_TOKEN", "")

    # n8n
    n8n_webhook_url: str = os.getenv("N8N_WEBHOOK_URL", "")
    api_url: Optional[str] = os.getenv("API_URL")

    # API Settings
    rate_limit: int = int(os.getenv("RATE_LIMIT", "60"))
    ai_timeout: int = int(os.getenv("AI_TIMEOUT", "30"))
    max_retries: int = int(os.getenv("MAX_RETRIES", "3"))

    # Application Settings
    app_host: str = os.getenv("HOST", "0.0.0.0")
    minio_login: str = os.getenv("MINIO_LOGIN", "minioadmin")
    minio_pwd: str = os.getenv("MINIO_PWD", "minioadmin")

    # Monitoring
    prometheus_enabled: bool = os.getenv("PROMETHEUS_ENABLED", "true").lower() == "true"


settings = Settings()

# Database URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}",
)