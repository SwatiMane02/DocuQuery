"""
Document upload and management API endpoints.

Endpoints:
- POST /documents/upload: Upload a new document
- GET /documents: List documents for current user
- DELETE /documents/{document_id}: Delete a document

All endpoints require JWT authentication.

How file uploads work in FastAPI:
1. Client sends multipart/form-data with file
2. FastAPI creates UploadFile object
3. We validate, save file, store metadata
4. Return document info to client

multipart/form-data encoding:
- Sends file as binary stream
- Includes file metadata (filename, content-type)
- Client uses: FormData in JavaScript, requests.files in Python, etc.
"""

from typing import Any
import logging
import httpx

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse

from app.api.auth import get_current_user
from app.models.user import User
from app.schemas.document import (
    DocumentDeleteResponse,
    DocumentListResponse,
    DocumentResponse,
    UploadResponse,
    EmbeddingResponse,
    SearchRequest,
    SearchResponse,
    SearchResultChunk,
    ChatRequest,
    ChatResponse,
    ChatSourceMetadata,
)
from app.core.config import settings
from app.services.document_service import document_service
from app.services.embedding_service import embedding_service
from app.services.retrieval_service import retrieval_service
from app.services.llm_service import llm_service
from app.services.llm_provider_factory import get_llm_provider
from app.services.cache_service import chat_cache, build_cache_key
from app.services.rate_limiter import chat_rate_limiter
from app.services.metrics_service import llm_metrics
from app.services.llm_errors import (
    LLMAuthError,
    LLMModelNotFoundError,
    LLMQuotaExceededError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)


# ============================================================================
# ROUTER SETUP
# ============================================================================

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)


# ============================================================================
# ROUTES
# ============================================================================

