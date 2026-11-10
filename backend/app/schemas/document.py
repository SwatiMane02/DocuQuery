"""
Pydantic schemas for document upload and listing endpoints.

Schemas handle:
1. Upload file request validation
2. Document list response formatting
3. Document detail response
4. Error responses

Key differences from models:
- Schemas validate API input/output
- Models describe database storage
- Schemas may exclude sensitive fields (e.g., file_path not in response)
- Schemas enforce stricter validation for input (e.g., file types)
"""

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class DocumentResponse(BaseModel):
    """
    Schema for returning document information to client.
    
    What we send back to client when they upload or list documents.
    
    Important: Does NOT include file_path (that's internal)
    Client shouldn't know exact file storage location.
    
    Example response:
    {
        "id": "507f1f77bcf86cd799439011",
        "filename": "resume.pdf",
        "file_type": "application/pdf",
        "file_size": 245632,
        "upload_date": "2024-05-24T10:30:00Z",
        "status": "uploaded"
    }
    
    Attributes:
        id: Document identifier
        filename: Name of uploaded file
        file_type: MIME type
        file_size: Size in bytes
        upload_date: When uploaded
        status: Current processing status
    """
    
    id: Optional[str] = Field(None, alias="_id", description="Document ID")
    filename: str = Field(..., description="Filename")
    file_type: str = Field(..., description="MIME type")
    file_size: int = Field(..., description="File size in bytes")
    upload_date: datetime = Field(..., description="Upload timestamp")
    status: str = Field(..., description="Processing status")
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "filename": "research_paper.pdf",
                "file_type": "application/pdf",
                "file_size": 1024000,
                "upload_date": "2024-05-24T10:30:00Z",
                "status": "uploaded"
            }
        }


class DocumentListResponse(BaseModel):
    """
    Schema for listing all documents.
    
    Returns list of documents with pagination info.
    
    Example:
    {
        "documents": [
            {"id": "...", "filename": "...", ...},
            {"id": "...", "filename": "...", ...}
        ],
        "total": 25,
        "skip": 0,
        "limit": 10
    }
    
    Attributes:
        documents: List of DocumentResponse
        total: Total documents for user
        skip: Number skipped (for pagination)
        limit: Max documents returned
    """
    
    documents: List[DocumentResponse] = Field(
        ...,
        description="List of documents"
    )
    total: int = Field(..., ge=0, description="Total documents for user")
    skip: int = Field(default=0, ge=0, description="Documents skipped")
    limit: int = Field(default=10, ge=1, description="Documents returned")
    
    class Config:
        json_schema_extra = {
            "example": {
                "documents": [
                    {
                        "_id": "507f1f77bcf86cd799439011",
                        "filename": "resume.pdf",
                        "file_type": "application/pdf",
                        "file_size": 245632,
                        "upload_date": "2024-05-24T10:30:00Z",
                        "status": "uploaded"
                    }
                ],
                "total": 1,
                "skip": 0,
                "limit": 10
            }
        }


class DocumentDeleteResponse(BaseModel):
    """
    Schema for delete endpoint response.
    
    Example:
    {
        "message": "Document deleted successfully",
        "document_id": "507f1f77bcf86cd799439011",
        "filename": "resume.pdf"
    }
    
    Attributes:
        message: Confirmation message
        document_id: ID of deleted document
        filename: Filename that was deleted
    """
    
    message: str = Field(..., description="Confirmation message")
    document_id: str = Field(..., description="ID of deleted document")
    filename: str = Field(..., description="Filename that was deleted")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "Document deleted successfully",
                "document_id": "507f1f77bcf86cd799439011",
                "filename": "resume.pdf"
            }
        }


class UploadResponse(BaseModel):
    """
    Schema for successful file upload response.
    
    Returned when file is successfully uploaded and metadata saved.
    
    Example:
    {
        "message": "File uploaded successfully",
        "document_id": "507f1f77bcf86cd799439011",
        "filename": "resume.pdf",
        "file_size": 245632,
        "file_type": "application/pdf",
        "status": "uploaded"
    }
    
    Attributes:
        message: Confirmation message
        document_id: ID for future reference
        filename: Name of uploaded file
        file_size: Size in bytes
        file_type: MIME type
        status: Current status (always "uploaded" on success)
    """
    
    message: str = Field(..., description="Success message")
    document_id: str = Field(..., description="Document ID")
    filename: str = Field(..., description="Uploaded filename")
    file_size: int = Field(..., description="File size in bytes")
    file_type: str = Field(..., description="MIME type")
    status: str = Field(..., description="Status (uploaded)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "File uploaded successfully",
                "document_id": "507f1f77bcf86cd799439011",
                "filename": "resume.pdf",
                "file_size": 245632,
                "file_type": "application/pdf",
                "status": "uploaded"
            }
        }


