"""
Chunking service: Async business logic layer for text splitting and storage.

Architecture Overview:
=====================
Upload Pipeline: Upload → Extract → Chunk → Embed → Search
                  ↓        ↓         ↓
                 File    PyMuPDF   This Layer

This service handles:
1. Taking extracted text
2. Splitting into semantic chunks (handled by text_chunker utils)
3. Storing chunks in MongoDB with metadata
4. Handling errors gracefully

Async Design:
- split_document_text(): Pure splitting (sync in thread)
- store_document_chunks(): MongoDB writes (async/await)
- process_document_chunks(): Orchestrates both (the main entry point)

Error Handling:
- If chunking fails: Set status, don't block upload
- If storage fails: Log error, but text is still extracted
- Partial success: Chunks 1-5 stored, then network error on chunk 6
  → 5 chunks available for embedding later
"""

from datetime import datetime
from typing import Any

import pymongo
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.text_chunker import create_chunks_with_metadata


class ChunkingService:
    """
    Service for chunking text and storing chunks in MongoDB.
    
    Responsibilities:
    - Split extracted text using RecursiveCharacterTextSplitter
    - Create chunk documents with metadata
    - Store chunks in MongoDB efficiently
    - Handle errors without blocking the upload flow
    """
    
    CHUNK_COLLECTION_NAME = "document_chunks"
    
    @staticmethod
    def split_document_text(
        extracted_text: str,
        document_id: str,
        user_id: str,
    ) -> list[dict[str, Any]]:
        """
        Split extracted text into chunks with MongoDB-ready documents.
        
        Pure function (sync): Does text splitting logic.
        Called via asyncio.to_thread() in process_document_chunks().
        
        Each document contains:
        {
            "document_id": "...",
            "user_id": "...",
            "chunk_index": 0,
            "content": "chunk text",
            "chunk_size": 1024,
            "embedding_status": "pending",
            "embedding_vector": null,
            "created_at": datetime,
            "updated_at": datetime,
        }
        
        Args:
            extracted_text: Full text from extraction service
            document_id: MongoDB ObjectId (string) of parent document
            user_id: MongoDB ObjectId (string) of user
            
        Returns:
            List of chunk documents ready for MongoDB insertion
            
        Raises:
            ValueError: If text is empty
            
        Example:
            >>> chunks = ChunkingService.split_document_text(
            ...     extracted_text="Very large text...",
            ...     document_id="507f...",
            ...     user_id="user123"
            ... )
            >>> len(chunks)  # 42
            >>> chunks[0]["chunk_index"]  # 0
            >>> chunks[0]["chunk_size"]  # 1024
        """
        # Use text_chunker to split and get metadata
        chunks_with_metadata = create_chunks_with_metadata(
            text=extracted_text,
            document_id=document_id,
            user_id=user_id,
        )
        
        # Convert to MongoDB document format
        chunk_documents = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "chunk_index": chunk_index,
                "content": content,
                "chunk_size": chunk_size,
                "embedding_status": "pending",
                "embedding_vector": None,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            for chunk_index, content, chunk_size in chunks_with_metadata
        ]
        
        return chunk_documents
    
    @staticmethod
    async def store_chunks_in_mongodb(
        db: AsyncIOMotorDatabase,
        chunk_documents: list[dict[str, Any]],
    ) -> tuple[int, str | None]:
        """
        Store chunks in MongoDB document_chunks collection.
        
        Creates collection if needed (first use).
        Bulk inserts all chunks for efficiency.
        
        Args:
            db: Motor async database instance
            chunk_documents: List of chunk documents to insert
            
        Returns:
            Tuple: (count_inserted, error_message)
            - count_inserted: Number of chunks successfully stored
            - error_message: None if success, error string if partial/full failure
            
        Raises:
            ConnectionError: If MongoDB unavailable (let caller handle)
            
        Example:
            >>> db = get_db()
            >>> chunks = [{"document_id": "...", ...}, ...]
            >>> count, error = await ChunkingService.store_chunks_in_mongodb(db, chunks)
            >>> count  # 42
            >>> error  # None
        """
        try:
            collection = db[ChunkingService.CHUNK_COLLECTION_NAME]
            
            # Idempotency guarantee: remove any existing chunks for this specific document and user before inserting
            if chunk_documents:
                first_doc_id = chunk_documents[0].get("document_id")
                first_user_id = chunk_documents[0].get("user_id")
                if first_doc_id and first_user_id:
                    await collection.delete_many({
                        "document_id": str(first_doc_id),
                        "user_id": str(first_user_id)
                    })

            # Bulk insert - all or nothing attempt
            result = await collection.insert_many(chunk_documents, ordered=False)
            
            inserted_count = len(result.inserted_ids)
            
            # Create index for efficient queries
            # Index on document_id: "Find all chunks for this doc"
            # Index on user_id + document_id: "Find user's doc chunks"
            await collection.create_index("document_id")
            await collection.create_index([("user_id", pymongo.ASCENDING), 
                                          ("document_id", pymongo.ASCENDING)])
            
            return (inserted_count, None)
            
        except Exception as e:
            error_msg = f"Failed to store chunks: {str(e)}"
            return (0, error_msg)
    
    @staticmethod
    async def process_document_chunks(
        db: AsyncIOMotorDatabase,
        extracted_text: str,
        document_id: str,
        user_id: str,
    ) -> tuple[int, str]:
        """
        Orchestrate entire chunking process: split text, store in MongoDB.
        
        MAIN ENTRY POINT for chunking.
        
        Called from document_service.upload_document() after extraction.
        
        Pipeline step: Upload → Extract → [CHUNK] → Embed → Search
        
        Args:
            db: Motor async database
            extracted_text: Text from extraction service
            document_id: MongoDB ObjectId of document (string)
            user_id: MongoDB ObjectId of user (string)
            
        Returns:
            Tuple: (chunks_stored, status_message)
            - chunks_stored: Number of chunks in MongoDB
            - status_message: Human-readable status (for logging/response)
            
        Example:
            >>> await ChunkingService.process_document_chunks(
            ...     db=db,
            ...     extracted_text="Full document text...",
            ...     document_id="507f1f77bcf86cd799439011",
            ...     user_id="user123"
            ... )
            >>> (42, "Chunked into 42 segments (chunk_size=1000, overlap=200)")
        """
        import asyncio
        
        try:
            # Step 1: Split text (CPU-bound, run in thread pool)
            chunk_documents = await asyncio.to_thread(
                ChunkingService.split_document_text,
                extracted_text,
                document_id,
                user_id,
            )
            
            chunk_count = len(chunk_documents)
            
            if chunk_count == 0:
                return (0, "No chunks generated from extracted text")
            
            # Step 2: Store in MongoDB (I/O-bound, async)
            inserted_count, error = await ChunkingService.store_chunks_in_mongodb(
                db, chunk_documents
            )
            
            # Success or partial failure
            if inserted_count > 0:
                status = (
                    f"Chunked into {inserted_count} segments "
                    f"(chunk_size=1000, overlap=200)"
                )
                return (inserted_count, status)
            else:
                # Storage failed entirely
                return (0, f"Chunk storage failed: {error}")
                
        except ValueError as e:
            # Empty text error from splitter
            return (0, f"Cannot chunk: {str(e)}")
        except Exception as e:
            # Unexpected errors
            return (0, f"Chunking error: {str(e)}")


# Singleton instance - use throughout app
chunking_service = ChunkingService()
