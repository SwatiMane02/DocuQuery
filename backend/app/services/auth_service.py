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

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.database import get_database
from app.models.user import User
from app.schemas.user import TokenData, UserCreate, UserLogin


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
        1. Check if email already exists (prevent duplicates)
        2. Hash the password using bcrypt
        3. Create User document in MongoDB
        4. Return created user
        
        Error Handling:
        - Raises ValueError if email already exists
        - MongoDB errors propagate (connection failures, etc.)
        
        Database Operation:
        This inserts a document into the users collection:
        {
            "email": "john@example.com",
            "full_name": "John Doe",
            "hashed_password": "$2b$12$...",
            "role": "free",
            "documents_limit": 10,
            "is_active": true,
            "created_at": "2024-05-24T10:30:00Z",
            "updated_at": "2024-05-24T10:30:00Z"
        }
        
        Args:
            user_create: UserCreate schema with email, password, full_name
            
        Returns:
            Created User object
            
        Raises:
            ValueError: If email already exists in database
        """
        users_collection = await AuthService._get_users_collection()
        
        # Check if user with this email already exists
        # db.users.findOne({ email: "john@example.com" })
        existing_user = await users_collection.find_one({"email": user_create.email})
        if existing_user:
            raise ValueError("Email already registered")
        
        # Hash the plain-text password
        # This is CRITICAL security step: never store plain passwords
        hashed_password = hash_password(user_create.password)
        
        # Create User document (ready for MongoDB)
        user = User(
            email=user_create.email,
            full_name=user_create.full_name,
            hashed_password=hashed_password,
            role="free",           # New users start with free tier
            documents_limit=10,    # Free tier: 10 documents
            is_active=True         # New accounts are active by default
        )
        
        # Insert document into MongoDB
        # MongoDB automatically generates _id field
        result = await users_collection.insert_one(user.model_dump(by_alias=True, exclude_none=True))
        
        # Set the MongoDB-generated _id on the user object
        user.id = str(result.inserted_id)
        
        return user
    
    @staticmethod
    async def authenticate_user(user_login: UserLogin) -> str:
        """
        Authenticate user and return JWT access token.
        
        Authentication Process:
        1. Find user by email in database
        2. Verify password matches stored hash
        3. Create JWT token containing user info
        4. Return token
        
        Error Handling:
        - Returns None if email not found
        - Returns None if password doesn't match
        - This lets route handler return generic "Invalid credentials" message
          (don't reveal whether email exists for security)
        
        Why verify_password?
        User sends: "MySecurePassword123!"
        Database has: "$2b$12$abcdef..." (bcrypt hash)
        bcrypt.verify() applies same algorithm to sent password and compares
        
        JWT Token Contains:
        {
            "sub": "john@example.com",      # User identifier
            "email": "john@example.com",    # Additional info
            "exp": 1234567890               # Expiration time
        }
        
        Args:
            user_login: UserLogin schema with email and password
            
        Returns:
            JWT access token string if credentials valid
            None if email not found or password incorrect
        """
        users_collection = await AuthService._get_users_collection()
        
        # Find user by email
        # db.users.findOne({ email: "john@example.com" })
        user_doc = await users_collection.find_one({"email": user_login.email})
        
        # User not found
        if not user_doc:
            return None
        
        # Convert MongoDB document to User object
        # Field validator in User model handles ObjectId → string conversion
        user = User(**user_doc)
        
        # Verify password
        # Compares: hash(provided_password) with stored_hash
        if not verify_password(user_login.password, user.hashed_password):
            # Password doesn't match
            return None
        
        # Create JWT token
        # Token expires in ACCESS_TOKEN_EXPIRE_MINUTES (from settings)
        token_data = {
            "sub": user.email,      # Subject = user's email
            "email": user.email     # Also include email in payload
        }
        
        access_token = create_access_token(
            data=token_data,
            # If not provided, uses ACCESS_TOKEN_EXPIRE_MINUTES from settings
        )
        
        return access_token
    
    @staticmethod
    async def get_user_by_email(email: str) -> User | None:
        """
        Get user from database by email address.
        
        Used to:
        - Verify email exists during login
        - Look up user after token decoding
        - Check email availability during registration
        
        Database Query:
        db.users.findOne({ email: "john@example.com" })
        
        Args:
            email: Email address to search for
            
        Returns:
            User object if found, None otherwise
        """
        users_collection = await AuthService._get_users_collection()
        
        user_doc = await users_collection.find_one({"email": email})
        
        if not user_doc:
            return None
        
        # Field validator in User model handles ObjectId → string conversion
        # No need for manual conversion here
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
        if not verify_password(current_password, user.hashed_password):
            return False

        new_hashed = hash_password(new_password)
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"hashed_password": new_hashed, "updated_at": datetime.utcnow()}}
        )
        return True


# Create singleton instance for use throughout app
auth_service = AuthService()
