from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime
from auth import UserRegister, UserResponse
from shared import get_database_url
from sqlalchemy import create_async_engine, text
import logging

logger = logging.getLogger(__name__)

# Database engine for user operations
DATABASE_URL = get_database_url()
engine = create_async_engine(DATABASE_URL, echo=False)

async def create_user(db: AsyncSession, user_data: UserRegister, password_hash: str) -> Optional[Dict[str, Any]]:
    """Create a new user"""
    try:
        # Check if username already exists
        existing_user = await get_user_by_username(db, user_data.username)
        if existing_user:
            logger.warning(f"Username {user_data.username} already exists")
            return None
        
        # Check if email already exists
        if user_data.email:
            existing_email = await get_user_by_email(db, user_data.email)
            if existing_email:
                logger.warning(f"Email {user_data.email} already exists")
                return None
        
        # Insert new user
        query = text("""
            INSERT INTO users (username, email, password_hash, tenant_id, is_admin, is_active, created_at, updated_at)
            VALUES (:username, :email, :password_hash, :tenant_id, :is_admin, :is_active, :created_at, :updated_at)
            RETURNING id, username, email, tenant_id, is_admin, is_active, created_at, updated_at
        """)
        
        result = await db.execute(query, {
            "username": user_data.username,
            "email": user_data.email,
            "password_hash": password_hash,
            "tenant_id": user_data.tenant_id,
            "is_admin": False,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        user_row = result.fetchone()
        await db.commit()
        
        if user_row:
            return {
                "id": user_row[0],
                "username": user_row[1],
                "email": user_row[2],
                "tenant_id": user_row[3],
                "is_admin": user_row[4],
                "is_active": user_row[5],
                "created_at": user_row[6],
                "updated_at": user_row[7]
            }
        return None
        
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        await db.rollback()
        return None

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[Dict[str, Any]]:
    """Get user by username"""
    try:
        query = text("""
            SELECT id, username, email, password_hash, tenant_id, is_admin, is_active, created_at, updated_at
            FROM users 
            WHERE username = :username AND is_active = TRUE
        """)
        
        result = await db.execute(query, {"username": username})
        user_row = result.fetchone()
        
        if user_row:
            return {
                "id": user_row[0],
                "username": user_row[1],
                "email": user_row[2],
                "password_hash": user_row[3],
                "tenant_id": user_row[4],
                "is_admin": user_row[5],
                "is_active": user_row[6],
                "created_at": user_row[7],
                "updated_at": user_row[8]
            }
        return None
        
    except Exception as e:
        logger.error(f"Error getting user by username: {e}")
        return None

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[Dict[str, Any]]:
    """Get user by email"""
    try:
        query = text("""
            SELECT id, username, email, password_hash, tenant_id, is_admin, is_active, created_at, updated_at
            FROM users 
            WHERE email = :email AND is_active = TRUE
        """)
        
        result = await db.execute(query, {"email": email})
        user_row = result.fetchone()
        
        if user_row:
            return {
                "id": user_row[0],
                "username": user_row[1],
                "email": user_row[2],
                "password_hash": user_row[3],
                "tenant_id": user_row[4],
                "is_admin": user_row[5],
                "is_active": user_row[6],
                "created_at": user_row[7],
                "updated_at": user_row[8]
            }
        return None
        
    except Exception as e:
        logger.error(f"Error getting user by email: {e}")
        return None

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID"""
    try:
        query = text("""
            SELECT id, username, email, password_hash, tenant_id, is_admin, is_active, created_at, updated_at
            FROM users 
            WHERE id = :user_id AND is_active = TRUE
        """)
        
        result = await db.execute(query, {"user_id": user_id})
        user_row = result.fetchone()
        
        if user_row:
            return {
                "id": user_row[0],
                "username": user_row[1],
                "email": user_row[2],
                "password_hash": user_row[3],
                "tenant_id": user_row[4],
                "is_admin": user_row[5],
                "is_active": user_row[6],
                "created_at": user_row[7],
                "updated_at": user_row[8]
            }
        return None
        
    except Exception as e:
        logger.error(f"Error getting user by ID: {e}")
        return None

async def get_users_by_tenant(db: AsyncSession, tenant_id: str) -> List[Dict[str, Any]]:
    """Get all users for a specific tenant"""
    try:
        query = text("""
            SELECT id, username, email, tenant_id, is_admin, is_active, created_at, updated_at
            FROM users 
            WHERE tenant_id = :tenant_id AND is_active = TRUE
            ORDER BY username
        """)
        
        result = await db.execute(query, {"tenant_id": tenant_id})
        users = []
        
        for row in result.fetchall():
            users.append({
                "id": row[0],
                "username": row[1],
                "email": row[2],
                "tenant_id": row[3],
                "is_admin": row[4],
                "is_active": row[5],
                "created_at": row[6],
                "updated_at": row[7]
            })
        
        return users
        
    except Exception as e:
        logger.error(f"Error getting users by tenant: {e}")
        return []

async def update_user(db: AsyncSession, user_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update user information"""
    try:
        # Build dynamic update query
        set_clauses = []
        params = {"user_id": user_id}
        
        for key, value in update_data.items():
            if key in ["username", "email", "tenant_id", "is_admin", "is_active"]:
                set_clauses.append(f"{key} = :{key}")
                params[key] = value
        
        if not set_clauses:
            return None
        
        set_clauses.append("updated_at = :updated_at")
        params["updated_at"] = datetime.utcnow()
        
        query = text(f"""
            UPDATE users 
            SET {', '.join(set_clauses)}
            WHERE id = :user_id
            RETURNING id, username, email, tenant_id, is_admin, is_active, created_at, updated_at
        """)
        
        result = await db.execute(query, params)
        user_row = result.fetchone()
        await db.commit()
        
        if user_row:
            return {
                "id": user_row[0],
                "username": user_row[1],
                "email": user_row[2],
                "tenant_id": user_row[3],
                "is_admin": user_row[4],
                "is_active": user_row[5],
                "created_at": user_row[6],
                "updated_at": user_row[7]
            }
        return None
        
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        await db.rollback()
        return None

async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """Soft delete user (set is_active to False)"""
    try:
        query = text("""
            UPDATE users 
            SET is_active = FALSE, updated_at = :updated_at
            WHERE id = :user_id
        """)
        
        result = await db.execute(query, {
            "user_id": user_id,
            "updated_at": datetime.utcnow()
        })
        
        await db.commit()
        return result.rowcount > 0
        
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        await db.rollback()
        return False

async def get_all_tenants(db: AsyncSession) -> List[Dict[str, Any]]:
    """Get all available tenants"""
    try:
        query = text("""
            SELECT DISTINCT tenant_id 
            FROM tenant_settings 
            ORDER BY tenant_id
        """)
        
        result = await db.execute(query)
        tenants = [{"tenant_id": row[0]} for row in result.fetchall()]
        return tenants
        
    except Exception as e:
        logger.error(f"Error getting tenants: {e}")
        return []

async def create_tenant(db: AsyncSession, tenant_id: str, system_message: str = "", handover_mode: str = "ask", language: str = "en") -> bool:
    """Create a new tenant with default settings"""
    try:
        query = text("""
            INSERT INTO tenant_settings (tenant_id, system_message, handover_mode, language, thresholds, created_at, updated_at)
            VALUES (:tenant_id, :system_message, :handover_mode, :language, '{}'::jsonb, :created_at, :updated_at)
            ON CONFLICT (tenant_id) DO NOTHING
        """)
        
        result = await db.execute(query, {
            "tenant_id": tenant_id,
            "system_message": system_message,
            "handover_mode": handover_mode,
            "language": language,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        await db.commit()
        return result.rowcount > 0
        
    except Exception as e:
        logger.error(f"Error creating tenant: {e}")
        await db.rollback()
        return False
