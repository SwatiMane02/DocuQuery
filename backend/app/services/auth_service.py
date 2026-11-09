"""
Authentication service with business logic for user operations.

This module contains the core authentication logic:
1. User registration (create account)
2. User authentication (verify credentials)
3. User lookup
4. Current user retrieval (from JWT token)

Architecture Pattern - Service Layer:
- Routes (api/auth.py): Handle HTTP requests/responses
- Service (this file): Contains business logic
- Models/Schemas: Define data structures
- Database: Stores data

Benefits:
- Business logic is independent of HTTP details
- Easy to test (can call service without HTTP)
- Reusable across different routes or contexts
- Single Responsibility Principle

Error Handling Strategy:
- Raise HTTPException from routes (HTTP layer)
- Services return None or raise business exceptions
- Routes translate business errors to HTTP errors
"""

from datetime import timedelta
import logging
import re
import time

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_password_async,
    verify_password,
    verify_password_async,
)
from app.db.database import get_database
from app.models.user import User
from app.schemas.user import TokenData, UserCreate, UserLogin

logger = logging.getLogger("app.auth")


def mask_email(email: str) -> str:
    """Mask email for safe diagnostic logging without leaking user PII."""
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    masked_local = local[0] + "***" if len(local) > 1 else "***"
    return f"{masked_local}@{domain}"


