import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_database_url() -> str:
    """Get database URL from environment variables"""
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "pavel")
    DB_PORT = os.getenv("DB_PORT", "5432")
    
    return f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def get_app_config():
    """Get application configuration from environment variables"""
    return {
        "debug": os.getenv("DEBUG", "false").lower() == "true",
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": int(os.getenv("PORT", "3001")),
    } 