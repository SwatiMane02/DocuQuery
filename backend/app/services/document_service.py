"""
Document service layer for handling file uploads and metadata management.

This service handles:
1. File validation (extension, size, MIME type)
2. File storage on disk
3. Metadata storage in MongoDB
4. Document querying and deletion
5. File cleanup on deletion

Architecture:
- Service receives UploadFile from FastAPI
- Validates file
- Saves to disk at backend/uploads/{user_id}/{filename}
- Stores metadata in MongoDB documents collection
- Returns document info to client
- On deletion: removes both file and metadata
"""

import asyncio
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from bson import ObjectId
import cloudinary
import cloudinary.uploader
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.db.database import get_database
from app.models.document import Document
from app.services.extraction_service import extraction_service
from app.services.chunking_service import chunking_service
from app.services.embedding_service import embedding_service

# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

# Base directory for file uploads
UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"

# Allowed file types (MIME types)
ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/csv": "csv",
}

# Maximum file size: 50 MB
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB in bytes


class DocumentService:
    """
    Service for document upload and management operations.
    
    Handles the business logic for:
    - Validating uploaded files
    - Saving files to disk
    - Storing metadata in MongoDB
    - Querying documents
    - Deleting documents
    
    All methods are async because they interact with Motor (async MongoDB).
    """
    
    @staticmethod
    async def _get_documents_collection() -> any:
        """
        Get MongoDB documents collection.
        
        Returns:
            Motor AsyncIOMotorCollection for documents
        """
        db: AsyncIOMotorDatabase = get_database()
        return db["documents"]

    @staticmethod
    def configure_cloudinary() -> bool:
        """
        Configure Cloudinary client using application settings or environment variables.
        Returns True if credentials are configured, False otherwise.
        """
        cloud_name = settings.CLOUDINARY_CLOUD_NAME or os.getenv("CLOUDINARY_CLOUD_NAME")
        api_key = settings.CLOUDINARY_API_KEY or os.getenv("CLOUDINARY_API_KEY")
        api_secret = settings.CLOUDINARY_API_SECRET or os.getenv("CLOUDINARY_API_SECRET")
        if cloud_name and api_key and api_secret:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True,
            )
            return True
        return False
    
    @staticmethod
    def _create_uploads_dir() -> None:
        """
        Create uploads directory if it doesn't exist.
        
        Creates:
        - backend/uploads/
        
        Safe to call multiple times (mkdir -p behavior).
        """
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    
    @staticmethod
    def _validate_file(filename: str, file_size: int, content_type: str) -> tuple[bool, str]:
        """
        Validate uploaded file.
        
        Checks:
        1. File extension is allowed
        2. File size is within limit
        3. MIME type is allowed
        4. Filename is not empty
        
        Validation Process:
        - Get extension from filename
        - Check if MIME type is in ALLOWED_MIME_TYPES
        - Check if file_size <= MAX_FILE_SIZE
        - Return (is_valid, error_message)
        
        Security Note:
        - Never trust client's content_type alone
        - Check extension and MIME type
        - Reject if mismatch (e.g., .exe with document MIME type)
        
        Args:
            filename: Original filename from upload
            file_size: Size in bytes
            content_type: MIME type from Content-Type header
            
        Returns:
            (is_valid: bool, error_message: str or empty string)
        """
        # Check filename not empty
        if not filename or len(filename) == 0:
            return False, "Filename cannot be empty"
        
        # Extract extension from filename
        # Example: "resume.pdf" -> ".pdf" -> "pdf"
        file_ext = Path(filename).suffix.lower()
        
        # Check if MIME type is allowed
        if content_type not in ALLOWED_MIME_TYPES:
            allowed = ", ".join(ALLOWED_MIME_TYPES.keys())
            return False, f"File type {content_type} not allowed. Allowed: {allowed}"
        
        # Check if file size exceeds limit
        if file_size > MAX_FILE_SIZE:
            max_mb = MAX_FILE_SIZE / (1024 * 1024)
            return False, f"File size exceeds {max_mb}MB limit"
        
        # Get expected extension for this MIME type
        expected_ext = ALLOWED_MIME_TYPES.get(content_type)
        
        # Check if file extension matches MIME type
        # This prevents .exe files with document MIME type
        if file_ext != f".{expected_ext}":
            return False, f"File extension {file_ext} doesn't match MIME type {content_type}"
        
        # All checks passed
        return True, ""
    
    @staticmethod
    async def upload_document(
        file_content: bytes,
        filename: str,
        file_size: int,
        content_type: str,
        user_id: str,
    ) -> Document:
        """
        Upload a document: upload file to Cloudinary and store metadata in MongoDB.
        
        Process:
        1. Sanitize filename and validate file (type, size, MIME)
        2. Ensure Cloudinary storage is configured
        3. Upload original file to Cloudinary with resource_type="raw"
        4. Store metadata (secure_url, public_id, owner, filename, etc.) in MongoDB
        5. Extract text from file_content for RAG pipeline
        6. Chunk extracted text and auto-trigger embedding generation
        7. Return Document object
        
        Args:
            file_content: Raw file bytes
            filename: Original filename
            file_size: File size in bytes
            content_type: MIME type (e.g., "application/pdf")
            user_id: User who uploaded (from JWT token)
            
        Returns:
            Document object with metadata
            
        Raises:
            ValueError: If file validation fails
            RuntimeError: If Cloudinary upload or configuration fails
        """
        # Sanitize filename to prevent directory traversal
        filename = Path(filename).name
        
        # Validate file
        is_valid, error_msg = DocumentService._validate_file(filename, file_size, content_type)
        if not is_valid:
            raise ValueError(error_msg)
        
        # Verify Cloudinary configuration
        if not DocumentService.configure_cloudinary():
            logger.error("Cloudinary storage credentials are not configured")
            raise RuntimeError("Cloud storage is not configured")
        
        # Upload original file to Cloudinary using raw resource type for PDF, DOCX, TXT, CSV
        try:
            upload_result = await asyncio.to_thread(
                cloudinary.uploader.upload,
                file_content,
                resource_type="raw",
                folder=f"docuquery/documents/{user_id}",
                filename=filename,
                use_filename=True,
                unique_filename=True,
            )
        except Exception as e:
            logger.error(f"Cloudinary upload failed for filename='{filename}': {str(e)}")
            raise RuntimeError(f"Cloud storage upload failed: {str(e)}")
        
        secure_url = upload_result.get("secure_url")
        public_id = upload_result.get("public_id")
        if not secure_url or not public_id:
            logger.error(f"Cloudinary response missing secure_url or public_id: {upload_result}")
            raise RuntimeError("Cloud storage response missing file URL or ID")
        
        # Create document metadata
        storage_key = public_id
        document = Document(
            user_id=user_id,
            filename=filename,
            file_type=content_type,
            file_size=file_size,
            file_path=secure_url,
            storage_key=storage_key,
            secure_url=secure_url,
            public_id=public_id,
            upload_date=datetime.utcnow(),
            status="uploaded",
            extraction_status="pending",
        )
        
        # Store metadata in MongoDB
        documents_collection = await DocumentService._get_documents_collection()
        try:
            result = await documents_collection.insert_one(
                document.model_dump(by_alias=True, exclude_none=True)
            )
            # Set the MongoDB-generated _id
            document.id = str(result.inserted_id)
        except Exception as db_err:
            logger.error(f"Failed to persist document metadata in MongoDB for {filename}: {str(db_err)}")
            # Rollback: Clean up uploaded Cloudinary file if database operation fails
            try:
                await asyncio.to_thread(
                    cloudinary.uploader.destroy,
                    public_id,
                    resource_type="raw",
                )
                logger.info(f"Successfully rolled back Cloudinary asset {public_id} after DB insert error")
            except Exception as rollback_err:
                logger.error(f"Failed to rollback Cloudinary asset {public_id}: {str(rollback_err)}")
            raise db_err
        
        # Extract text from document asynchronously
        # This happens in the background without blocking the response
        try:
            extracted_text, text_length = await extraction_service.extract_text(
                file_content=file_content,
                file_type=content_type
            )
            
            # Update document with extraction results
            document.extracted_text = extracted_text
            document.text_length = text_length
            document.extraction_status = "extracted"
            document.extraction_date = datetime.utcnow()
            
            # Update MongoDB document with extracted text
            await documents_collection.update_one(
                {"_id": ObjectId(document.id)},
                {
                    "$set": {
                        "extracted_text": extracted_text,
                        "text_length": text_length,
                        "extraction_status": "extracted",
                        "extraction_date": datetime.utcnow(),
                    }
                }
            )
        
        except Exception as e:
            # If extraction fails, log error but don't fail the upload
            error_msg = f"Text extraction failed: {str(e)}"
            document.extraction_status = "failed"
            document.extraction_error = error_msg
            
            # Update MongoDB with error status
            await documents_collection.update_one(
                {"_id": ObjectId(document.id)},
                {
                    "$set": {
                        "extraction_status": "failed",
                        "extraction_error": error_msg,
                    }
                }
            )
        
        # Step 3: Chunk the extracted text (if extraction succeeded)
        # Chunking happens after extraction, doesn't block upload
        if document.extraction_status == "extracted" and document.extracted_text:
            try:
                # Call chunking service to split text into chunks
                chunk_count, chunk_status = await chunking_service.process_document_chunks(
                    db=documents_collection.database,
                    extracted_text=document.extracted_text,
                    document_id=document.id,
                    user_id=user_id,
                )
                
                # Update document with chunking results
                document.chunk_count = chunk_count
                document.chunk_status = "chunked" if chunk_count > 0 else "failed"
                document.chunk_date = datetime.utcnow()
                document.processing_status = "chunked"
                
                # Update MongoDB with chunk metadata
                await documents_collection.update_one(
                    {"_id": ObjectId(document.id)},
                    {
                        "$set": {
                            "chunk_count": chunk_count,
                            "chunk_status": "chunked" if chunk_count > 0 else "failed",
                            "chunk_date": datetime.utcnow(),
                            "processing_status": "chunked",
                        }
                    }
                )

                # PHASE 1 FIX 1.1: Auto-trigger embedding generation after chunking
                if chunk_count > 0:
                    try:
                        embedded_count, embed_status = await embedding_service.process_document_embeddings(
                            db=documents_collection.database,
                            document_id=document.id
                        )
                        logger.info(f"✅ Auto-generated embeddings: {embedded_count} chunks embedded for document {document.id}")
                    except Exception as embed_error:
                        # Don't block upload if embedding fails
                        logger.warning(f"⚠️ Auto-embedding failed (non-blocking): {str(embed_error)}")

            except Exception as e:
                # If chunking fails, log error but don't fail the upload
                # Document still has extracted_text available for future processing
                error_msg = f"Text chunking failed: {str(e)}"
                document.chunk_status = "failed"
                document.chunk_error = error_msg
                document.processing_status = "extracted"  # Fall back to extracted state
                
                # Update MongoDB with chunking error
                await documents_collection.update_one(
                    {"_id": ObjectId(document.id)},
                    {
                        "$set": {
                            "chunk_status": "failed",
                            "chunk_error": error_msg,
                            "processing_status": "extracted",
                        }
                    }
                )
        
        return document
    
    @staticmethod
    async def list_documents(
        user_id: str,
        skip: int = 0,
        limit: int = 10,
    ) -> tuple[List[Document], int]:
        """
        List documents for a user with pagination.
        
        Query:
        db.documents.find({user_id: "..."})
                    .skip(skip)
                    .limit(limit)
        
        Pagination:
        - skip: How many documents to skip
        - limit: Max documents to return
        
        Example: skip=10, limit=5 returns documents 11-15
        
        Returns both list and total count so client can:
        - Display "Showing 1-5 of 25 documents"
        - Implement pagination UI
        
        Args:
            user_id: User to list documents for
            skip: Number of documents to skip
            limit: Max documents to return
            
        Returns:
            (documents: List[Document], total: int)
        """
        documents_collection = await DocumentService._get_documents_collection()
        
        # Query documents for user
        # Sort by upload_date descending (newest first)
        cursor = documents_collection.find({"user_id": user_id}).sort(
            [("upload_date", -1), ("uploaded_at", -1)]
        ).skip(skip).limit(limit)
        
        # Convert cursor results to Document objects
        documents = []
        async for doc in cursor:
            documents.append(Document(**doc))
        
        # Get total count of documents for user
        total = await documents_collection.count_documents({"user_id": user_id})
        
        return documents, total
    
    @staticmethod
    async def get_document(document_id: str, user_id: str) -> Document | None:
        """
        Get a single document by ID.
        
        Security: Check that document belongs to user (user_id match)
        This prevents users from accessing other users' documents
        
        Query:
        db.documents.findOne({
            "_id": ObjectId("..."),
            "user_id": "..."
        })
        
        Args:
            document_id: MongoDB ObjectId as string
            user_id: User who should own this document
            
        Returns:
            Document if found and belongs to user, None otherwise
        """
        from bson import ObjectId
        
        documents_collection = await DocumentService._get_documents_collection()
        
        try:
            doc = await documents_collection.find_one({
                "_id": ObjectId(document_id),
                "user_id": user_id,
            })
            
            if not doc:
                return None
            
            return Document(**doc)
        except Exception:
            # ObjectId conversion failed or other error
            return None

    @staticmethod
    def get_document_path(document_id: str, user_id: str, filename: Optional[str] = None) -> Optional[Path]:
        """
        Locate document file path on disk with strict path containment verification.
        """
        user_dir = (UPLOADS_DIR / user_id).resolve()
        if not user_dir.exists():
            return None
        
        if filename:
            safe_filename = Path(filename).name
            candidate = (user_dir / safe_filename).resolve()
            if candidate.is_relative_to(user_dir) and candidate.is_file():
                return candidate

        # Fallback: scan user_dir
        for f in user_dir.glob("*"):
            resolved = f.resolve()
            if resolved.is_relative_to(user_dir) and resolved.is_file():
                return resolved
        return None
    
    @staticmethod
    async def delete_document(document_id: str, user_id: str) -> bool:
        """
        Delete a document (removes Cloudinary asset, local file if legacy, metadata, chunks, and embeddings).
        
        Process:
        1. Find document in MongoDB
        2. Verify user owns it (security)
        3. Delete Cloudinary asset using public_id (resource_type="raw")
        4. Delete legacy local file from disk if present
        5. Cascade delete chunks and embeddings from document_chunks collection
        6. Delete metadata from MongoDB documents collection
        7. Return success/failure
        
        Args:
            document_id: MongoDB ObjectId as string
            user_id: User deleting (must be owner)
            
        Returns:
            True if deleted, False if not found or access denied or deletion failed
        """
        from bson import ObjectId
        
        documents_collection = await DocumentService._get_documents_collection()
        
        try:
            # Find document to verify ownership and retrieve storage metadata
            doc = await documents_collection.find_one({
                "_id": ObjectId(document_id),
                "user_id": user_id,
            })
            
            if not doc:
                logger.warning(f"Document {document_id} not found for user {user_id}")
                return False
            
            # 1. Remove Cloudinary asset if public_id exists
            public_id = doc.get("public_id")
            if public_id:
                if DocumentService.configure_cloudinary():
                    try:
                        res = await asyncio.to_thread(
                            cloudinary.uploader.destroy,
                            public_id,
                            resource_type="raw"
                        )
                        logger.info(f"☁️ Cloudinary destroy response for {public_id}: {res}")
                        # Fallback for assets stored under other resource types
                        if res.get("result") == "not found":
                            res_img = await asyncio.to_thread(
                                cloudinary.uploader.destroy,
                                public_id,
                                resource_type="image"
                            )
                            logger.info(f"☁️ Cloudinary destroy (image fallback) response: {res_img}")
                            if res_img.get("result") not in ["ok", "not found"]:
                                logger.error(f"Cloudinary deletion unconfirmed for {public_id}: {res_img}")
                                return False
                        elif res.get("result") not in ["ok", "not found"]:
                            logger.error(f"Cloudinary deletion unconfirmed for {public_id}: {res}")
                            return False
                    except Exception as cl_err:
                        logger.error(f"⚠️ Cloudinary asset deletion failed for {public_id}: {str(cl_err)}")
                        # Avoid deleting database records if file deletion fails
                        return False
                else:
                    logger.warning("☁️ Cloudinary credentials not configured, skipping Cloudinary asset cleanup")
            
            # 2. Delete file from disk if present (backward compatibility)
            file_path_str = doc.get("file_path")
            if file_path_str and not str(file_path_str).startswith("http"):
                file_path = Path(__file__).parent.parent.parent.parent / file_path_str
                if file_path.exists() and file_path.is_file():
                    try:
                        file_path.unlink()
                        logger.info(f"📁 Deleted legacy local file from disk: {file_path}")
                    except Exception as fe:
                        logger.warning(f"Failed to delete local file {file_path}: {fe}")
            
            # 3. Delete chunks and embeddings from MongoDB (cascade)
            db = documents_collection.database
            chunks_collection = db["document_chunks"]
            chunk_result = await chunks_collection.delete_many({
                "$or": [
                    {"document_id": document_id},
                    {"document_id": ObjectId(document_id)}
                ]
            })
            logger.info(f"🗑️ Cleaned up {chunk_result.deleted_count} chunks/embeddings for document {document_id}")
            
            # 4. Delete metadata from MongoDB
            result = await documents_collection.delete_one({
                "_id": ObjectId(document_id),
                "user_id": user_id,
            })
            
            return result.deleted_count == 1
        except Exception as e:
            logger.error(f"❌ Document deletion failed: {str(e)}", exc_info=True)
            return False


# Singleton instance
document_service = DocumentService()