@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document"
)
async def upload_document(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    """
    Upload a document file.
    
    How UploadFile Works:
    - FastAPI automatically parses multipart/form-data
    - UploadFile object provides:
        - file: BytesIO object with file content
        - filename: Original filename
        - content_type: MIME type (e.g., "application/pdf")
        - size: File size in bytes (may be None)
    
    Authentication:
    - Requires JWT token in Authorization header
    - FastAPI extracts from "Authorization: Bearer <token>"
    - get_current_user validates token and returns User
    
    Validation:
    - Check file type is allowed (PDF, DOCX, TXT, CSV)
    - Check file size < 50MB
    - Check extension matches MIME type (security)
    
    File Storage:
    - Saves to backend/uploads/{user_id}/{filename}
    - Stores metadata in MongoDB documents collection
    - Metadata linked to user via user_id
    
    Error Handling:
    - 400: File type not allowed or file too large
    - 401: Invalid/missing token
    - 422: Invalid input
    
    Request:
    - Content-Type: multipart/form-data
    - Body: file=<binary>
    
    Response (201 Created):
    {
        "message": "File uploaded successfully",
        "document_id": "507f...",
        "filename": "resume.pdf",
        "file_size": 245632,
        "file_type": "application/pdf",
        "status": "uploaded"
    }
    
    Args:
        file: File uploaded by client (FastAPI extracts from form data)
        current_user: User from JWT token (injected by Depends)
    
    Returns:
        UploadResponse with document metadata
        
    Raises:
        HTTPException 400: Invalid file
        HTTPException 401: Authentication failed
    """
    # Read file content into memory
    # file.file is BytesIO object
    file_content = await file.read()
    
    # Get file metadata
    filename = file.filename or "unknown"
    file_size = len(file_content)
    content_type = file.content_type or "application/octet-stream"
    
    try:
        # Upload to document service
        # Service validates, saves file, stores metadata
        document = await document_service.upload_document(
            file_content=file_content,
            filename=filename,
            file_size=file_size,
            content_type=content_type,
            user_id=str(current_user.id),
        )
    except ValueError as e:
        # File validation failed
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Unexpected error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )
    
    return UploadResponse(
        message="File uploaded successfully",
        document_id=str(document.id),
        filename=document.filename,
        file_size=document.file_size,
        file_type=document.file_type,
        status=document.status,
    )


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List documents for current user"
)
async def list_documents(
    skip: int = 0,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
) -> DocumentListResponse:
    """
    List documents for the current authenticated user.
    
    Returns:
    - List of documents owned by user
    - Pagination info (total, skip, limit)
    - Sorted by upload_date (newest first)
    
    Pagination:
    - skip: Number of documents to skip (default 0)
    - limit: Max documents to return (default 10, max 100)
    - Use for loading documents page by page
    
    Example pagination:
    - Page 1: skip=0, limit=10 (documents 1-10)
    - Page 2: skip=10, limit=10 (documents 11-20)
    - Page 3: skip=20, limit=10 (documents 21-30)
    
    Security:
    - Only returns documents for authenticated user
    - Query filters by user_id from JWT token
    - User cannot see other users' documents
    
    Request:
    GET /documents?skip=0&limit=10
    Authorization: Bearer <token>
    
    Response (200 OK):
    {
        "documents": [
            {
                "_id": "507f...",
                "filename": "resume.pdf",
                "file_type": "application/pdf",
                "file_size": 245632,
                "upload_date": "2024-05-24T10:30:00Z",
                "status": "uploaded"
            }
        ],
        "total": 25,
        "skip": 0,
        "limit": 10
    }
    
    Args:
        skip: Number of documents to skip (for pagination)
        limit: Max documents to return (for pagination)
        current_user: User from JWT token (injected by Depends)
    
    Returns:
        DocumentListResponse with documents and pagination info
    """
    # Query documents for user
    documents, total = await document_service.list_documents(
        user_id=str(current_user.id),
        skip=skip,
        limit=limit,
    )
    
    # Convert Document models to response schema
    doc_responses = [
        DocumentResponse(
            id=str(doc.id),
            filename=doc.filename,
            file_type=doc.file_type,
            file_size=doc.file_size,
            upload_date=doc.upload_date,
            status=doc.status,
        )
        for doc in documents
    ]
    
    return DocumentListResponse(
        documents=doc_responses,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get single document by ID"
)
async def get_document_by_id(
    document_id: str,
    current_user: User = Depends(get_current_user),
) -> DocumentResponse:
    """
    Get a single document by ID for the current authenticated user.
    """
    doc = await document_service.get_document(
        document_id=document_id,
        user_id=str(current_user.id),
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you don't have permission to access it"
        )
    return DocumentResponse(
        id=str(doc.id),
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        upload_date=doc.upload_date,
        status=doc.status,
    )


