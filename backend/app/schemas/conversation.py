"""
Pydantic schemas for Conversation and Message API endpoints.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.document import ChatSourceMetadata


class MessageResponse(BaseModel):
    id: str = Field(..., description="Message ID")
    conversation_id: str = Field(..., description="Conversation ID")
    from_user: str = Field(..., description="'user' or 'ai'")
    content: str = Field(..., description="Message content")
    sources: Optional[List[ChatSourceMetadata]] = Field(default=None, description="Source citations")
    created_at: datetime = Field(..., description="Message timestamp")

    class Config:
        populate_by_name = True


class ConversationCreate(BaseModel):
    title: Optional[str] = Field(default=None, description="Optional conversation title")
    document_id: Optional[str] = Field(default=None, description="Optional scoped document ID")
    document_name: Optional[str] = Field(default=None, description="Optional scoped document filename")


class ConversationUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, description="New conversation title")


class ConversationResponse(BaseModel):
    id: str = Field(..., description="Conversation ID")
    user_id: str = Field(..., description="User ID")
    title: str = Field(..., description="Conversation title")
    document_id: Optional[str] = Field(default=None, description="Scoped document ID")
    document_name: Optional[str] = Field(default=None, description="Scoped document filename")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last updated timestamp")

    class Config:
        populate_by_name = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


class ConversationDetailResponse(BaseModel):
    conversation: ConversationResponse
    messages: List[MessageResponse]


class SendMessageRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000, description="User question")
    document_id: Optional[str] = Field(default=None, description="Optional scoped document ID override")