class AuthService:
    """
    Service for authentication operations.
    
    Handles user registration, login, and token-based user retrieval.
    This class provides the business logic layer, separating HTTP concerns
    from authentication logic.
    
    Methods are async because MongoDB operations are async (using Motor).
    
    Usage Example:
        auth_service = AuthService()
        user = await auth_service.register_user(user_create_schema)
        token = await auth_service.authenticate_user(user_login_schema)
    """
    
    def __init__(self):
        """Initialize the auth service."""
        pass
    
    @staticmethod
    async def _get_users_collection():
        """
        Get the MongoDB users collection.
        
        MongoDB organization:
        Database (docuquery)
        └── Collections (tables)
            ├── users
            ├── documents
            └── ...
        
        Returns:
            Motor AsyncIOMotorCollection for users
        """
        db: AsyncIOMotorDatabase = get_database()
        return db["users"]
    
    @staticmethod
    async def register_user(user_create: UserCreate) -> User:
        """
        Register a new user.
        
        Process:
        1. Normalize email (strip and lowercase)
        2. Check if email already exists (case-insensitively to prevent duplicates)
        3. Hash the password using bcrypt in worker thread
        4. Create User document in MongoDB
        5. Return created user
        """
        start_time = time.perf_counter()
        clean_email = user_create.email.strip().lower()
        masked = mask_email(clean_email)
        
        users_collection = await AuthService._get_users_collection()
        
        # Check if user with this email already exists (case-insensitive check)
        existing_user = await users_collection.find_one(
            {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
        )
        if existing_user:
            logger.info("Registration rejected: email %s already registered", masked)
            raise ValueError("Email already registered")
        
        # Hash the plain-text password off the event loop
        hashed_password = await hash_password_async(user_create.password)
        
        # Create User document with normalized email
        user = User(
            email=clean_email,
            full_name=user_create.full_name.strip(),
            hashed_password=hashed_password,
            role="free",           # New users start with free tier
            documents_limit=10,    # Free tier: 10 documents
            is_active=True         # New accounts are active by default
        )
        
        # Insert document into MongoDB
        result = await users_collection.insert_one(user.model_dump(by_alias=True, exclude_none=True))
        user.id = str(result.inserted_id)
        
        duration = time.perf_counter() - start_time
        logger.info("Registration successful for %s (total: %.3fs)", masked, duration)
        return user
    
    @staticmethod
    async def authenticate_user(user_login: UserLogin) -> str | None:
        """
        Authenticate user and return JWT access token.
        
        Authentication Process:
        1. Normalize email (strip and lowercase)
        2. Find user by email in database (direct match with case-insensitive fallback)
        3. Verify password matches stored hash off the event loop
        4. Check account is active
        5. Create and return JWT access token
        """
        start_time = time.perf_counter()
        clean_email = user_login.email.strip().lower()
        masked = mask_email(clean_email)
        
        users_collection = await AuthService._get_users_collection()
        
        # 1. User lookup: try direct match first (uses unique index), fallback to case-insensitive
        lookup_start = time.perf_counter()
        user_doc = await users_collection.find_one({"email": clean_email})
        if not user_doc:
            user_doc = await users_collection.find_one(
                {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
            )
        lookup_duration = time.perf_counter() - lookup_start
        
        if not user_doc:
            total_duration = time.perf_counter() - start_time
            logger.warning(
                "Authentication failed: user not found for %s (lookup: %.3fs, total: %.3fs)",
                masked, lookup_duration, total_duration
            )
            return None
        
        # Convert MongoDB document to User object
        user = User(**user_doc)
        
        # 2. Check active status
        if not user.is_active:
            total_duration = time.perf_counter() - start_time
            logger.warning(
                "Authentication failed: account is inactive for %s (total: %.3fs)",
                masked, total_duration
            )
            return None
        
        # 3. Verify password in background thread to avoid event loop blocking
        verify_start = time.perf_counter()
        is_valid = await verify_password_async(user_login.password, user.hashed_password)
        verify_duration = time.perf_counter() - verify_start
        
        if not is_valid:
            total_duration = time.perf_counter() - start_time
            logger.warning(
                "Authentication failed: password mismatch for %s (verify: %.3fs, total: %.3fs)",
                masked, verify_duration, total_duration
            )
            return None
        
        # 4. Create JWT token
        token_data = {
            "sub": user.email,
            "email": user.email
        }
        access_token = create_access_token(data=token_data)
        
        total_duration = time.perf_counter() - start_time
        logger.info(
            "Authentication successful for %s (lookup: %.3fs, verify: %.3fs, total: %.3fs)",
            masked, lookup_duration, verify_duration, total_duration
        )
        return access_token
    
    @staticmethod
    async def get_user_by_email(email: str) -> User | None:
        """
        Get user from database by email address.
        Supports both normalized lowercase and existing legacy mixed-case accounts.
        """
        clean_email = email.strip().lower()
        users_collection = await AuthService._get_users_collection()
        
        user_doc = await users_collection.find_one({"email": clean_email})
        if not user_doc:
            user_doc = await users_collection.find_one(
                {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
            )
        
        if not user_doc:
            return None
        
        return User(**user_doc)
    
    @staticmethod
    async def get_current_user(token: str) -> User | None:
        """
        Get current user from JWT token.
        
        This is called by FastAPI dependency injection in protected routes.
        
        Process:
        1. Decode JWT token
        2. Extract user email from token payload
        3. Look up user in database by email
        4. Return user object
        
        Error Scenarios:
        - Invalid token: decode_access_token returns None
        - Expired token: decode_access_token returns None
        - User email in token but user deleted: get_user_by_email returns None
        - Valid token and user exists: Return user
        
        Why check database?
        - User could have deleted their account after token was issued
        - User could have changed email (if we support that)
        - User could be deactivated (is_active=False)
        - Keeps auth state in sync with database
        
        Example Token Payload:
        {
            "sub": "john@example.com",
            "email": "john@example.com",
            "exp": 1234567890
        }
        
        Args:
            token: JWT token from Authorization header
            
        Returns:
            User object if token valid and user exists, None otherwise
        """
        # Decode and verify JWT token
        payload = decode_access_token(token)
        
        # Token invalid or expired
        if payload is None:
            return None
        
        # Extract email from token payload
        # "sub" (subject) claim contains user identifier (email in our case)
        email = payload.get("sub")
        
        if email is None:
            return None
        
        # Look up user in database
        user = await AuthService.get_user_by_email(email)
        
        return user

    @staticmethod
    async def update_profile(user_id: str, data: dict) -> User | None:
        """Update user profile fields (e.g. full_name, bio)."""
        from bson import ObjectId
        from datetime import datetime

        users_collection = await AuthService._get_users_collection()
        update_data = {k: v for k, v in data.items() if v is not None}
        if not update_data:
            user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
            return User(**user_doc) if user_doc else None

        update_data["updated_at"] = datetime.utcnow()
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )

        updated_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
        return User(**updated_doc) if updated_doc else None

    @staticmethod
    async def change_password(user_id: str, current_password: str, new_password: str) -> bool:
        """Verify current password and set new password."""
        from bson import ObjectId
        from datetime import datetime

        users_collection = await AuthService._get_users_collection()
        user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            return False

        user = User(**user_doc)
        if not await verify_password_async(current_password, user.hashed_password):
            return False

        new_hashed = await hash_password_async(new_password)
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"hashed_password": new_hashed, "updated_at": datetime.utcnow()}}
        )
        return True


# Create singleton instance for use throughout app
auth_service = AuthService()
