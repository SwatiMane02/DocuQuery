"""
Pydantic schemas for user API requests and responses.

This module defines data validation and serialization schemas used for:
1. Validating incoming API requests (UserCreate, UserLogin)
2. Formatting API responses (UserResponse, Token)
3. Internal token data (TokenData)

Why separate schemas from models?
- Models: Describe database structure (include _id, timestamps, hashed_password)
- Schemas: Describe API contracts (exclude sensitive data, validate input)
- API clients NEVER see hashed passwords or internal database details

Request Lifecycle:
1. Client sends JSON → FastAPI receives it
2. FastAPI validates against schema → Rejects invalid data
3. Valid data → Passed to route handler
4. Handler processes data
5. Handler returns domain object (User model)
6. FastAPI serializes using response schema → Sends JSON to client

Benefit:
- API never exposes hashed_password (security)
- Clear contract between frontend and backend
- Automatic validation saves boilerplate code
- Automatic OpenAPI/Swagger docs generation
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ============================================================================
# REQUEST SCHEMAS (What clients send to server)
# ============================================================================

class UserCreate(BaseModel):
    """
    Schema for user registration requests.
    
    Clients send this when creating a new account:
    {
        "email": "john@example.com",
        "password": "SecurePassword123!",
        "full_name": "John Doe"
    }
    
    Pydantic validates:
    - email: Valid email format (using EmailStr validator)
    - password: At least 8 characters, max 72 bytes (bcrypt limit)
    - full_name: Non-empty string, max 100 characters
    
    Important: This schema does NOT have a hashed_password field
    because clients send plain-text passwords, which the server hashes.
    
    BCRYPT PASSWORD LIMIT:
    - Bcrypt has a hard limit of 72 bytes per password
    - Passwords longer than 72 bytes are truncated silently
    - This creates a security risk: two different long passwords might hash the same
    - Solution: Enforce 72-byte limit at the schema level
    
    Attributes:
        email: Email address (must be valid format, unique in database)
        password: Plain-text password (server will hash before storing)
        full_name: User's full name for display
    """
    
    email: EmailStr = Field(
        ...,
        description="Email address (must be valid format)",
        example="john@example.com"
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="Plain-text password (8-72 characters, bcrypt limit enforced)"
    )
    full_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="User full name"
    )
    
    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Strip whitespace and lowercase email before validation."""
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator('password')
    @classmethod
    def validate_password_bytes(cls, v: str) -> str:
        """
        Validate password respects bcrypt's 72-byte limit.
        
        Bcrypt truncates passwords longer than 72 bytes, which could create
        a security vulnerability where two different passwords hash to the same value.
        
        This validator catches this issue before hashing.
        """
        password_bytes = v.encode('utf-8')
        if len(password_bytes) > 72:
            raise ValueError(
                f'Password exceeds bcrypt limit: {len(password_bytes)} bytes > 72 bytes. '
                f'Please use a shorter password.'
            )
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "john@example.com",
                "password": "SecurePassword123!",
                "full_name": "John Doe"
            }
        }


class UserLogin(BaseModel):
    """
    Schema for login requests.
    
    Clients send this when logging in:
    {
        "email": "john@example.com",
        "password": "SecurePassword123!"
    }
    
    The server receives this, verifies the password against stored hash,
    and returns an access token if credentials are valid.
    
    Attributes:
        email: Email address of account
        password: Plain-text password to verify
    """
    
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., description="Plain-text password")
    
    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Strip whitespace and lowercase email before validation."""
        if isinstance(v, str):
            return v.strip().lower()
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "john@example.com",
                "password": "SecurePassword123!"
            }
        }


# ============================================================================
# RESPONSE SCHEMAS (What server sends to clients)
# ============================================================================

class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Updated full name")
    bio: Optional[str] = Field(None, max_length=500, description="Updated biography")


class PasswordChangeRequest(BaseModel):
    """Schema for changing password."""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=72, description="New password")


class UserResponse(BaseModel):
    """
    Schema for user profile responses.
    
    Sent to clients in responses to registration and GET /auth/me requests.
    """
    id: Optional[str] = Field(None, alias="_id", description="User ID")
    email: EmailStr = Field(..., description="User email")
    full_name: str = Field(..., description="User full name")
    bio: Optional[str] = Field(default=None, description="User biography")
    role: str = Field(..., description="User role (free/pro)")
    documents_limit: int = Field(..., description="Document upload limit")
    is_active: bool = Field(..., description="Whether account is active")
    created_at: datetime = Field(..., description="Account creation time")
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "email": "john@example.com",
                "full_name": "John Doe",
                "role": "free",
                "documents_limit": 10,
                "is_active": True,
                "created_at": "2024-05-24T10:30:00Z"
            }
        }


class Token(BaseModel):
    """
    Schema for token responses.
    
    Sent to clients after successful login/registration.
    
    Response example:
    {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer"
    }
    
    Note: token_type="bearer" is OAuth2 standard
    Client uses: Authorization: Bearer <access_token>
    
    Attributes:
        access_token: JWT token to include in future requests
        token_type: Always "bearer" (OAuth2 standard)
    """
    
    access_token: str = Field(
        ...,
        description="JWT access token (include in Authorization header)"
    )
    token_type: str = Field(
        default="bearer",
        description="Token type (always 'bearer' for JWT)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwiZXhwIjoxMjM0NTY3ODkwfQ...",
                "token_type": "bearer"
            }
        }


# ============================================================================
# INTERNAL SCHEMAS (Used within the application)
# ============================================================================

class TokenData(BaseModel):
    """
    Schema representing decoded JWT token payload.
    
    This is NOT sent to clients. It's used internally when a token is decoded.
    
    When we receive a JWT token and decode it, we extract this data:
    {
        "sub": "user@example.com",
        "email": "user@example.com"
    }
    
    The "sub" (subject) claim typically contains the user identifier.
    We use this to look up the user in the database.
    
    Attributes:
        sub: Subject claim (typically user's email or ID)
        email: Email from token payload
    """
    
    sub: Optional[str] = Field(
        None,
        description="Subject claim (user identifier from token)"
    )
    email: Optional[str] = Field(None, description="Email from token")
    
    class Config:
        json_schema_extra = {
            "example": {
                "sub": "user@example.com",
                "email": "user@example.com"
            }
        }
