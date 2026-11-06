import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global variables to hold connection objects
client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def init_db_indexes(db: AsyncIOMotorDatabase) -> None:
    """
    Create essential MongoDB indexes for query performance and data integrity.
    """
    try:
        await db["users"].create_index("email", unique=True)
        await db["documents"].create_index([("user_id", 1), ("upload_date", -1)])
        await db["documents"].create_index("user_id")
        await db["document_chunks"].create_index([("document_id", 1), ("chunk_index", 1)])
        await db["document_chunks"].create_index([("user_id", 1)])
        await db["document_chunks"].create_index([("document_id", 1)])
        await db["conversations"].create_index([("user_id", 1), ("updated_at", -1)])
        await db["conversations"].create_index([("user_id", 1)])
        await db["messages"].create_index([("conversation_id", 1), ("created_at", 1)])
        logger.info("⚡ MongoDB indexes verified/created")
    except Exception as e:
        logger.warning(f"⚠️ Index initialization warning: {e}")


async def connect_to_mongo() -> None:
    """
    Establish connection to MongoDB Atlas / Cloud database.
    Called when FastAPI starts.
    """
    global client, database

    try:
        client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
            connectTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
        )
        database = client[settings.DATABASE_NAME]

        # Verify connection
        await client.admin.command("ping")

        # Initialize collections and indexes
        await init_db_indexes(database)

        is_atlas = "mongodb.net" in settings.MONGODB_URI or settings.MONGODB_URI.startswith("mongodb+srv://")
        cluster_type = "MongoDB Atlas" if is_atlas else "MongoDB"
        print(f"✅ Connected to {cluster_type} ({settings.DATABASE_NAME})")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {type(e).__name__}")
        raise RuntimeError(
            "Failed to connect to MongoDB. Please verify MONGODB_URI and network/firewall access."
        ) from None


async def ping_database() -> bool:
    """
    Check if the database is currently reachable and responsive.
    Used by health monitoring endpoints.
    """
    global client
    if client is None:
        return False
    try:
        await client.admin.command("ping")
        return True
    except Exception:
        return False


async def close_mongo_connection() -> None:
    """
    Close MongoDB connection.
    Called when FastAPI shuts down.
    """
    global client

    if client:
        client.close()
        print("🔌 MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """
    Return the active database instance.
    """
    if database is None:
        raise RuntimeError("Database connection is not initialized.")

    return database