class EmbeddingResponse(BaseModel):
    """
    Schema for document embedding generation response.
    
    Returned after successfully generating embeddings for all chunks
    of a document.
    
    Example:
    {
        "document_id": "507f1f77bcf86cd799439011",
        "chunks_processed": 42,
        "status": "completed"
    }
    
    Attributes:
        document_id: Document identifier
        chunks_processed: Number of chunks embedded
        status: Embedding generation status ("completed" or "failed")
    """
    
    document_id: str = Field(..., description="Document ID")
    chunks_processed: int = Field(..., ge=0, description="Number of chunks embedded")
    status: str = Field(..., description="Embedding status (completed or failed)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "507f1f77bcf86cd799439011",
                "chunks_processed": 42,
                "status": "completed"
            }
        }


# ============================================================================
# SEMANTIC SEARCH SCHEMAS
# ============================================================================

class SearchRequest(BaseModel):
    """
    Schema for semantic search request.
    
    User provides a natural language query to search across all document chunks
    using semantic similarity (not keyword matching).
    
    Example:
    {
        "query": "What programming languages and frameworks are used in this project?",
        "document_id": "507f1f77bcf86cd799439011"
    }
    
    Attributes:
        query: Natural language search query/question
        document_id: Optional document ID to scope search
    """
    
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Natural language search query"
    )
    document_id: Optional[str] = Field(
        default=None,
        description="Optional document ID to scope search"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "What technologies and frameworks does this use?",
                "document_id": "507f1f77bcf86cd799439011"
            }
        }


class SearchResultChunk(BaseModel):
    """
    Schema for a single semantic search result.
    
    Represents one document chunk that matched the search query,
    ranked by semantic similarity score.
    
    Example:
    {
        "chunk_index": 2,
        "score": 0.92,
        "content": "FastAPI is a modern web framework...",
        "document_id": "507f1f77bcf86cd799439011",
        "chunk_size": 512
    }
    
    Attributes:
        chunk_index: Position of chunk in original document
        score: Cosine similarity score (0.0 to 1.0, higher = more similar)
        content: Actual chunk text
        document_id: Parent document ID
        chunk_size: Number of tokens/characters in chunk
    """
    
    chunk_index: int = Field(..., ge=0, description="Chunk index in document")
    score: float = Field(..., ge=0.0, le=1.0, description="Similarity score (0-1)")
    content: str = Field(..., description="Chunk text content")
    document_id: str = Field(..., description="Parent document ID")
    chunk_size: int = Field(..., ge=0, description="Chunk size")
    
    class Config:
        json_schema_extra = {
            "example": {
                "chunk_index": 2,
                "score": 0.92,
                "content": "FastAPI is a modern, high-performance web framework for building APIs with Python...",
                "document_id": "507f1f77bcf86cd799439011",
                "chunk_size": 512
            }
        }


class SearchResponse(BaseModel):
    """
    Schema for semantic search response.
    
    Returns list of document chunks that match the user's query,
    ranked by semantic similarity (highest scores first).
    
    Workflow:
    1. Convert query to embedding
    2. Compare with all chunk embeddings
    3. Sort by cosine similarity
    4. Return top-k matches
    
    Example:
    {
        "query": "What is FastAPI?",
        "matches": [
            {
                "chunk_index": 0,
                "score": 0.95,
                "content": "FastAPI is...",
                "document_id": "507f1f77bcf86cd799439011",
                "chunk_size": 512
            },
            {
                "chunk_index": 3,
                "score": 0.87,
                "content": "FastAPI provides...",
                "document_id": "507f1f77bcf86cd799439011",
                "chunk_size": 512
            }
        ]
    }
    
    Attributes:
        query: The search query that was processed
        matches: List of SearchResultChunk objects, sorted by score (descending)
    """
    
    query: str = Field(..., description="Original search query")
    matches: List[SearchResultChunk] = Field(
        ...,
        description="Matched chunks ranked by similarity score (highest first)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "What is FastAPI?",
                "matches": [
                    {
                        "chunk_index": 0,
                        "score": 0.95,
                        "content": "FastAPI is a modern web framework...",
                        "document_id": "507f1f77bcf86cd799439011",
                        "chunk_size": 512
                    },
                    {
                        "chunk_index": 3,
                        "score": 0.87,
                        "content": "FastAPI provides async support...",
                        "document_id": "507f1f77bcf86cd799439011",
                        "chunk_size": 512
                    }
                ]
            }
        }


