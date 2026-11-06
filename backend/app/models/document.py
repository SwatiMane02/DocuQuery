"""
MongoDB Document model for storing document metadata.

This model represents a document uploaded by a user in the system.
Stores metadata about the document (who uploaded, when, file info)
but NOT the actual file content (that's stored on disk).

Architecture:
- Document files: stored in backend/uploads/
- Document metadata: stored in MongoDB
- MongoDB record contains reference to file, not the file itself
- This separation allows efficient querying and management

Why separate metadata from files?
1. Database efficient: small metadata vs large file contents
2. Easy deletion: remove MongoDB record + delete file from disk
3. Queryable: search documents by metadata (date, type, etc)
4. Scalable: can move files to S3/cloud storage independently
"""

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, field_validator, model_validator


class Document(BaseModel):
    """
    Document model representing a file uploaded by a user.
    
    Fields:
        id: MongoDB ObjectId (auto-generated, unique)
        user_id: Reference to User._id (who uploaded this)
        filename: Original filename (e.g., "resume.pdf")
        file_type: MIME type (e.g., "application/pdf")
        file_size: File size in bytes
        upload_date: When document was uploaded (timestamp)
        status: Processing status ("uploaded", "processing", "indexed")
        file_path: Relative path where file is saved (e.g., "uploads/507f.../resume.pdf")
        storage_key: Unique identifier for the file on disk
    
    Example MongoDB document:
    {
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "user_id": ObjectId("507f1f77bcf86cd799439012"),
        "filename": "resume.pdf",
        "file_type": "application/pdf",
        "file_size": 245632,
        "upload_date": ISODate("2024-05-24T10:30:00Z"),
        "status": "uploaded",
        "file_path": "uploads/507f1f77bcf86cd799439011/resume.pdf",
        "storage_key": "507f1f77bcf86cd799439011_resume"
    }
    
    Why store file_path in metadata?
    - Quick reference for deletion/retrieval
    - Track where file is stored
    - Allow file organization in subdirectories
    - Enable file migration later (e.g., S3 upload)
    """
    
    # Document identification
    id: Optional[str] = Field(default=None, alias="_id", description="MongoDB ObjectId")
    user_id: str = Field(..., description="User who uploaded this document")
    
    # File information
    filename: str = Field(..., min_length=1, max_length=255, description="Original filename")
    file_type: str = Field(..., description="MIME type (e.g., application/pdf)")
    file_size: int = Field(..., ge=1, description="File size in bytes")
    
    # Storage and status
    file_path: Optional[str] = Field(default=None, description="Path where file is saved on disk")
    storage_key: Optional[str] = Field(default=None, description="Unique identifier for storage")
    secure_url: Optional[str] = Field(default=None, description="Cloudinary secure URL")
    public_id: Optional[str] = Field(default=None, description="Cloudinary public ID")
    
    # Timestamp
    upload_date: datetime = Field(default_factory=datetime.utcnow, description="Upload timestamp")
    
    # Processing
    status: str = Field(default="uploaded", description="Status: uploaded, processing, indexed, error")
    
    # Text extraction
    extracted_text: Optional[str] = Field(default=None, description="Extracted text content from document")
    text_length: Optional[int] = Field(default=None, description="Character count of extracted text")
    extraction_status: str = Field(default="pending", description="Extraction status: pending, extracted, failed")
    extraction_error: Optional[str] = Field(default=None, description="Error message if extraction failed")
    extraction_date: Optional[datetime] = Field(default=None, description="When text extraction completed")
    
    # Text chunking
    chunk_count: int = Field(default=0, description="Number of chunks created from extracted text")
    chunk_status: str = Field(default="pending", description="Chunking status: pending, chunked, failed")
    chunk_error: Optional[str] = Field(default=None, description="Error message if chunking failed")
    chunk_date: Optional[datetime] = Field(default=None, description="When chunking completed")
    processing_status: str = Field(default="uploaded", description="Overall status: uploaded, extracting, extracted, chunking, chunked, error")
    
    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        """
        Normalize legacy fields (uploaded_at, secure_url, public_id)
        from MongoDB to fit modern model definitions.
        """
        if isinstance(data, dict):
            # Map uploaded_at to upload_date if missing
            if "uploaded_at" in data and "upload_date" not in data:
                data["upload_date"] = data["uploaded_at"]
            # Map secure_url to file_path if missing
            if "secure_url" in data and not data.get("file_path"):
                data["file_path"] = data["secure_url"]
            # Map public_id to storage_key if missing
            if "public_id" in data and not data.get("storage_key"):
                data["storage_key"] = data["public_id"]
        return data

    @field_validator("id", mode="before")
    @classmethod
    def convert_object_id_to_string(cls, v: Any) -> str | None:
        """
        Pydantic v2 field validator for 'id' field.
        
        Converts MongoDB ObjectId to string automatically.
        Handles both:
        - User passing ObjectId via "id" field
        - MongoDB passing ObjectId via "_id" alias
        
        Args:
            v: Value to validate (ObjectId, string, or None)
            
        Returns:
            String representation of ObjectId or the original value
        """
        if isinstance(v, ObjectId):
            return str(v)
        return v
    
    
    class Config:
        """Pydantic configuration for Document model."""
        # Allow both "id" and "_id" field names
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "user_id": "507f1f77bcf86cd799439012",
                "filename": "research_paper.pdf",
                "file_type": "application/pdf",
                "file_size": 1024000,
                "upload_date": "2024-05-24T10:30:00Z",
                "status": "uploaded",
                "file_path": "uploads/507f1f77bcf86cd799439011/research_paper.pdf",
                "storage_key": "507f1f77bcf86cd799439011_research_paper",
                "extracted_text": "Introduction: This paper explores...",
                "text_length": 15234,
                "extraction_status": "extracted",
                "extraction_error": None,
                "extraction_date": "2024-05-24T10:30:15Z",
                "chunk_count": 15,
                "chunk_status": "chunked",
                "chunk_error": None,
                "chunk_date": "2024-05-24T10:30:20Z",
                "processing_status": "chunked"
            }
        }
