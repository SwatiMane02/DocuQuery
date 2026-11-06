"""
MongoDB Conversation and Message document models.

This module defines the models for multi-turn chat sessions and persisted messages.
"""

from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    """
    Message model representing an individual turn in a conversation.
    """
    id: Optional[str] = Field(default=None, alias="_id", description="MongoDB ObjectId")
    conversation_id: str = Field(..., description="ID of parent conversation")
    user_id: str = Field(..., description="User ID who owns this message")
    from_user: str = Field(..., description="'user' or 'ai'")
    content: str = Field(..., description="Message text content")
    sources: Optional[List[dict]] = Field(default=None, description="Retrieved source chunks/citations")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")

    class Config:
        populate_by_name = True


class Conversation(BaseModel):
    """
    Conversation model representing a persistent chat session.
    """
    id: Optional[str] = Field(default=None, alias="_id", description="MongoDB ObjectId")
    user_id: str = Field(..., description="User ID who owns this conversation")
    title: str = Field(..., description="Conversation title")
    document_id: Optional[str] = Field(default=None, description="Optional scoped document ID")
    document_name: Optional[str] = Field(default=None, description="Optional scoped document name")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last message timestamp")

    class Config:
        populate_by_name = True
