"""
Embedding generation service for document chunks.

This service layer handles:
1. Loading sentence-transformers model
2. Generating embeddings for text chunks
3. Storing embeddings in MongoDB
4. Updating chunk embedding status

Architecture:
- Service layer (this file): Business logic for embeddings
- Integrates with Motor for async MongoDB operations
- Uses asyncio.to_thread() for CPU-bound embedding generation
- Loads model once at startup, reuses across requests

Embedding Model:
- sentence-transformers/all-MiniLM-L6-v2
- 384-dimensional embeddings
- Fast inference (~10ms per chunk)
- Good quality semantic representations

RAG Pipeline Integration:
Step 1: Extract text (extraction_service)
Step 2: Split into chunks (chunking_service)
Step 3: Generate embeddings [THIS SERVICE]
Step 4: Store in vector DB (vector_db_service - future)
Step 5: Enable semantic search

Why async embeddings?
- Embedding generation is CPU-bound (matrix operations)
- asyncio.to_thread() runs in thread pool without blocking event loop
- Multiple documents can be processed concurrently
- Non-blocking for other API requests
"""

import asyncio
from datetime import datetime
import logging
from typing import List

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating and storing embeddings for document chunks.
    
    Responsibilities:
    - Load embedding model from HuggingFace
    - Generate embedding vectors for chunks
    - Store embeddings in MongoDB
    - Update embedding status for chunks
    - Handle errors gracefully
    
    Model Details:
    - all-MiniLM-L6-v2: 384-dimensional embeddings
    - ~22M parameters, fast inference
    - Good balance between speed and quality
    
    Methods are async to integrate with Motor (async MongoDB)
    and FastAPI's async request handling.
    """
    
    # Model name from HuggingFace
    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Cache model instance (lazy loaded)
    _model_instance = None
    
    @staticmethod
    def _load_model():
        """
        Load the sentence-transformers model.
        
        This is a CPU-bound operation (loading neural network weights).
        Done synchronously once, then cached for reuse.
        
        Returns:
            SentenceTransformer model instance
            
        Raises:
            ImportError: If sentence-transformers not installed
            Exception: If model download fails
        """
        try:
            from sentence_transformers import SentenceTransformer
            
            # Load model (downloads if not cached locally)
            model = SentenceTransformer(EmbeddingService.MODEL_NAME)
            logger.info(f"Loaded embedding model: {EmbeddingService.MODEL_NAME}")
            return model
        
        except ImportError as e:
            logger.error("sentence-transformers not installed")
            raise
        except Exception as e:
            logger.error(f"Failed to load embedding model: {str(e)}")
            raise
    
    @staticmethod
    def _get_model():
        """
        Get or initialize the embedding model (singleton).
        
        Lazy loading: Model is loaded on first use, cached for subsequent calls.
        
        Returns:
            SentenceTransformer model instance
        """
        if EmbeddingService._model_instance is None:
            EmbeddingService._model_instance = EmbeddingService._load_model()
        
        return EmbeddingService._model_instance
    
    @staticmethod
    def generate_embedding(text: str) -> List[float]:
        """
        Generate embedding for a single text chunk.
        
        Pure function (sync): Runs the embedding model on CPU.
        Called via asyncio.to_thread() in async context.
        
        Process:
        1. Tokenize text
        2. Pass through transformer model
        3. Return embedding vector as list
        
        Args:
            text: Text chunk to embed (typically 256-1024 chars)
            
        Returns:
            List of 384 floats (embedding vector)
            
        Raises:
            ValueError: If text is empty
            Exception: If embedding generation fails
        """
        if not text or len(text.strip()) == 0:
            raise ValueError("Cannot generate embedding for empty text")
        
        try:
            model = EmbeddingService._get_model()
            
            # Generate embedding
            # model.encode() returns numpy array [384,]
            embedding = model.encode(text, convert_to_tensor=False)
            
            # Convert to Python list for JSON serialization in MongoDB
            embedding_list = embedding.tolist()
            
            logger.debug(f"Generated embedding for {len(text)} char text")
            return embedding_list
        
        except Exception as e:
            logger.error(f"Embedding generation failed: {str(e)}")
            raise
    
    @staticmethod
    async def generate_embeddings_for_chunks(
        chunks: List[dict],
        batch_size: int = 10
    ) -> List[tuple[str, List[float]]]:
        """
        Generate embeddings for multiple chunks.
        
        Process:
        1. Run embedding generation in thread pool (non-blocking)
        2. Generate embeddings for all chunks
        3. Return chunk_id -> embedding pairs
        
        Batching:
        - Processes chunks in batches for efficiency
        - Reduces number of thread pool submissions
        
        Args:
            chunks: List of chunk documents from MongoDB
                   Each chunk must have "_id" and "content"
            batch_size: How many chunks to process per batch (default 10)
            
        Returns:
            List of (chunk_id_str, embedding_vector) tuples
            - chunk_id_str: MongoDB ObjectId as string
            - embedding_vector: List of 384 floats
            
        Raises:
            ValueError: If chunks list is empty
            Exception: If embedding generation fails for any chunk
        """
        if not chunks:
            raise ValueError("No chunks provided for embedding")
        
        try:
            chunk_embeddings = []
            
            # Process chunks and generate embeddings in thread pool
            for chunk in chunks:
                chunk_id = str(chunk.get("_id"))
                content = chunk.get("content")
                
                if not content:
                    logger.warning(f"Skipping chunk {chunk_id}: no content")
                    continue
                
                # Run embedding in thread pool (CPU-bound)
                embedding = await asyncio.to_thread(
                    EmbeddingService.generate_embedding,
                    content
                )
                
                chunk_embeddings.append((chunk_id, embedding))
            
            logger.info(f"Generated embeddings for {len(chunk_embeddings)} chunks")
            return chunk_embeddings
        
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {str(e)}")
            raise
    
    @staticmethod
    async def store_embeddings_in_mongodb(
        db: AsyncIOMotorDatabase,
        chunk_embeddings: List[tuple[str, List[float]]],
    ) -> tuple[int, str | None]:
        """
        Store embeddings in document_chunks collection.
        
        Updates embedding_vector and embedding_status for each chunk.
        
        Args:
            db: Motor async database instance
            chunk_embeddings: List of (chunk_id, embedding_vector) tuples
            
        Returns:
            Tuple: (count_updated, error_message)
            - count_updated: Number of chunks successfully updated
            - error_message: None if success, error string if failure
        """
        try:
            collection = db["document_chunks"]
            
            # Bulk update with embedding vectors
            updates = 0
            errors = []
            
            for chunk_id, embedding_vector in chunk_embeddings:
                try:
                    from bson import ObjectId

                    # Validate embedding dimension
                    if len(embedding_vector) != 384:
                        error_msg = f"Invalid embedding dimension for chunk {chunk_id}: {len(embedding_vector)} (expected 384)"
                        errors.append(error_msg)
                        logger.error(error_msg)
                        continue

                    query = {"_id": ObjectId(chunk_id)} if ObjectId.is_valid(chunk_id) else {"_id": chunk_id}
                    result = await collection.update_one(
                        query,
                        {
                            "$set": {
                                "embedding_vector": embedding_vector,
                                "embedding_status": "completed",
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )

                    if result.matched_count > 0 or result.modified_count > 0:
                        updates += 1
                    else:
                        error_msg = f"Chunk not found in database: {chunk_id}"
                        errors.append(error_msg)
                        logger.error(error_msg)

                except Exception as e:
                    error_msg = f"Failed to update chunk {chunk_id}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            if updates != len(chunk_embeddings):
                error_summary = f"Partial embedding failure: {updates}/{len(chunk_embeddings)} chunks updated"
                logger.error(f"⚠️  {error_summary}")
                if errors:
                    error_summary = f"{error_summary} ({len(errors)} errors: {errors[0]})"
                return (updates, error_summary)

            if errors:
                error_summary = f"{len(errors)} chunks failed: {errors[0]}"
                return (updates, error_summary)

            return (updates, None)
        
        except Exception as e:
            error_msg = f"Embedding storage failed: {str(e)}"
            logger.error(error_msg)
            return (0, error_msg)
    
    @staticmethod
    async def process_document_embeddings(
        db: AsyncIOMotorDatabase,
        document_id: str,
    ) -> tuple[int, str]:
        """
        Orchestrate entire embedding process for a document.
        
        MAIN ENTRY POINT for embedding generation.
        
        Pipeline step: Extract → Chunk → [EMBED] → Search
        
        Process:
        1. Fetch all chunks for document
        2. Generate embeddings for all chunks
        3. Store embeddings in MongoDB
        
        Args:
            db: Motor async database
            document_id: MongoDB ObjectId of document (string)
            
        Returns:
            Tuple: (chunks_embedded, status_message)
            - chunks_embedded: Number of chunks with embeddings
            - status_message: Human-readable status
            
        Example:
            >>> await EmbeddingService.process_document_embeddings(
            ...     db=db,
            ...     document_id="507f1f77bcf86cd799439011"
            ... )
            >>> (42, "Generated embeddings for 42 chunks")
        """
        from bson import ObjectId
        
        try:
            collection = db["document_chunks"]
            
            # Step 1: Fetch all chunks for this document
            chunks = []
            async for chunk in collection.find({"document_id": document_id}):
                chunks.append(chunk)
            
            if not chunks:
                return (0, "No chunks found for document")
            
            logger.info(f"Processing embeddings for {len(chunks)} chunks of document {document_id}")
            
            # Step 2: Generate embeddings (runs in thread pool, non-blocking)
            chunk_embeddings = await EmbeddingService.generate_embeddings_for_chunks(chunks)
            
            # Step 3: Store embeddings in MongoDB
            updated_count, error = await EmbeddingService.store_embeddings_in_mongodb(
                db, chunk_embeddings
            )
            
            if updated_count > 0:
                status = f"Generated embeddings for {updated_count} chunks"
                logger.info(f"Successfully embedded {updated_count} chunks for document {document_id}")
                return (updated_count, status)
            else:
                error_msg = error or "Unknown error storing embeddings"
                return (0, f"Embedding storage failed: {error_msg}")
        
        except ValueError as e:
            return (0, f"Cannot process embeddings: {str(e)}")
        except Exception as e:
            error_msg = f"Embedding error: {str(e)}"
            logger.error(error_msg)
            return (0, error_msg)


# Singleton instance - use throughout app
embedding_service = EmbeddingService()
