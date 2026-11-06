"""
Semantic Retrieval Service for RAG Pipeline

Provides methods to:
1. Generate embeddings for user queries
2. Search document chunks using cosine similarity
3. Retrieve top-k most relevant chunks based on semantic similarity

The RetrievalService completes the first phase of the RAG pipeline:
User Query → Query Embedding → Similarity Search → Top Relevant Chunks
"""

import asyncio
import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.embedding_service import embedding_service

logger = logging.getLogger("uvicorn.error")


class RetrievalService:
    """
    Service for semantic search and chunk retrieval using cosine similarity.
    
    Workflow:
    1. Convert user query to embedding using sentence-transformers
    2. Fetch all chunks from MongoDB with their embedding vectors
    3. Compute cosine similarity between query embedding and chunk embeddings
    4. Sort chunks by similarity score (descending)
    5. Return top-k most relevant chunks
    
    Attributes:
        - Uses 384-dimensional embeddings from sentence-transformers/all-MiniLM-L6-v2
        - Similarity scores range from -1.0 (opposite) to 1.0 (identical)
        - Typical relevant scores: > 0.5
    """

    @staticmethod
    async def generate_query_embedding(query: str) -> List[float]:
        """
        Generate embedding for user query.
        
        Delegates to EmbeddingService for consistency with document embeddings.
        Runs CPU-bound embedding generation in thread pool.
        
        Args:
            query (str): User's search query/question
            
        Returns:
            List[float]: 384-dimensional embedding vector
            
        Raises:
            ValueError: If query is empty or None
            RuntimeError: If embedding model fails to load
            
        Example:
            >>> embedding = await RetrievalService.generate_query_embedding(
            ...     "What technologies are used in this project?"
            ... )
            >>> len(embedding)
            384
        """
        logger.info(f"🔎 Generating query embedding for: '{query[:60]}...'")
        
        if not query or not query.strip():
            logger.error("Query is empty or whitespace only")
            raise ValueError("Query cannot be empty")
        
        try:
            # Use EmbeddingService to generate embedding (consistent with chunk embeddings)
            # Run CPU-bound embedding generation in thread pool to avoid blocking
            embedding = await asyncio.to_thread(embedding_service.generate_embedding, query.strip())
            
            logger.info(f"✅ Query embedding generated: {len(embedding)} dimensions")
            return embedding
            
        except Exception as e:
            logger.error(f"❌ Failed to generate query embedding: {str(e)}")
            raise RuntimeError(f"Embedding generation failed: {str(e)}")

    @staticmethod
    def cosine_similarity_search(
        query_embedding: List[float],
        chunk_embeddings: List[List[float]]
    ) -> np.ndarray:
        """
        Compute cosine similarity between query and chunk embeddings.
        
        Uses sklearn's optimized cosine_similarity for vector operations.
        Similarity scores: -1.0 (opposite) to 1.0 (identical)
        
        Args:
            query_embedding (List[float]): Query embedding (384 dims)
            chunk_embeddings (List[List[float]]): List of chunk embeddings
            
        Returns:
            np.ndarray: Similarity scores array shape (n_chunks,)
            
        Raises:
            ValueError: If embeddings have wrong dimensions
            
        Example:
            >>> query_emb = [0.1, 0.2, ..., 0.3]  # 384 dims
            >>> chunk_embs = [[0.1, 0.21, ..., 0.29], ...]  # n x 384
            >>> scores = RetrievalService.cosine_similarity_search(query_emb, chunk_embs)
            >>> scores
            array([[0.95, 0.87, 0.45, ...]])
        """
        if not chunk_embeddings:
            logger.warning("No chunk embeddings provided for similarity search")
            return np.array([])
        
        try:
            # Convert to numpy arrays for sklearn
            query_array = np.array([query_embedding])  # Shape: (1, 384)
            chunks_array = np.array(chunk_embeddings)  # Shape: (n_chunks, 384)
            
            # Validate dimensions
            if query_array.shape[1] != chunks_array.shape[1]:
                raise ValueError(
                    f"Embedding dimension mismatch: query {query_array.shape[1]} "
                    f"vs chunks {chunks_array.shape[1]}"
                )
            
            # Compute cosine similarity: (1, n_chunks)
            similarities = cosine_similarity(query_array, chunks_array)
            
            logger.debug(
                f"Computed cosine similarities for {len(chunk_embeddings)} chunks. "
                f"Scores range: [{similarities.min():.4f}, {similarities.max():.4f}]"
            )
            
            # Return flattened array of scores
            return similarities[0]
            
        except Exception as e:
            logger.error(f"❌ Cosine similarity computation failed: {str(e)}")
            raise

    @staticmethod
    async def retrieve_relevant_chunks(
        db: AsyncIOMotorDatabase,
        query: str,
        user_id: str,
        document_id: Optional[str] = None,
        top_k: int = 10,
        min_score: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Retrieve top-k most relevant chunks for a query.
        
        Main orchestrator method. Workflow:
        1. Generate query embedding
        2. Fetch all chunks with embeddings from MongoDB
        3. Compute similarity scores
        4. Sort by score (descending)
        5. Filter by min_score threshold
        6. Return top-k results
        
        Args:
            db (AsyncIOMotorDatabase): Async MongoDB database connection
            query (str): Search query/question
            user_id (str): User ID requesting retrieval (security check)
            document_id (Optional[str]): Optional document ID to restrict query
            top_k (int): Number of top chunks to return (default: 10)
            min_score (float): Minimum similarity score to include (default: 0.0)
            
        Returns:
            List[Dict[str, Any]]: Top-k relevant chunks with structure:
                [
                    {
                        "chunk_index": 0,
                        "score": 0.91,
                        "content": "Chunk text...",
                        "document_id": "doc_id",
                        "chunk_size": 512
                    },
                    ...
                ]
                
        Raises:
            ValueError: If query is empty or top_k invalid
            RuntimeError: If embedding generation or MongoDB query fails
            
        Example:
            >>> results = await RetrievalService.retrieve_relevant_chunks(
            ...     db, 
            ...     "What is FastAPI?",
            ...     top_k=3
            ... )
            >>> len(results)
            3
            >>> results[0]['score']
            0.92
        """
        logger.info(f"🔍 Semantic search started: query='{query[:60]}...', top_k={top_k}")
        
        # Validate inputs
        if not query or not query.strip():
            raise ValueError("Query cannot be empty")
        if top_k < 1:
            raise ValueError("top_k must be at least 1")
        
        try:
            # Step 1: Generate query embedding
            logger.debug("Step 1: Generating query embedding...")
            query_embedding = await RetrievalService.generate_query_embedding(query)
            
            # Step 2: Fetch document chunks with embeddings scoped by user_id and optionally document_id
            logger.debug("Step 2: Fetching scoped chunks from MongoDB...")
            query_filter = {
                "embedding_vector": {"$exists": True, "$ne": None},
                "embedding_status": "completed",
                "user_id": user_id
            }
            if document_id:
                query_filter["document_id"] = document_id
                
            chunks_cursor = db["document_chunks"].find(
                query_filter,
                {
                    "_id": 1,
                    "document_id": 1,
                    "chunk_index": 1,
                    "content": 1,
                    "chunk_size": 1,
                    "embedding_vector": 1
                }
            )
            
            # Fetch all chunks into memory
            chunks = []
            chunk_embeddings = []
            chunk_metadata = []
            
            async for chunk in chunks_cursor:
                chunks.append(chunk)
                chunk_embeddings.append(chunk.get("embedding_vector", []))
                chunk_metadata.append({
                    "chunk_index": chunk.get("chunk_index", 0),
                    "document_id": str(chunk.get("document_id", "")),
                    "content": chunk.get("content", ""),
                    "chunk_size": chunk.get("chunk_size", 0)
                })
            
            if not chunks:
                logger.warning("⚠️  No chunks with embeddings found in MongoDB")
                return []
            
            logger.info(f"✅ Fetched {len(chunks)} chunks with embeddings")
            
            # Step 3: Compute similarity scores
            logger.debug("Step 3: Computing cosine similarity scores...")
            similarity_scores = RetrievalService.cosine_similarity_search(
                query_embedding,
                chunk_embeddings
            )
            
            logger.debug(
                f"Similarity scores computed. Max: {similarity_scores.max():.4f}, "
                f"Min: {similarity_scores.min():.4f}"
            )
            
            # Step 4: Create results with scores and sort
            logger.debug("Step 4: Sorting and filtering results...")
            results_with_scores: List[Dict[str, Any]] = []
            
            for i, (metadata, score) in enumerate(zip(chunk_metadata, similarity_scores)):
                if score >= min_score:
                    result = {
                        "chunk_index": metadata["chunk_index"],
                        "score": float(score),
                        "content": metadata["content"],
                        "document_id": metadata["document_id"],
                        "chunk_size": metadata["chunk_size"]
                    }
                    results_with_scores.append(result)
            
            # Sort by score descending
            results_with_scores.sort(key=lambda x: x["score"], reverse=True)
            
            # Step 5: Deduplicate Retrieved Chunks before applying top_k
            logger.info(f"Total results before deduplication: {len(results_with_scores)}")
            
            seen = set()
            deduplicated = []
            for result in results_with_scores:
                fingerprint = hash(result["content"][:200])
                if fingerprint in seen:
                    continue
                seen.add(fingerprint)
                deduplicated.append(result)
                
            logger.info(f"Total results after deduplication: {len(deduplicated)}")
            
            # Get top-k results
            top_results = deduplicated[:top_k]
            
            top_score_str = (f"{top_results[0]['score']:.4f}" if top_results else "N/A")
            logger.info(
                f"✅ Semantic search completed. Returning {len(top_results)} / {top_k} "
                f"chunks (threshold: {min_score:.2f}). "
                f"Top score: {top_score_str}"
            )
            
            return top_results
            
        except ValueError as e:
            logger.error(f"❌ Validation error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"❌ Retrieval failed: {str(e)}", exc_info=True)
            raise RuntimeError(f"Semantic search failed: {str(e)}")


# Singleton instance
retrieval_service = RetrievalService()
