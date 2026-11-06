"""
Conversation service for managing persistent chat sessions and message history in MongoDB.
"""

import logging
from datetime import datetime
from typing import List, Optional, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.database import get_database
from app.models.conversation import Conversation, Message
from app.models.document import Document

logger = logging.getLogger(__name__)


class ConversationService:
    """
    Service layer for Conversation and Message CRUD in MongoDB.
    """

    @staticmethod
    def _get_db() -> AsyncIOMotorDatabase:
        return get_database()

    @staticmethod
    async def create_conversation(
        user_id: str,
        title: Optional[str] = None,
        document_id: Optional[str] = None,
        document_name: Optional[str] = None,
    ) -> Conversation:
        """
        Create a new conversation session.
        """
        db = ConversationService._get_db()
        
        # If document_id is provided but document_name is not, fetch filename
        if document_id and not document_name:
            try:
                doc_record = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": user_id})
                if doc_record:
                    document_name = doc_record.get("filename")
            except Exception:
                pass

        final_title = title.strip() if title and title.strip() else ("Chat with " + document_name if document_name else "New Conversation")

        now = datetime.utcnow()
        conv_doc = {
            "user_id": user_id,
            "title": final_title,
            "document_id": document_id,
            "document_name": document_name,
            "created_at": now,
            "updated_at": now,
        }

        result = await db.conversations.insert_one(conv_doc)
        conv_doc["_id"] = str(result.inserted_id)

        return Conversation(**conv_doc)

    @staticmethod
    async def list_conversations(
        user_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Conversation], int]:
        """
        List conversations for current user, ordered by most recently updated.
        """
        db = ConversationService._get_db()
        query = {"user_id": user_id}

        total = await db.conversations.count_documents(query)
        cursor = (
            db.conversations.find(query)
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )

        raw_docs = await cursor.to_list(length=limit)
        conversations: List[Conversation] = []
        for doc in raw_docs:
            doc["_id"] = str(doc["_id"])
            conversations.append(Conversation(**doc))

        return conversations, total

    @staticmethod
    async def get_conversation(
        conversation_id: str,
        user_id: str,
    ) -> Optional[Conversation]:
        """
        Retrieve a single conversation by ID with user ownership check.
        """
        db = ConversationService._get_db()
        try:
            doc = await db.conversations.find_one({
                "_id": ObjectId(conversation_id),
                "user_id": user_id,
            })
            if not doc:
                return None
            doc["_id"] = str(doc["_id"])
            return Conversation(**doc)
        except Exception:
            return None

    @staticmethod
    async def get_conversation_messages(
        conversation_id: str,
        user_id: str,
    ) -> List[Message]:
        """
        Get all messages for a given conversation.
        """
        db = ConversationService._get_db()
        cursor = (
            db.messages.find({
                "conversation_id": conversation_id,
                "user_id": user_id,
            })
            .sort("created_at", 1)
        )

        raw_msgs = await cursor.to_list(length=500)
        messages: List[Message] = []
        for msg in raw_msgs:
            msg["_id"] = str(msg["_id"])
            messages.append(Message(**msg))

        return messages

    @staticmethod
    async def add_message(
        conversation_id: str,
        user_id: str,
        from_user: str,
        content: str,
        sources: Optional[List[dict]] = None,
    ) -> Message:
        """
        Save a message to the conversation and update conversation updated_at timestamp.
        """
        db = ConversationService._get_db()
        now = datetime.utcnow()

        msg_doc = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "from_user": from_user,
            "content": content,
            "sources": sources or [],
            "created_at": now,
        }

        result = await db.messages.insert_one(msg_doc)
        msg_doc["_id"] = str(result.inserted_id)

        # Update conversation's updated_at and optionally title if default
        try:
            conv = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
            update_fields: dict = {"updated_at": now}
            if conv and conv.get("title") == "New Conversation" and from_user == "user":
                # Set title to first query snippet
                new_title = content[:35] + ("..." if len(content) > 35 else "")
                update_fields["title"] = new_title

            await db.conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {"$set": update_fields}
            )
        except Exception as e:
            logger.warning(f"Could not update conversation timestamp: {e}")

        return Message(**msg_doc)

    @staticmethod
    async def rename_conversation(
        conversation_id: str,
        user_id: str,
        new_title: str,
    ) -> Optional[Conversation]:
        """
        Update a conversation's title with ownership check.
        """
        db = ConversationService._get_db()
        try:
            now = datetime.utcnow()
            result = await db.conversations.find_one_and_update(
                {"_id": ObjectId(conversation_id), "user_id": user_id},
                {"$set": {"title": new_title.strip(), "updated_at": now}},
                return_document=True,
            )
            if not result:
                return None
            result["_id"] = str(result["_id"])
            return Conversation(**result)
        except Exception as e:
            logger.error(f"Error renaming conversation {conversation_id}: {e}")
            return None

    @staticmethod
    async def clear_conversation_messages(
        conversation_id: str,
        user_id: str,
    ) -> bool:
        """
        Delete all messages in a conversation while keeping the session intact.
        """
        db = ConversationService._get_db()
        try:
            conv = await db.conversations.find_one({
                "_id": ObjectId(conversation_id),
                "user_id": user_id,
            })
            if not conv:
                return False
            await db.messages.delete_many({
                "conversation_id": conversation_id,
                "user_id": user_id,
            })
            await db.conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {"$set": {"updated_at": datetime.utcnow()}},
            )
            return True
        except Exception as e:
            logger.error(f"Error clearing conversation messages {conversation_id}: {e}")
            return False

    @staticmethod
    async def delete_conversation(
        conversation_id: str,
        user_id: str,
    ) -> bool:
        """
        Delete conversation and its associated messages.
        """
        db = ConversationService._get_db()
        try:
            del_result = await db.conversations.delete_one({
                "_id": ObjectId(conversation_id),
                "user_id": user_id,
            })

            if del_result.deleted_count > 0:
                await db.messages.delete_many({
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                })
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            return False


conversation_service = ConversationService()
