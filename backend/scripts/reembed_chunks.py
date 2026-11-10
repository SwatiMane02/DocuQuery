"""
Safe Re-embedding & Rollback Utility for DocuQuery.

Safely migrates document chunks from legacy SentenceTransformers embeddings
to Gemini's zero-memory 384-dimensional embeddings (gemini-embedding-001),
preserving the original vectors in `legacy_embedding_vector` for complete rollback safety.

Usage:
    python backend/scripts/reembed_chunks.py
    python backend/scripts/reembed_chunks.py --rollback
"""

import argparse
import asyncio
import os
import sys
import time

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import connect_to_mongo, close_mongo_connection, get_database
from app.services.embedding_service import embedding_service


async def migrate_chunks():
    print("=" * 65)
    print("🚀 DocuQuery Chunk Re-embedding Migration (gemini-embedding-001)")
    print("=" * 65)

    await connect_to_mongo()
    db = get_database()
    collection = db["document_chunks"]

    total_chunks = await collection.count_documents({})
    print(f"Total chunks in database: {total_chunks}")

    query = {"content": {"$exists": True, "$ne": ""}}
    cursor = collection.find(query)
    chunks = await cursor.to_list(length=1000)

    if not chunks:
        print("No chunks with content found to re-embed.")
        await close_mongo_connection()
        return

    print(f"Found {len(chunks)} chunks with content to process/re-embed.\n")

    start_time = time.perf_counter()
    migrated = 0
    errors = 0

    batch_size = 16
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        batch_texts = [str(c.get("content", "")).strip() for c in batch]
        
        try:
            # Generate new 384-dim Gemini embeddings
            chunk_embeddings = await embedding_service.generate_embeddings_for_chunks(batch)
            
            for chunk, (cid, new_vector) in zip(batch, chunk_embeddings):
                # Backup old vector and update to new vector
                await collection.update_one(
                    {"_id": chunk["_id"]},
                    {
                        "$set": {
                            "legacy_embedding_vector": chunk.get("embedding_vector"),
                            "embedding_vector": new_vector,
                            "embedding_model": embedding_service.MODEL_NAME,
                            "embedding_status": "completed",
                            "updated_at": asyncio.get_event_loop().time()
                        }
                    }
                )
                migrated += 1
                print(f"  ✅ Re-embedded chunk {chunk['_id']} (index {chunk.get('chunk_index')})")

        except Exception as e:
            print(f"  ❌ Batch {i//batch_size + 1} failed: {e}")
            errors += len(batch)

    elapsed = time.perf_counter() - start_time
    print("\n" + "-" * 65)
    print(f"Migration completed in {elapsed:.2f}s!")
    print(f"Successfully re-embedded: {migrated}/{len(chunks)} chunks")
    if errors:
        print(f"Errors encountered: {errors}")
    print("-" * 65)

    await close_mongo_connection()


async def rollback_chunks():
    print("=" * 65)
    print("⏪ DocuQuery Chunk Re-embedding Rollback")
    print("=" * 65)

    await connect_to_mongo()
    db = get_database()
    collection = db["document_chunks"]

    cursor = collection.find({"legacy_embedding_vector": {"$exists": True, "$ne": None}})
    chunks = await cursor.to_list(length=1000)

    if not chunks:
        print("No chunks with legacy backup vectors found.")
        await close_mongo_connection()
        return

    print(f"Found {len(chunks)} chunks to rollback.\n")

    restored = 0
    for chunk in chunks:
        legacy_vec = chunk["legacy_embedding_vector"]
        await collection.update_one(
            {"_id": chunk["_id"]},
            {
                "$set": {
                    "embedding_vector": legacy_vec,
                    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2"
                },
                "$unset": {
                    "legacy_embedding_vector": ""
                }
            }
        )
        restored += 1
        print(f"  ⏪ Restored legacy vector for chunk {chunk['_id']}")

    print(f"\nRollback complete. Restored {restored} chunks.")
    await close_mongo_connection()


def main():
    parser = argparse.ArgumentParser(description="DocuQuery Chunk Re-embedding Utility")
    parser.add_argument("--rollback", action="store_true", help="Rollback to legacy embeddings")
    args = parser.parse_args()

    if args.rollback:
        asyncio.run(rollback_chunks())
    else:
        asyncio.run(migrate_chunks())


if __name__ == "__main__":
    main()

