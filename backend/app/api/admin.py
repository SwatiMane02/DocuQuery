"""
Admin management API router for system overview, statistics, and user directory.
"""

from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.auth import get_current_admin
from app.db.database import get_database
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


class AdminStatsResponse(BaseModel):
    total_users: int
    total_documents: int
    total_conversations: int
    total_queries: int
    pro_users_count: int
    admin_users_count: int
    total_storage_bytes: int


class AdminUserListResponse(BaseModel):
    users: List[UserResponse]
    total: int


class AdminUserUpdateRequest(BaseModel):
    role: Optional[str] = Field(None, description="Role: 'free', 'pro', 'admin'")
    is_active: Optional[bool] = Field(None, description="Account active status")
    documents_limit: Optional[int] = Field(None, ge=1, description="Upload limit")


@router.get("/stats", response_model=AdminStatsResponse, summary="Get platform-wide admin statistics")
async def get_admin_stats(
    current_admin: User = Depends(get_current_admin),
) -> AdminStatsResponse:
    db = get_database()

    total_users = await db.users.count_documents({})
    total_docs = await db.documents.count_documents({})
    total_convs = await db.conversations.count_documents({})
    total_queries = await db.messages.count_documents({"from_user": "user"})
    pro_users = await db.users.count_documents({"role": "pro"})
    admin_users = await db.users.count_documents({"role": "admin"})

    # Compute storage
    cursor = db.documents.find({}, {"file_size": 1})
    all_docs = await cursor.to_list(length=10000)
    total_storage = sum(d.get("file_size", 0) for d in all_docs)

    return AdminStatsResponse(
        total_users=total_users,
        total_documents=total_docs,
        total_conversations=total_convs,
        total_queries=total_queries,
        pro_users_count=pro_users,
        admin_users_count=admin_users,
        total_storage_bytes=total_storage,
    )


@router.get("/users", response_model=AdminUserListResponse, summary="List and search users in directory")
async def list_admin_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
) -> AdminUserListResponse:
    db = get_database()

    query: dict = {}
    if role and role.lower() != "all":
        query["role"] = role.lower()

    if search and search.strip():
        term = search.strip()
        query["$or"] = [
            {"email": {"$regex": term, "$options": "i"}},
            {"full_name": {"$regex": term, "$options": "i"}},
        ]

    total = await db.users.count_documents(query)
    cursor = db.users.find(query).sort("created_at", -1).skip(skip).limit(limit)
    user_docs = await cursor.to_list(length=limit)

    users: List[UserResponse] = []
    for u in user_docs:
        u["_id"] = str(u["_id"])
        users.append(UserResponse(**u))

    return AdminUserListResponse(users=users, total=total)


@router.patch("/users/{user_id}", response_model=UserResponse, summary="Update user role or status")
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    current_admin: User = Depends(get_current_admin),
) -> UserResponse:
    db = get_database()
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="User not found")
        doc["_id"] = str(doc["_id"])
        return UserResponse(**doc)

    update_data["updated_at"] = datetime.utcnow()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    updated_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not updated_doc:
        raise HTTPException(status_code=404, detail="User not found")
    updated_doc["_id"] = str(updated_doc["_id"])
    return UserResponse(**updated_doc)


@router.delete("/users/{user_id}", summary="Delete user and associated data")
async def delete_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin),
) -> dict:
    db = get_database()
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # Clean up user's documents and conversations
    await db.documents.delete_many({"user_id": user_id})
    await db.document_chunks.delete_many({"user_id": user_id})
    await db.conversations.delete_many({"user_id": user_id})
    await db.messages.delete_many({"user_id": user_id})

    return {"message": "User and associated data deleted successfully", "user_id": user_id}
