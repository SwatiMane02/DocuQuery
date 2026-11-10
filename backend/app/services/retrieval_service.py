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
from datetime import datetime
import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
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

    _doc_locks: Dict[str, asyncio.Lock] = {}

    @classmethod
    def _get_doc_lock(cls, key: str) -> asyncio.Lock:
        if key not in cls._doc_locks:
            cls._doc_locks[key] = asyncio.Lock()
        return cls._doc_locks[key]

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
        Compute cosine similarity between query and chunk embeddings using pure NumPy.
        Lightweight and fast without requiring scikit-learn in memory.
        """
        if not chunk_embeddings:
            logger.warning("No chunk embeddings provided for similarity search")
            return np.array([])
        
        try:
            q = np.array(query_embedding, dtype=np.float32)
            c = np.array(chunk_embeddings, dtype=np.float32)
            
            if q.shape[0] != c.shape[1]:
                raise ValueError(
                    f"Embedding dimension mismatch: query {q.shape[0]} vs chunks {c.shape[1]}"
                )
            
            dot = np.dot(c, q)
            norm_q = np.linalg.norm(q)
            norm_c = np.linalg.norm(c, axis=1)
            denom = norm_q * norm_c
            denom[denom == 0] = 1e-9
            
            similarities = dot / denom
            return similarities
            
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
            
            # Step 2: Fetch document chunks scoped by user_id and optionally document_id
            # Support both string and ObjectId representations in MongoDB
            user_id_variants = [str(user_id)]
            if ObjectId.is_valid(user_id):
                user_id_variants.append(ObjectId(user_id))

            query_filter: Dict[str, Any] = {
                "user_id": {"$in": user_id_variants}
            }

            doc_id_variants = []
            if document_id:
                doc_id_variants = [str(document_id)]
                if ObjectId.is_valid(document_id):
                    doc_id_variants.append(ObjectId(document_id))
                query_filter["document_id"] = {"$in": doc_id_variants}
                
            chunks_cursor = db["document_chunks"].find(
                query_filter,
                {
                    "_id": 1,
                    "document_id": 1,
                    "user_id": 1,
                    "chunk_index": 1,
                    "content": 1,
                    "chunk_size": 1,
                    "embedding_vector": 1,
                    "embedding_model": 1,
                    "embedding_status": 1,
                }
            ).sort("chunk_index", 1)
            
            # Fetch all chunks for this scope into memory
            chunks = await chunks_cursor.to_list(length=1000)
            
            # Step 2.1: Idempotent self-healing if document has 0 chunks but has extracted text in MongoDB
            if not chunks and document_id:
                lock_key = f"chunk_{document_id}"
                async with RetrievalService._get_doc_lock(lock_key):
                    # Re-check in case a concurrent coroutine already finished chunking
                    existing_check = await db["document_chunks"].find(query_filter).sort("chunk_index", 1).to_list(1000)
                    if existing_check:
                        chunks = existing_check
                    else:
                        logger.info(f"No chunks found in document_chunks for doc {document_id}. Checking for extracted text...")
                        doc_record = await db["documents"].find_one({
                            "_id": {"$in": doc_id_variants},
                            "user_id": {"$in": user_id_variants}
                        })
                        if doc_record and doc_record.get("extracted_text"):
                            extracted_text = doc_record["extracted_text"]
                            logger.info(f"Auto-chunking document {document_id} from extracted_text ({len(extracted_text)} chars)...")
                            try:
                                from app.services.chunking_service import chunking_service
                                chunk_count, _ = await chunking_service.process_document_chunks(
                                    db=db,
                                    extracted_text=extracted_text,
                                    document_id=str(document_id),
                                    user_id=str(user_id)
                                )
                                if chunk_count > 0:
                                    chunks = await db["document_chunks"].find(query_filter).sort("chunk_index", 1).to_list(1000)
                            except Exception as chunk_err:
                                logger.warning(f"Auto-chunking fallback failed: {chunk_err}")

            if not chunks:
                logger.warning(f"⚠️ No chunks found in MongoDB for user={user_id[:8]}... doc={document_id}")
                return []
            
            logger.info(f"✅ Fetched {len(chunks)} raw chunks from MongoDB")

            # Step 2.5: Idempotent re-embedding / missing-embedding healing guarantee
            # Check for chunks that have no embedding, wrong dimension, or legacy model
            chunks_needing_embedding = []
            for chunk in chunks:
                vec = chunk.get("embedding_vector")
                model = chunk.get("embedding_model")
                status = chunk.get("embedding_status")
                
                needs_embed = False
                if not vec or not isinstance(vec, list) or len(vec) != embedding_service.EMBEDDING_DIMENSIONS:
                    needs_embed = True
                elif model != embedding_service.MODEL_NAME:
                    needs_embed = True
                elif status != "completed":
                    needs_embed = True
                    
                if needs_embed and chunk.get("content") and str(chunk.get("content")).strip():
                    chunks_needing_embedding.append(chunk)

            if chunks_needing_embedding:
                embed_lock_key = f"embed_{document_id}" if document_id else f"embed_user_{user_id}"
                async with RetrievalService._get_doc_lock(embed_lock_key):
                    # Re-check database to ensure another concurrent request hasn't already embedded them
                    recheck_chunks = await db["document_chunks"].find(
                        {"_id": {"$in": [c["_id"] for c in chunks_needing_embedding]}}
                    ).to_list(len(chunks_needing_embedding))

                    still_needing = []
                    for c in recheck_chunks:
                        vec = c.get("embedding_vector")
                        model = c.get("embedding_model")
                        status = c.get("embedding_status")
                        if not vec or len(vec) != embedding_service.EMBEDDING_DIMENSIONS or model != embedding_service.MODEL_NAME or status != "completed":
                            still_needing.append(c)

                    if still_needing:
                        logger.info(
                            f"🔄 Auto-generating/upgrading Gemini embeddings for "
                            f"{len(still_needing)}/{len(chunks)} chunks..."
                        )
                        try:
                            generated_tuples = await embedding_service.generate_embeddings_for_chunks(
                                still_needing,
                                batch_size=16
                            )
                            await embedding_service.store_embeddings_in_mongodb(db, generated_tuples)

                            # If this was a single document, ensure document metadata reflects indexed state
                            if document_id:
                                await db["documents"].update_one(
                                    {"_id": {"$in": doc_id_variants}, "user_id": {"$in": user_id_variants}},
                                    {
                                        "$set": {
                                            "chunk_status": "chunked",
                                            "processing_status": "completed",
                                            "chunk_count": len(chunks)
                                        }
                                    }
                                )
                            logger.info(f"✅ Successfully healed {len(generated_tuples)} chunk embeddings")
                        except Exception as auto_embed_err:
                            logger.error(f"❌ Auto-embedding generation failed: {auto_embed_err}")
                            raise

                    # Re-fetch chunks with their updated embeddings
                    chunks = await db["document_chunks"].find(query_filter).sort("chunk_index", 1).to_list(1000)

            # Keep only chunks that have a valid embedding vector of the expected dimension
            valid_chunks = []
            chunk_embeddings = []
            chunk_metadata = []

            for chunk in chunks:
                vec = chunk.get("embedding_vector")
                if vec and isinstance(vec, list) and len(vec) == embedding_service.EMBEDDING_DIMENSIONS:
                    valid_chunks.append(chunk)
                    chunk_embeddings.append(vec)
                    chunk_metadata.append({
                        "chunk_index": chunk.get("chunk_index", 0),
                        "document_id": str(chunk.get("document_id", "")),
                        "content": chunk.get("content", ""),
                        "chunk_size": chunk.get("chunk_size", 0)
                    })

            if not valid_chunks:
                logger.error("❌ No valid chunks with completed 384-dim embeddings available for retrieval")
                raise RuntimeError("Failed to retrieve valid embeddings for document chunks. Please retry in a moment.")
            
            # Step 3: Compute similarity scores
            logger.debug(f"Step 3: Computing cosine similarity scores for {len(valid_chunks)} chunks...")
            similarity_scores = RetrievalService.cosine_similarity_search(
                query_embedding,
                chunk_embeddings
            )
            
            score_max = float(similarity_scores.max()) if len(similarity_scores) > 0 else 0.0
            score_min = float(similarity_scores.min()) if len(similarity_scores) > 0 else 0.0
            score_mean = float(similarity_scores.mean()) if len(similarity_scores) > 0 else 0.0
            logger.info(
                f"Similarity scores: max={score_max:.4f}, min={score_min:.4f}, mean={score_mean:.4f} "
                f"(threshold={min_score:.2f})"
            )
            
            # Step 4: Create results with scores and sort
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
            
            # Fallback for document-scoped queries (e.g., "summarize this document")
            # If scoped to a specific document and all scores were below min_score,
            # include top chunks strictly and only from the selected, authorized document.
            if document_id and not results_with_scores and valid_chunks:
                logger.info("Document-scoped query fallback: all scores below min_score, including top chunks")
                allowed_doc_ids = {str(d) for d in doc_id_variants}
                fallback_candidates = []
                for metadata, score in zip(chunk_metadata, similarity_scores):
                    if str(metadata.get("document_id")) in allowed_doc_ids:
                        fallback_candidates.append({
                            "chunk_index": metadata["chunk_index"],
                            "score": max(0.0, float(score)),
                            "content": metadata["content"],
                            "document_id": metadata["document_id"],
                            "chunk_size": metadata["chunk_size"]
                        })
                fallback_candidates.sort(key=lambda x: x["score"], reverse=True)
                results_with_scores = fallback_candidates

            # Sort by score descending
            results_with_scores.sort(key=lambda x: x["score"], reverse=True)
            
            # Step 5: Deduplicate Retrieved Chunks before applying top_k
            seen = set()
            deduplicated = []
            for result in results_with_scores:
                fingerprint = hash(result["content"][:200])
                if fingerprint in seen:
                    continue
                seen.add(fingerprint)
                deduplicated.append(result)
                
            # Get top-k results
            top_results = deduplicated[:top_k]
            
            top_score_str = (f"{top_results[0]['score']:.4f}" if top_results else "N/A")
            logger.info(
                f"✅ Semantic search completed. Returning {len(top_results)} / {top_k} "
                f"chunks. Top score: {top_score_str}"
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
