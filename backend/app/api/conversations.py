"""
Conversation & Message API routes for persistent multi-turn RAG chat sessions.
"""

import logging
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.core.config import settings
from app.db.database import get_database
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdateRequest,
    MessageResponse,
    SendMessageRequest,
)
from app.schemas.document import ChatSourceMetadata
from app.services.conversation_service import conversation_service
from app.services.retrieval_service import retrieval_service
from app.services.llm_service import llm_service
from app.services.rate_limiter import chat_rate_limiter
from app.services.metrics_service import llm_metrics
from app.services.llm_errors import (
    LLMAuthError,
    LLMQuotaExceededError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/conversations",
    tags=["conversations"],
)


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation session",
)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
) -> ConversationResponse:
    user_id = str(current_user.id)
    conv = await conversation_service.create_conversation(
        user_id=user_id,
        title=payload.title,
        document_id=payload.document_id,
        document_name=payload.document_name,
    )
    return ConversationResponse(
        id=str(conv.id),
        user_id=conv.user_id,
        title=conv.title,
        document_id=conv.document_id,
        document_name=conv.document_name,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get(
    "",
    response_model=ConversationListResponse,
    summary="List conversations for current user",
)
async def list_conversations(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
) -> ConversationListResponse:
    user_id = str(current_user.id)
    convs, total = await conversation_service.list_conversations(
        user_id=user_id,
        skip=skip,
        limit=limit,
    )
    return ConversationListResponse(
        conversations=[
            ConversationResponse(
                id=str(c.id),
                user_id=c.user_id,
                title=c.title,
                document_id=c.document_id,
                document_name=c.document_name,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in convs
        ],
        total=total,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Get conversation details and messages",
)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
) -> ConversationDetailResponse:
    user_id = str(current_user.id)
    conv = await conversation_service.get_conversation(
        conversation_id=conversation_id,
        user_id=user_id,
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    messages = await conversation_service.get_conversation_messages(
        conversation_id=conversation_id,
        user_id=user_id,
    )

    return ConversationDetailResponse(
        conversation=ConversationResponse(
            id=str(conv.id),
            user_id=conv.user_id,
            title=conv.title,
            document_id=conv.document_id,
            document_name=conv.document_name,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ),
        messages=[
            MessageResponse(
                id=str(m.id),
                conversation_id=m.conversation_id,
                from_user=m.from_user,
                content=m.content,
                sources=[ChatSourceMetadata(**s) for s in (m.sources or [])],
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


@router.patch(
    "/{conversation_id}",
    response_model=ConversationResponse,
    summary="Rename a conversation",
)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> ConversationResponse:
    user_id = str(current_user.id)
    conv = await conversation_service.rename_conversation(
        conversation_id=conversation_id,
        user_id=user_id,
        new_title=payload.title,
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or cannot be updated",
        )
    return ConversationResponse(
        id=str(conv.id),
        user_id=conv.user_id,
        title=conv.title,
        document_id=conv.document_id,
        document_name=conv.document_name,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.delete(
    "/{conversation_id}/messages",
    status_code=status.HTTP_200_OK,
    summary="Clear all messages in a conversation",
)
async def clear_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    user_id = str(current_user.id)
    success = await conversation_service.clear_conversation_messages(
        conversation_id=conversation_id,
        user_id=user_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or cannot be cleared",
        )
    return {"message": "Conversation messages cleared successfully", "id": conversation_id}


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete conversation and its messages",
)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    user_id = str(current_user.id)
    success = await conversation_service.delete_conversation(
        conversation_id=conversation_id,
        user_id=user_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or cannot be deleted",
        )
    return {"message": "Conversation deleted successfully", "id": conversation_id}


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a message to conversation with RAG retrieval and persistence",
)
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    user_id = str(current_user.id)
    conv = await conversation_service.get_conversation(
        conversation_id=conversation_id,
        user_id=user_id,
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # Check rate limit
    if not chat_rate_limiter.allow(user_id):
        llm_metrics.increment("rate_limited")
        retry_after = chat_rate_limiter.retry_after_seconds(user_id)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({settings.RATE_LIMIT_PER_MINUTE}/min). Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    # 1. Save user message
    await conversation_service.add_message(
        conversation_id=conversation_id,
        user_id=user_id,
        from_user="user",
        content=payload.query.strip(),
    )

    # Effective document scoping
    doc_id = payload.document_id if payload.document_id is not None else conv.document_id

    db = get_database()

    # Pre-check document status when scoped to a specific document
    if doc_id:
        user_id_variants = [str(user_id)]
        if ObjectId.is_valid(user_id):
            user_id_variants.append(ObjectId(user_id))

        doc_id_variants = [str(doc_id)]
        if ObjectId.is_valid(doc_id):
            doc_id_variants.append(ObjectId(doc_id))

        doc_obj = await db.documents.find_one({
            "_id": {"$in": doc_id_variants},
            "user_id": {"$in": user_id_variants}
        })

        if not doc_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected document was not found or does not belong to your account.",
            )

        chunk_status = doc_obj.get("chunk_status")
        extraction_status = doc_obj.get("extraction_status")
        chunk_count = doc_obj.get("chunk_count", 0)

        # If chunk_count is 0 or status is pending, check if chunks actually exist in document_chunks
        if chunk_count == 0 or chunk_status in ["pending", "processing"]:
            actual_count = await db.document_chunks.count_documents({
                "document_id": {"$in": doc_id_variants},
                "user_id": {"$in": user_id_variants}
            })
            if actual_count > 0:
                chunk_count = actual_count
                chunk_status = "chunked"
                await db.documents.update_one(
                    {"_id": doc_obj["_id"], "user_id": {"$in": user_id_variants}},
                    {"$set": {"chunk_count": actual_count, "chunk_status": "chunked"}}
                )
            elif doc_obj.get("extracted_text"):
                # Document has extracted text, retrieval_service can auto-chunk it on the fly
                chunk_count = 1
                chunk_status = "chunked"

        # Check pending/processing
        if chunk_status in ["pending", "processing"] or extraction_status in ["pending", "processing"]:
            ai_answer = "This document is still being processed and indexed. Please wait a moment and try again once processing completes."
            ai_msg = await conversation_service.add_message(
                conversation_id=conversation_id,
                user_id=user_id,
                from_user="ai",
                content=ai_answer,
                sources=[],
            )
            return MessageResponse(
                id=str(ai_msg.id),
                conversation_id=ai_msg.conversation_id,
                from_user=ai_msg.from_user,
                content=ai_msg.content,
                sources=[],
                created_at=ai_msg.created_at,
            )

        # Check failed status
        if chunk_status == "failed" or extraction_status == "failed":
            ai_answer = "Text extraction failed for this document. Please re-upload or upload a supported, readable PDF."
            ai_msg = await conversation_service.add_message(
                conversation_id=conversation_id,
                user_id=user_id,
                from_user="ai",
                content=ai_answer,
                sources=[],
            )
            return MessageResponse(
                id=str(ai_msg.id),
                conversation_id=ai_msg.conversation_id,
                from_user=ai_msg.from_user,
                content=ai_msg.content,
                sources=[],
                created_at=ai_msg.created_at,
            )

        # Check zero chunks extracted
        if chunk_count == 0:
            ai_answer = "No readable text content could be extracted from this document."
            ai_msg = await conversation_service.add_message(
                conversation_id=conversation_id,
                user_id=user_id,
                from_user="ai",
                content=ai_answer,
                sources=[],
            )
            return MessageResponse(
                id=str(ai_msg.id),
                conversation_id=ai_msg.conversation_id,
                from_user=ai_msg.from_user,
                content=ai_msg.content,
                sources=[],
                created_at=ai_msg.created_at,
            )

    # 2. Retrieve relevant chunks
    try:
        retrieved_chunks = await retrieval_service.retrieve_relevant_chunks(
            db=db,
            query=payload.query,
            user_id=user_id,
            document_id=doc_id,
            top_k=settings.TOP_K_RESULTS,
            min_score=0.0,
        )

        if not retrieved_chunks:
            ai_answer = "I couldn't find relevant information in the selected document."
            sources: List[dict] = []
        else:
            llm_metrics.increment("gemini_requests")
            llm_result = await llm_service.generate_answer(
                query=payload.query,
                chunks=retrieved_chunks,
                model=llm_service.DEFAULT_MODEL,
            )
            ai_answer = llm_result["answer"]
            if ai_answer == "NOT_FOUND":
                ai_answer = "I could not find information relevant to your question in the document. Please verify your query or check if the topic is covered in this document."

            # Enrich source metadata with filenames
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
                {
                    "document_id": chunk["document_id"],
                    "chunk_index": chunk["chunk_index"],
                    "score": round(max(0.0, min(1.0, float(chunk.get("score", 0.0)))), 4),
                    "content": chunk.get("content"),
                    "document_name": doc_names.get(chunk["document_id"]),
                }
                for chunk in retrieved_chunks
            ]

        # 3. Save AI message
        ai_msg = await conversation_service.add_message(
            conversation_id=conversation_id,
            user_id=user_id,
            from_user="ai",
            content=ai_answer,
            sources=sources,
        )

        return MessageResponse(
            id=str(ai_msg.id),
            conversation_id=ai_msg.conversation_id,
            from_user=ai_msg.from_user,
            content=ai_msg.content,
            sources=[ChatSourceMetadata(**s) for s in (ai_msg.sources or [])],
            created_at=ai_msg.created_at,
        )

    except HTTPException:
        raise
    except LLMAuthError as e:
        llm_metrics.increment("auth_failures")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except (LLMQuotaExceededError, LLMRateLimitError) as e:
        llm_metrics.increment("quota_failures")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except LLMTimeoutError as e:
        llm_metrics.increment("timeout_failures")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI service timed out while generating an answer. Please retry your question.",
        )
    except LLMUnavailableError as e:
        llm_metrics.increment("provider_failures")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI provider is temporarily unavailable. Please retry your question in a moment.",
        )
    except Exception as e:
        logger.error(f"Error during chat answering: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing failed: {str(e)}",
        )
