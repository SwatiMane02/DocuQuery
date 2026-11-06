"""
Analytics API router for user-level metrics, usage statistics, and activity timeline.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.db.database import get_database
from app.models.user import User

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)


class ActivityItem(BaseModel):
    title: str
    type: str  # "document_upload" | "ai_query" | "conversation"
    timestamp: datetime
    meta: Optional[str] = None


class DailyQueryCount(BaseModel):
    date: str  # "YYYY-MM-DD"
    queries: int


class TopDocumentStat(BaseModel):
    id: str
    name: str
    file_type: str
    file_size: int
    upload_date: datetime
    chunk_count: int = 0


class UserAnalyticsResponse(BaseModel):
    total_documents: int
    total_conversations: int
    total_queries: int
    storage_used_bytes: int
    storage_limit_bytes: int
    documents_limit: int
    user_role: str
    recent_activity: List[ActivityItem]
    daily_queries: List[DailyQueryCount]
    top_documents: List[TopDocumentStat]


@router.get("/user", response_model=UserAnalyticsResponse, summary="Get user-specific analytics and dashboard metrics")
async def get_user_analytics(
    current_user: User = Depends(get_current_user),
) -> UserAnalyticsResponse:
    user_id = str(current_user.id)
    db = get_database()

    # 1. Counts
    total_docs = await db.documents.count_documents({"user_id": user_id})
    total_convs = await db.conversations.count_documents({"user_id": user_id})
    total_queries = await db.messages.count_documents({"user_id": user_id, "from_user": "user"})

    # 2. Documents & storage aggregation
    cursor = db.documents.find({"user_id": user_id}).sort("upload_date", -1)
    docs_list = await cursor.to_list(length=100)

    storage_used_bytes = sum(doc.get("file_size", 0) for doc in docs_list)
    storage_limit_bytes = (current_user.documents_limit or 10) * 50 * 1024 * 1024

    top_documents = [
        TopDocumentStat(
            id=str(d["_id"]),
            name=d.get("filename", "Untitled"),
            file_type=d.get("file_type", "application/pdf"),
            file_size=d.get("file_size", 0),
            upload_date=d.get("upload_date", datetime.utcnow()),
            chunk_count=d.get("chunk_count", 0),
        )
        for d in docs_list[:5]
    ]

    # 3. Activity timeline (combine latest documents & messages)
    activity: List[ActivityItem] = []
    for d in docs_list[:5]:
        activity.append(
            ActivityItem(
                title=f"Uploaded {d.get('filename')}",
                type="document_upload",
                timestamp=d.get("upload_date", datetime.utcnow()),
                meta=f"{(d.get('file_size', 0) / (1024*1024)):.1f} MB",
            )
        )

    msg_cursor = db.messages.find({"user_id": user_id, "from_user": "user"}).sort("created_at", -1).limit(5)
    recent_msgs = await msg_cursor.to_list(length=5)
    for m in recent_msgs:
        content_preview = m.get("content", "")[:35] + ("..." if len(m.get("content", "")) > 35 else "")
        activity.append(
            ActivityItem(
                title=f"Asked: \"{content_preview}\"",
                type="ai_query",
                timestamp=m.get("created_at", datetime.utcnow()),
                meta="AI Query",
            )
        )

    activity.sort(key=lambda x: x.timestamp, reverse=True)

    # 4. Daily query breakdown for last 7 days
    today = datetime.utcnow().date()
    days_map = { (today - timedelta(days=i)).isoformat(): 0 for i in range(6, -1, -1) }

    # Fetch queries within last 7 days
    start_date = datetime.combine(today - timedelta(days=6), datetime.min.time())
    query_logs = await db.messages.find({
        "user_id": user_id,
        "from_user": "user",
        "created_at": {"$gte": start_date}
    }).to_list(length=1000)

    for q in query_logs:
        dt = q.get("created_at")
        if isinstance(dt, datetime):
            day_str = dt.date().isoformat()
            if day_str in days_map:
                days_map[day_str] += 1

    daily_queries = [
        DailyQueryCount(date=d, queries=count) for d, count in sorted(days_map.items())
    ]

    return UserAnalyticsResponse(
        total_documents=total_docs,
        total_conversations=total_convs,
        total_queries=total_queries,
        storage_used_bytes=storage_used_bytes,
        storage_limit_bytes=storage_limit_bytes,
        documents_limit=current_user.documents_limit,
        user_role=current_user.role,
        recent_activity=activity[:10],
        daily_queries=daily_queries,
        top_documents=top_documents,
    )