# ============================================================================
# CHAT SCHEMAS (RAG CHAT LAYER)
# ============================================================================

class ChatRequest(BaseModel):
    """
    Schema for RAG chat endpoint request.
    
    User sends a question that will be answered using document context.
    The question is processed through:
    1. Semantic retrieval to find relevant chunks
    2. Prompt building with context
    3. LLM generation for final answer
    
    Example:
    {
        "query": "What databases are mentioned in the documents?",
        "document_id": "507f1f77bcf86cd799439011"
    }
    
    Attributes:
        query: Natural language question to answer
        document_id: Optional document ID to scope chat
    """
    
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Natural language question to answer"
    )
    document_id: Optional[str] = Field(
        default=None,
        description="Optional document ID to scope chat"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "What technologies and frameworks are used?",
                "document_id": "507f1f77bcf86cd799439011"
            }
        }


class ChatSourceMetadata(BaseModel):
    """
    Schema for source document chunk metadata in chat response.
    
    Provides traceability: shows which document chunk was used
    to generate part of the LLM answer.
    
    Example:
    {
        "document_id": "507f1f77bcf86cd799439011",
        "chunk_index": 2,
        "score": 0.91
    }
    
    Attributes:
        document_id: Document the chunk came from
        chunk_index: Position in original document
        score: Semantic similarity score to the query
    """
    
    document_id: str = Field(..., description="Source document ID")
    chunk_index: int = Field(..., ge=0, description="Chunk index in document")
    score: float = Field(..., ge=0.0, le=1.0, description="Similarity score")
    content: Optional[str] = Field(default=None, description="Source chunk text content")
    document_name: Optional[str] = Field(default=None, description="Source document filename")

    @field_validator("score", mode="before")
    @classmethod
    def clamp_score(cls, v: Any) -> float:
        """Clamp cosine similarity score strictly to [0.0, 1.0] to prevent validation errors."""
        try:
            val = float(v)
            return round(max(0.0, min(1.0, val)), 4)
        except Exception:
            return 0.0
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "document_id": "507f1f77bcf86cd799439011",
                "chunk_index": 2,
                "score": 0.91,
                "content": "Sample chunk content snippet...",
                "document_name": "Sample.pdf"
            }
        }


class ChatResponse(BaseModel):
    """
    Schema for RAG chat endpoint response.
    
    Complete RAG pipeline output:
    1. Original query echoed back
    2. AI-generated answer from LLM
    3. Source chunks that were used for context
    4. Model metadata
    
    Example:
    {
        "query": "What databases are mentioned?",
        "answer": "MongoDB and PostgreSQL are mentioned in the documents...",
        "sources": [
            {
                "document_id": "507f1f77bcf86cd799439011",
                "chunk_index": 2,
                "score": 0.91
            },
            {
                "document_id": "507f1f77bcf86cd799439011",
                "chunk_index": 5,
                "score": 0.87
            }
        ],
        "model": "mistral",
        "num_chunks": 2
    }
    
    Attributes:
        query: Original question (echoed)
        answer: LLM-generated answer based on document context
        sources: List of chunks used for context (with metadata)
        model: LLM model that generated the answer
        num_chunks: Number of context chunks used
    """
    
    query: str = Field(..., description="Original question")
    answer: str = Field(..., description="LLM-generated answer from context")
    sources: List[ChatSourceMetadata] = Field(
        ...,
        description="Document chunks used for context"
    )
    model: str = Field(..., description="LLM model name used")
    num_chunks: int = Field(..., ge=0, description="Number of context chunks used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "What databases are mentioned?",
                "answer": "MongoDB and PostgreSQL are the databases mentioned in the documents.",
                "sources": [
                    {
                        "document_id": "507f1f77bcf86cd799439011",
                        "chunk_index": 2,
                        "score": 0.91
                    },
                    {
                        "document_id": "507f1f77bcf86cd799439011",
                        "chunk_index": 5,
                        "score": 0.87
                    }
                ],
                "model": "mistral",
                "num_chunks": 2
            }
        }

