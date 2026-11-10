"""
Embedding generation service for document chunks using Gemini API.

This service layer handles:
1. Generating embeddings using Google Gemini Embedding API (gemini-embedding-001)
2. Storing 384-dimensional embeddings in MongoDB
3. Updating chunk embedding status
4. High performance, zero local model memory footprint (prevents Render Free 512MB OOM)

Architecture:
- Cloud-based embeddings via Google GenAI SDK
- 384 dimensions matching production vector search specification
- Non-blocking async / thread pool integration
- Zero PyTorch / HuggingFace memory overhead (<5MB vs 400MB+)
"""

import asyncio
from datetime import datetime
import logging
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating and storing embeddings for document chunks using
    Gemini's embedding API.
    
    Model Details:
    - gemini-embedding-001 with output_dimensionality=384
    - High semantic retrieval quality
    - Low latency (~200ms per batch)
    - Zero local model memory consumption
    """
    
    _raw_model = getattr(settings, "EMBEDDING_MODEL", "gemini-embedding-001")
    MODEL_NAME = "gemini-embedding-001" if (not _raw_model or "text-embedding" in str(_raw_model)) else str(_raw_model)
    EMBEDDING_DIMENSIONS = getattr(settings, "EMBEDDING_DIMENSIONS", 384)
    
    _client_instance = None
    
    @classmethod
    def _get_client(cls):
        """Lazy-loaded Gemini client singleton."""
        if cls._client_instance is None:
            from google import genai
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                logger.warning("GEMINI_API_KEY is not set. Embedding calls will fail.")
            cls._client_instance = genai.Client(api_key=api_key)
        return cls._client_instance
    
    @classmethod
    def generate_embedding(cls, text: str) -> List[float]:
        """
        Generate 384-dim embedding vector for a single text chunk.
        
        Args:
            text: Text chunk to embed
            
        Returns:
            List of 384 floats
        """
        if not text or len(text.strip()) == 0:
            raise ValueError("Cannot generate embedding for empty text")
        
        try:
            from google.genai import types
            client = cls._get_client()
            res = client.models.embed_content(
                model=cls.MODEL_NAME,
                contents=text.strip(),
                config=types.EmbedContentConfig(output_dimensionality=cls.EMBEDDING_DIMENSIONS),
            )
            if not res.embeddings or not res.embeddings[0].values:
                raise RuntimeError("No embedding returned from Gemini API")
            
            return [float(v) for v in res.embeddings[0].values]
        
        except Exception as e:
            logger.error(f"Gemini embedding generation failed: {str(e)}")
            raise RuntimeError(f"Embedding generation failed: {str(e)}") from e
    
    @classmethod
    async def generate_embeddings_for_chunks(
        cls,
        chunks: List[dict],
        batch_size: int = 16
    ) -> List[tuple[str, List[float]]]:
        """
        Generate embeddings for multiple chunks in batches.
        
        Args:
            chunks: List of chunk documents from MongoDB (must have '_id' and 'content')
            batch_size: Chunks per API batch request (default 16)
            
        Returns:
            List of (chunk_id_str, embedding_vector) tuples
        """
        if not chunks:
            raise ValueError("No chunks provided for embedding")
        
        valid_chunks = [c for c in chunks if c.get("content") and str(c.get("content")).strip()]
        if not valid_chunks:
            return []
        
        chunk_embeddings = []
        try:
            for i in range(0, len(valid_chunks), batch_size):
                batch = valid_chunks[i:i + batch_size]
                batch_texts = [str(c["content"]).strip() for c in batch]
                
                def _call_batch():
                    from google.genai import types
                    client = cls._get_client()
                    return client.models.embed_content(
                        model=cls.MODEL_NAME,
                        contents=batch_texts,
                        config=types.EmbedContentConfig(output_dimensionality=cls.EMBEDDING_DIMENSIONS),
                    )
                
                res = await asyncio.to_thread(_call_batch)
                if not res.embeddings:
                    raise RuntimeError("Gemini batch embed returned empty embeddings list")
                
                for chunk, emb in zip(batch, res.embeddings):
                    chunk_id = str(chunk.get("_id"))
                    chunk_embeddings.append((chunk_id, [float(v) for v in emb.values]))
            
            logger.info(f"Generated embeddings for {len(chunk_embeddings)} chunks using {cls.MODEL_NAME}")
            return chunk_embeddings
            
        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {str(e)}")
            raise
    
    @classmethod
    async def store_embeddings_in_mongodb(
        cls,
        db: AsyncIOMotorDatabase,
        chunk_embeddings: List[tuple[str, List[float]]],
    ) -> tuple[int, Optional[str]]:
        """
        Store embeddings in document_chunks collection.
        Updates embedding_vector, embedding_model and embedding_status for each chunk.
        """
        try:
            collection = db["document_chunks"]
            updates = 0
            errors = []
            
            for chunk_id, embedding_vector in chunk_embeddings:
                try:
                    from bson import ObjectId
                    
                    if len(embedding_vector) != cls.EMBEDDING_DIMENSIONS:
                        error_msg = f"Invalid embedding dimension for chunk {chunk_id}: {len(embedding_vector)} (expected {cls.EMBEDDING_DIMENSIONS})"
                        errors.append(error_msg)
                        logger.error(error_msg)
                        continue
                    
                    query = {"_id": ObjectId(chunk_id)} if ObjectId.is_valid(chunk_id) else {"_id": chunk_id}
                    result = await collection.update_one(
                        query,
                        {
                            "$set": {
                                "embedding_vector": embedding_vector,
                                "embedding_model": cls.MODEL_NAME,
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
    
    @classmethod
    async def process_document_embeddings(
        cls,
        db: AsyncIOMotorDatabase,
        document_id: str,
    ) -> tuple[int, str]:
        """
        Main entry point for document embedding generation.
        Fetches all chunks, generates Gemini embeddings, and updates MongoDB.
        """
        try:
            collection = db["document_chunks"]
            chunks = []
            async for chunk in collection.find({"document_id": document_id}):
                chunks.append(chunk)
            
            if not chunks:
                return (0, "No chunks found for document")
            
            logger.info(f"Processing embeddings for {len(chunks)} chunks of document {document_id}")
            chunk_embeddings = await cls.generate_embeddings_for_chunks(chunks)
            updated_count, error = await cls.store_embeddings_in_mongodb(db, chunk_embeddings)
            
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


embedding_service = EmbeddingService()
