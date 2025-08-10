import os
from dotenv import load_dotenv

# Load environment variables from a local .env if present (useful for local dev).
load_dotenv()


def get_database_url() -> str:
    """Resolve database URL with precedence to DATABASE_URL env, else construct from parts."""
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    db_host = os.getenv("DB_HOST", "db")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "pavel123")
    db_name = os.getenv("DB_NAME", "message_aggregator")
    db_port = os.getenv("DB_PORT", "5432")

    return f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

def get_app_config():
    """Get application configuration from environment variables"""
    return {
        "debug": os.getenv("DEBUG", "false").lower() == "true",
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": int(os.getenv("PORT", "5678")),
    }