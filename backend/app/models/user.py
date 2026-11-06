"""
MongoDB User document model.

This module defines the User document structure stored in MongoDB.

Important Distinction:
- Model (this file): Represents database document structure
- Schema (schemas/user.py): Represents API request/response structure

Why separate them?
- Models know about database details (ObjectId, timestamps)
- Schemas handle API validation (hide hashed_password from responses)
- Keeps concerns separated for clean architecture

MongoDB User Document Example:
{
    "_id": ObjectId("507f1f77bcf86cd799439011"),
    "email": "john@example.com",
    "full_name": "John Doe",
    "hashed_password": "$2b$12$abcdef...",
    "role": "free",
    "documents_limit": 10,
    "is_active": true,
    "created_at": ISODate("2024-05-24T10:30:00Z"),
    "updated_at": ISODate("2024-05-24T10:30:00Z")
}
"""

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field, field_validator


class User(BaseModel):
    """
    User model representing a document in the MongoDB users collection.
    
    This is a Pydantic model that describes the structure of User documents
    in the database. It uses MongoDB's typical patterns.
    
    Attributes:
        id: MongoDB ObjectId as string (automatic MongoDB field: _id)
        email: User's email address (unique identifier)
        full_name: User's full name for display
        hashed_password: bcrypt-hashed password (NEVER plain text)
        role: User tier ("free" has document limits, "pro" has higher limits)
        documents_limit: Max documents user can upload
                        - free tier: 10
                        - pro tier: 100+
        is_active: Whether user account is enabled
        created_at: Account creation timestamp (UTC)
        updated_at: Last profile update timestamp (UTC)
    
    Pydantic Field Configuration:
    - alias="_id": MongoDB uses "_id" but Python prefers "id"
                   This mapping lets us use "id" in Python code
                   but read/write "_id" in MongoDB
    - default_factory=datetime.utcnow: Auto-set current time if not provided
    
    Example in database:
        {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "alice@example.com",
            "full_name": "Alice Johnson",
            "hashed_password": "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS5xLssnEWe1u",
            "role": "free",
            "documents_limit": 10,
            "is_active": true,
            "created_at": "2024-05-24T10:30:00Z",
            "updated_at": "2024-05-24T10:30:00Z"
        }
    """
    
    # User identification
    id: Optional[str] = Field(default=None, alias="_id", description="MongoDB ObjectId")
    email: EmailStr = Field(..., description="User email (unique, validated)")
    full_name: str = Field(..., min_length=1, max_length=100, description="User full name")
    
    # User profile
    bio: Optional[str] = Field(default=None, description="User biography")
    
    # Security
    hashed_password: str = Field(..., description="bcrypt hashed password (never plain text)")
    
    # User tier and limits
    role: str = Field(default="free", description="User role: 'free' or 'pro'")
    documents_limit: int = Field(default=10, description="Max documents user can upload")
    
    # Account status
    is_active: bool = Field(default=True, description="Whether account is active")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Account creation time")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update time")
    
    @field_validator("id", mode="before")
    @classmethod
    def convert_object_id_to_string(cls, v: Any) -> str | None:
        """
        Pydantic v2 field validator for 'id' field.
        
        Converts MongoDB ObjectId to string automatically.
        This handles both cases:
        - User({"id": ObjectId(...)}) from app code
        - User({"_id": ObjectId(...)}) from MongoDB (via alias)
        
        Args:
            v: Value to validate (ObjectId, string, or None)
            
        Returns:
            String representation of ObjectId or the original value
        """
        if isinstance(v, ObjectId):
            return str(v)
        return v
    
    class Config:
        """Pydantic configuration for User model."""
        # Allow population by field name (allow both "id" and "_id")
        populate_by_name = True
        # Use JSON serialization (allows datetime serialization)
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "email": "john@example.com",
                "full_name": "John Doe",
                "hashed_password": "$2b$12$...",
                "role": "free",
                "documents_limit": 10,
                "is_active": True,
                "created_at": "2024-05-24T10:30:00Z",
                "updated_at": "2024-05-24T10:30:00Z"
            }
        }