@router.get(
    "/{document_id}/download",
    summary="Download original uploaded file"
)
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Stream the original document file for download.
    Preserves strict ownership authentication, retrieving the document
    from Cloudinary (or local filesystem for backward compatibility).
    """
    doc = await document_service.get_document(
        document_id=document_id,
        user_id=str(current_user.id),
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you don't have permission to download it"
        )

    # 1. If stored in Cloudinary, securely stream content to client
    if doc.secure_url:
        try:
            client = httpx.AsyncClient(timeout=60.0)
            req = client.build_request("GET", doc.secure_url)
            res = await client.send(req, stream=True)
            if res.status_code == 200:
                async def stream_generator():
                    try:
                        async for chunk in res.aiter_bytes():
                            yield chunk
                    finally:
                        await res.aclose()
                        await client.aclose()

                return StreamingResponse(
                    stream_generator(),
                    media_type=doc.file_type or "application/octet-stream",
                    headers={
                        "Content-Disposition": f'attachment; filename="{doc.filename}"'
                    }
                )
            else:
                await res.aclose()
                await client.aclose()
                logger.error(f"Cloudinary download returned status {res.status_code} for document {document_id}")
        except Exception as e:
            logger.error(f"Error streaming document from Cloudinary: {str(e)}")

    # 2. Backward compatibility fallback to local filesystem
    file_path = document_service.get_document_path(document_id, str(current_user.id), doc.filename)
    if file_path and file_path.exists():
        return FileResponse(
            path=str(file_path),
            filename=doc.filename,
            media_type=doc.file_type,
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="File not found on server or storage"
    )


@router.delete(
    "/{document_id}",
    response_model=DocumentDeleteResponse,
    summary="Delete a document"
)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
) -> DocumentDeleteResponse:
    """
    Delete a document (removes file and metadata).
    
    Deletes:
    - File from backend/uploads/
    - Metadata from MongoDB
    
    Security:
    - Only owner can delete their document
    - Verified by user_id in database query
    - User ID comes from JWT token (cannot be forged)
    
    Process:
    1. Verify document exists and belongs to user
    2. Delete file from disk
    3. Delete metadata from MongoDB
    4. Return confirmation
    
    Error Handling:
    - 404: Document not found or user doesn't own it
    - 401: Invalid/missing token
    
    Request:
    DELETE /documents/507f1f77bcf86cd799439011
    Authorization: Bearer <token>
    
    Response (200 OK):
    {
        "message": "Document deleted successfully",
        "document_id": "507f1f77bcf86cd799439011",
        "filename": "resume.pdf"
    }
    
    Args:
        document_id: MongoDB ObjectId as string
        current_user: User from JWT token (injected by Depends)
    
    Returns:
        DocumentDeleteResponse with deletion confirmation
        
    Raises:
        HTTPException 404: Document not found or access denied
    """
    # Get document to retrieve filename for response
    document = await document_service.get_document(
        document_id=document_id,
        user_id=str(current_user.id),
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you don't have permission to delete it"
        )
    
    # Delete the document
    success = await document_service.delete_document(
        document_id=document_id,
        user_id=str(current_user.id),
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )
    
    return DocumentDeleteResponse(
        message="Document deleted successfully",
        document_id=document_id,
        filename=document.filename,
    )


@router.post(
    "/{document_id}/generate-embeddings",
    response_model=EmbeddingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate embeddings for document chunks"
)
async def generate_document_embeddings(
    document_id: str,
    current_user: User = Depends(get_current_user),
) -> EmbeddingResponse:
    """
    Generate embeddings for all chunks of a document.
    
    This is a test endpoint to manually trigger embedding generation.
    In production, embeddings would be auto-generated after chunking.
    
    Process:
    1. Verify document exists and belongs to user
    2. Fetch all chunks for document from MongoDB
    3. Generate embedding vectors for each chunk
    4. Store embeddings in document_chunks collection
    5. Return count of chunks embedded
    
    Embedding Model:
    - sentence-transformers/all-MiniLM-L6-v2
    - 384-dimensional embeddings
    - Fast inference (~10ms per chunk)
    
    Error Handling:
    - 404: Document not found or user doesn't own it
    - 400: Document has no chunks to embed
    - 500: Embedding generation failed
    
    Request:
    POST /documents/507f1f77bcf86cd799439011/generate-embeddings
    Authorization: Bearer <token>
    
    Response (200 OK):
    {
        "document_id": "507f1f77bcf86cd799439011",
        "chunks_processed": 42,
        "status": "completed"
    }
    
    Args:
        document_id: MongoDB ObjectId as string
        current_user: User from JWT token (injected by Depends)
    
    Returns:
        EmbeddingResponse with count of embedded chunks
        
    Raises:
        HTTPException 404: Document not found or access denied
        HTTPException 400: No chunks to embed
        HTTPException 500: Embedding generation failed
    """
    from app.db.database import get_database
    
    # Verify document exists and belongs to user
    document = await document_service.get_document(
        document_id=document_id,
        user_id=str(current_user.id),
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you don't have permission to access it"
        )
    
    try:
        # Get database instance
        db = get_database()
        
        # Generate embeddings for all chunks
        chunks_processed, status_message = await embedding_service.process_document_embeddings(
            db=db,
            document_id=document_id,
        )
        
        if chunks_processed == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=status_message or "No chunks to embed"
            )
        
        return EmbeddingResponse(
            document_id=document_id,
            chunks_processed=chunks_processed,
            status="completed",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding generation failed: {str(e)}"
        )


@router.post(
    "/search",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Semantic search across documents"
)
async def semantic_search(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
    top_k: int = 10,
) -> SearchResponse:
    """
    Perform semantic search across all document chunks.
    
    Uses embeddings to find semantically similar chunks, not keyword matching.
    Returns top-k most relevant chunks ranked by cosine similarity.
    
    RAG Pipeline Phase - Retrieval:
    1. Convert user query to embedding (384 dimensions)
    2. Fetch all chunks with embeddings from MongoDB
    3. Compute cosine similarity between query and each chunk
    4. Sort by similarity score (descending)
    5. Return top-k chunks
    
    Key Differences from Keyword Search:
    - Keyword search: "FastAPI" only matches exact/fuzzy "FastAPI"
    - Semantic search: "modern web framework" matches chunks about FastAPI
    - Works with synonyms, rephrasing, different vocabulary
    - Captures meaning, not just words
    
    Example Semantic Matches:
    - Query: "Which Python web framework is used?"
    - Would match chunks about "FastAPI", "Django", "Flask"
    - Even if exact phrase not in chunk
    
    Similarity Scores:
    - Range: 0.0 (completely different) to 1.0 (identical)
    - Typical relevant results: > 0.5
    - Very relevant: > 0.75
    - Highly relevant: > 0.9
    
    Error Handling:
    - 400: Empty query
    - 401: Invalid/missing token
    - 422: Invalid request schema
    - 500: Embedding/similarity computation failed
    
    Request:
    POST /documents/search
    Authorization: Bearer <token>
    {
        "query": "What programming languages are used?"
    }
    
    Response (200 OK):
    {
        "query": "What programming languages are used?",
        "matches": [
            {
                "chunk_index": 0,
                "score": 0.92,
                "content": "FastAPI uses Python 3.7+...",
                "document_id": "507f1f77bcf86cd799439011",
                "chunk_size": 512
            },
            {
                "chunk_index": 3,
                "score": 0.85,
                "content": "JavaScript and TypeScript for frontend...",
                "document_id": "507f1f77bcf86cd799439012",
                "chunk_size": 512
            }
        ]
    }
    
    Query Parameters:
    - top_k: Number of top results to return (default 10, max 20)
    
    Args:
        search_request: SearchRequest with "query" field
        current_user: User from JWT token (injected by Depends)
        top_k: Number of top results to return (query parameter)
    
    Returns:
        SearchResponse with matched chunks sorted by score
        
    Raises:
        HTTPException 400: Empty query or invalid parameters
        HTTPException 500: Search computation failed
    """
    from app.db.database import get_database
    
    # Validate top_k parameter
    if top_k < 1 or top_k > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="top_k must be between 1 and 20"
        )
    
    try:
        # Get database instance
        db = get_database()
        
        # Perform semantic search
        logger = __import__("logging").getLogger(__name__)

        matched_chunks = await retrieval_service.retrieve_relevant_chunks(
            db=db,
            query=search_request.query,
            user_id=str(current_user.id),
            document_id=search_request.document_id,
            top_k=top_k,
            min_score=0.0,
        )
        
        # Convert matched chunks to SearchResultChunk schema
        result_chunks = [
            SearchResultChunk(
                chunk_index=chunk["chunk_index"],
                score=chunk["score"],
                content=chunk["content"],
                document_id=chunk["document_id"],
                chunk_size=chunk["chunk_size"],
            )
            for chunk in matched_chunks
        ]
        
        logger.info(
            f"Search completed: {len(result_chunks)} chunks returned "
            f"(user={current_user.email}, doc={search_request.document_id!r})"
        )
        
        return SearchResponse(
            query=search_request.query,
            matches=result_chunks,
        )
    
    except HTTPException:
        raise
    except ValueError as e:
        # Query validation error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Search computation error
        logger = __import__("logging").getLogger(__name__)
        logger.error(f"Semantic search failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic search failed: {str(e)}"
        )


# ============================================================================
# RAG CHAT ENDPOINT (FINAL RAG PIPELINE LAYER)
# ============================================================================

@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="RAG Chat - Answer Questions from Documents",
)
async def chat(
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    top_k: int = settings.TOP_K_RESULTS,
) -> ChatResponse:
    """
    Complete RAG pipeline chat endpoint.
    
    Answers user questions using document context through:
    1. Semantic retrieval - Find relevant document chunks
    2. Prompt building - Create context-aware prompt
    3. LLM generation - Generate answer using the Gemini model
    4. Source tracking - Return which chunks were used

    The RAG Pipeline:
    User Query → Query Embedding → Similarity Search → Top Chunks →
    Prompt Building → LLM Generation → AI Answer

    This completes the full RAG stack:
    - MongoDB for document storage
    - Embeddings for semantic understanding
    - Cosine similarity for chunk retrieval
    - Gemini LLM for answer generation

    Error Handling:
    - 400: Empty query or invalid parameters
    - 401: Invalid/missing token, or Gemini API key invalid
    - 422: Invalid request schema
    - 429: Gemini quota exceeded or rate-limited
    - 503: Gemini API unavailable / model not found
    - 504: Gemini API timeout
    - 500: Other processing errors

    Requirements:
    - GEMINI_API_KEY must be configured in .env
    - User must have uploaded documents with embeddings
    
    Request:
    POST /chat
    Authorization: Bearer <token>
    {
        "query": "What databases are mentioned in the documents?"
    }
    
    Response (200 OK):
    {
        "query": "What databases are mentioned in the documents?",
        "answer": "MongoDB and PostgreSQL are the databases mentioned...",
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
    
    Query Parameters:
    - top_k: Number of context chunks to retrieve (default 10, max 20)
    
    Args:
        chat_request: ChatRequest with "query" field
        current_user: User from JWT token (injected by Depends)
        top_k: Number of top chunks to use as context
    
    Returns:
        ChatResponse with LLM answer and source metadata
        
    Raises:
        HTTPException 400: Empty query or invalid parameters
        HTTPException 401: Gemini API key invalid
        HTTPException 429: Gemini quota exceeded or rate-limited
        HTTPException 503: Gemini API unavailable / model not found
        HTTPException 504: Gemini API timeout
        HTTPException 500: Other processing errors
    """
    import asyncio
    import logging
    import time
    from app.db.database import get_database

    logger = logging.getLogger(__name__)

    # Validate top_k parameter
    if top_k < 1 or top_k > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="top_k must be between 1 and 20"
        )

    user_id = str(current_user.id)

    # Rate limit - protects the Gemini API from a single user hammering it.
    if not chat_rate_limiter.allow(user_id):
        llm_metrics.increment("rate_limited")
        retry_after = chat_rate_limiter.retry_after_seconds(user_id)
        logger.warning(f"⏳ Rate limit exceeded: user={current_user.email}, retry_after={retry_after}s")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({settings.RATE_LIMIT_PER_MINUTE}/min). Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    request_start = time.monotonic()
    cache_key = build_cache_key(
        user_id=user_id,
        document_id=chat_request.document_id,
        question=chat_request.query,
    )

    def _log_line(event: str, **fields: Any) -> None:
        parts = ", ".join(f"{k}={v}" for k, v in fields.items())
        logger.info(f"{event}: user_id={user_id}, document_id={chat_request.document_id}, {parts}")

    # Exact cache check - identical (user, document, question) within the
    # TTL window skips retrieval + the Gemini call entirely.
    cached_response = chat_cache.get(cache_key)
    if cached_response is not None:
        llm_metrics.increment("cache_hits")
        llm_metrics.observe_latency((time.monotonic() - request_start) * 1000)
        _log_line(
            "RAG chat cache hit",
            query=f"'{chat_request.query[:60]}'",
            response_time_ms=f"{(time.monotonic() - request_start) * 1000:.0f}",
            cache_hit=True, semantic_cache_hit=False,
        )
        return cached_response

    # Semantic cache check - a differently-worded but near-identical
    # question (cosine similarity >= SEMANTIC_CACHE_THRESHOLD) also skips
    # retrieval + the Gemini call. Reuses the existing embedding model
    # (sentence-transformers/all-MiniLM-L6-v2) - no new model introduced.
    query_embedding = await asyncio.to_thread(
        embedding_service.generate_embedding, chat_request.query.strip()
    )
    semantic_hit = chat_cache.get_semantic(
        user_id=user_id,
        document_id=chat_request.document_id,
        question_embedding=query_embedding,
    )
    if semantic_hit is not None:
        llm_metrics.increment("semantic_cache_hits")
        llm_metrics.observe_latency((time.monotonic() - request_start) * 1000)
        _log_line(
            "RAG chat semantic cache hit",
            query=f"'{chat_request.query[:60]}'",
            response_time_ms=f"{(time.monotonic() - request_start) * 1000:.0f}",
            cache_hit=False, semantic_cache_hit=True,
        )
        chat_cache.set(cache_key, semantic_hit, embedding=query_embedding)
        return semantic_hit

    try:
        db = get_database()

        retrieved_chunks = await retrieval_service.retrieve_relevant_chunks(
            db=db,
            query=chat_request.query,
            user_id=user_id,
            document_id=chat_request.document_id,
            top_k=top_k,
            min_score=0.0,
        )

        # Skip the Gemini call entirely when there is nothing relevant to
        # answer from - saves an API request outright.
        if not retrieved_chunks:
            llm_metrics.increment("gemini_call_skipped_no_chunks")
            chat_response = ChatResponse(
                query=chat_request.query,
                answer="I couldn't find relevant information in the selected document.",
                sources=[],
                model=llm_service.DEFAULT_MODEL,
                num_chunks=0,
            )
            llm_metrics.observe_latency((time.monotonic() - request_start) * 1000)
            _log_line(
                "RAG chat completed (no relevant chunks, Gemini not called)",
                query=f"'{chat_request.query[:60]}'",
                retrieved_chunks=0, chunks_sent=0,
                response_time_ms=f"{(time.monotonic() - request_start) * 1000:.0f}",
                cache_hit=False, semantic_cache_hit=False,
            )
            chat_cache.set(cache_key, chat_response, embedding=query_embedding)
            return chat_response

        # Step 2: Generate LLM answer
        llm_metrics.increment("gemini_requests")
        logger.info("🧠 Calling LLM for answer generation...")

        llm_result = await llm_service.generate_answer(
            query=chat_request.query,
            chunks=retrieved_chunks,
            model=llm_service.DEFAULT_MODEL
        )

        # Step 3: Format response with source metadata & document names
        doc_ids = {chunk["document_id"] for chunk in retrieved_chunks}
        doc_names = {}
        for did in doc_ids:
            try:
                d = await db.documents.find_one({"_id": ObjectId(did)})
                if d:
                    doc_names[did] = d.get("filename")
            except Exception:
                pass

        sources = [
            ChatSourceMetadata(
                document_id=chunk["document_id"],
                chunk_index=chunk["chunk_index"],
                score=chunk["score"],
                content=chunk.get("content"),
                document_name=doc_names.get(chunk["document_id"]),
            )
            for chunk in retrieved_chunks
        ]

        chat_response = ChatResponse(
            query=chat_request.query,
            answer=llm_result["answer"],
            sources=sources,
            model=llm_result["model"],
            num_chunks=len(retrieved_chunks),
        )

        response_time_ms = (time.monotonic() - request_start) * 1000
        llm_metrics.observe_latency(response_time_ms)
        _log_line(
            "RAG chat completed",
            query=f"'{chat_request.query[:60]}'",
            retrieved_chunks=len(retrieved_chunks),
            chunks_sent=llm_result.get("num_chunks_sent"),
            estimated_prompt_tokens=llm_result.get("estimated_prompt_tokens"),
            response_tokens=llm_result.get("response_tokens"),
            model=llm_result["model"],
            retry_count=llm_result.get("retry_count"),
            response_time_ms=f"{response_time_ms:.0f}",
            cache_hit=False, semantic_cache_hit=False,
        )

        chat_cache.set(cache_key, chat_response, embedding=query_embedding)
        return chat_response

    except HTTPException:
        raise
    except ValueError as e:
        # Query validation error
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except LLMAuthError as e:
        llm_metrics.increment("auth_failures")
        logger.error(f"❌ Gemini API key invalid: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    except (LLMQuotaExceededError, LLMRateLimitError) as e:
        llm_metrics.increment("quota_failures")
        logger.error(f"❌ Gemini quota/rate limit: {str(e)}")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))

    except LLMTimeoutError as e:
        llm_metrics.increment("timeouts")
        logger.error(f"❌ Gemini API timeout: {str(e)}")
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))

    except (LLMUnavailableError, LLMModelNotFoundError) as e:
        llm_metrics.increment("unavailable_errors")
        logger.error(f"❌ Gemini API unavailable: {str(e)}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    except RuntimeError as e:
        logger.error(f"❌ LLM generation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM answer generation failed: {str(e)}"
        )

    except Exception as e:
        # Other errors
        logger.error(f"❌ RAG chat failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG chat failed: {str(e)}"
        )


# ============================================================================
# RAG CHAT ENDPOINT - STREAMING VARIANT (OPTIONAL, OFF BY DEFAULT)
# ============================================================================

@router.post(
    "/chat/stream",
    status_code=status.HTTP_200_OK,
    summary="RAG Chat - Streamed Answer (optional, requires STREAMING_ENABLED=true)",
)
async def chat_stream(
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    top_k: int = settings.TOP_K_RESULTS,
) -> StreamingResponse:
    """
    Same RAG pipeline as POST /chat, but streams the answer text as it
    is generated instead of waiting for the full response.

    This is an additive endpoint - POST /chat is unchanged and remains
    the primary, non-streaming API contract the frontend already uses.
    Disabled by default; enable with STREAMING_ENABLED=true in .env.
    Not cached (streamed responses aren't cacheable the same way).
    """
    import logging
    from app.db.database import get_database

    logger = logging.getLogger(__name__)

    if not settings.STREAMING_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Streaming is disabled. Set STREAMING_ENABLED=true to enable it."
        )

    if top_k < 1 or top_k > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="top_k must be between 1 and 20"
        )

    user_id = str(current_user.id)
    if not chat_rate_limiter.allow(user_id):
        retry_after = chat_rate_limiter.retry_after_seconds(user_id)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({settings.RATE_LIMIT_PER_MINUTE}/min). Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    db = get_database()
    retrieved_chunks = await retrieval_service.retrieve_relevant_chunks(
        db=db,
        query=chat_request.query,
        user_id=user_id,
        document_id=chat_request.document_id,
        top_k=top_k,
        min_score=0.0,
    )

    if not retrieved_chunks:
        async def _empty_stream():
            yield "I couldn't find relevant information in the selected document."
        return StreamingResponse(_empty_stream(), media_type="text/plain")

    from app.services.llm_service import LLMService
    dynamic_max_chunks = LLMService.choose_dynamic_chunk_budget(chat_request.query)
    budgeted_chunks = LLMService.select_chunks_within_budget(retrieved_chunks, max_chunks=dynamic_max_chunks)
    prompt = LLMService.build_rag_prompt(chat_request.query, budgeted_chunks)

    provider = get_llm_provider()
    if not hasattr(provider, "generate_answer_stream"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The configured LLM provider does not support streaming."
        )

    llm_metrics.increment("gemini_requests")

    async def _token_stream():
        try:
            async for piece in provider.generate_answer_stream(prompt):
                yield piece
        except (LLMAuthError, LLMQuotaExceededError, LLMRateLimitError,
                LLMTimeoutError, LLMUnavailableError, LLMModelNotFoundError) as e:
            logger.error(f"❌ Streaming failed: {str(e)}")
            yield f"\n[error: {str(e)}]"

    return StreamingResponse(_token_stream(), media_type="text/plain")
