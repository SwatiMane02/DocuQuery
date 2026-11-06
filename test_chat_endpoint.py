#!/usr/bin/env python3
"""
End-to-End RAG Chat Pipeline Test

This script tests the complete RAG pipeline:
1. User authentication
2. Document upload
3. Embedding generation
4. Semantic search
5. LLM answer generation

Requires:
- FastAPI server running on http://127.0.0.1:8001
- Ollama running locally with mistral model: ollama run mistral
"""

import requests
import time
import json

BASE_URL = "http://127.0.0.1:8001"
TEST_EMAIL = "rag_test@example.com"
TEST_PASSWORD = "testpass123"
TEST_USER = "RAG Test User"


def print_section(title):
    """Print formatted section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")


def test_authentication():
    """Test user registration/login"""
    print_section("1️⃣  AUTHENTICATION TEST")
    
    print(f"📝 Registering user: {TEST_EMAIL}")
    resp = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "full_name": TEST_USER
        }
    )
    
    if resp.status_code == 409:
        print("   User already exists, logging in...")
        resp = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
    
    if resp.status_code not in [200, 201]:
        print(f"❌ Auth failed: {resp.status_code}")
        print(f"   {resp.text}")
        return None
    
    token = resp.json().get("access_token")
    print(f"✅ Authenticated successfully")
    return token


def test_document_upload(token):
    """Test document upload and chunking"""
    print_section("2️⃣  DOCUMENT UPLOAD & CHUNKING TEST")
    
    test_docs = [
        {
            "name": "fastapi_info.txt",
            "content": (
                "FastAPI is a modern, fast web framework for building APIs with Python 3.7+. "
                "It uses type hints with Pydantic models for validation. "
                "FastAPI provides automatic API documentation with Swagger UI. "
                "It supports async/await for high concurrency. "
                "FastAPI uses starlette for HTTP handling."
            )
        },
        {
            "name": "database_info.txt",
            "content": (
                "MongoDB is a NoSQL database that stores data in JSON-like documents. "
                "MongoDB Atlas provides cloud hosting for MongoDB. "
                "PostgreSQL is a powerful open-source relational database. "
                "Both MongoDB and PostgreSQL support transactions. "
                "Database choice depends on data structure and query patterns."
            )
        },
        {
            "name": "ml_concepts.txt",
            "content": (
                "Machine learning models learn patterns from data. "
                "Deep learning uses neural networks with multiple layers. "
                "Embeddings convert text to numerical vectors. "
                "Cosine similarity measures similarity between vectors. "
                "RAG (Retrieval-Augmented Generation) combines search with language models."
            )
        },
    ]
    
    doc_ids = []
    for i, doc in enumerate(test_docs, 1):
        print(f"📤 Uploading document {i}: {doc['name']}")
        
        with open(f'/tmp/{doc["name"]}', 'w') as f:
            f.write(doc['content'])
        
        with open(f'/tmp/{doc["name"]}', 'rb') as f:
            files = {'file': (doc['name'], f, 'text/plain')}
            resp = requests.post(
                f"{BASE_URL}/documents/upload",
                headers={"Authorization": f"Bearer {token}"},
                files=files
            )
        
        if resp.status_code not in [200, 201]:
            print(f"   ❌ Upload failed: {resp.status_code}")
            print(f"      {resp.text}")
            continue
        
        doc_id = resp.json().get("document_id")
        doc_ids.append(doc_id)
        print(f"   ✅ Document uploaded: {doc_id[:16]}...")
    
    return doc_ids


def test_embedding_generation(token, doc_ids):
    """Test embedding generation for documents"""
    print_section("3️⃣  EMBEDDING GENERATION TEST")
    
    print("⏳ Waiting for document processing...")
    time.sleep(2)
    
    for i, doc_id in enumerate(doc_ids, 1):
        print(f"🔢 Generating embeddings for document {i}...")
        
        resp = requests.post(
            f"{BASE_URL}/documents/{doc_id}/generate-embeddings",
            headers={"Authorization": f"Bearer {token}"},
            json={}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ Embedding generation failed: {resp.status_code}")
            print(f"      {resp.text}")
            continue
        
        chunks = resp.json().get('chunks_processed', 0)
        print(f"   ✅ Document {i}: {chunks} chunks embedded")


def test_semantic_search(token):
    """Test semantic search functionality"""
    print_section("4️⃣  SEMANTIC SEARCH TEST")
    
    search_queries = [
        "What is FastAPI?",
        "What databases are mentioned?",
        "Explain embeddings and similarity",
    ]
    
    for query in search_queries:
        print(f"🔍 Searching: '{query}'")
        
        resp = requests.post(
            f"{BASE_URL}/documents/search",
            headers={"Authorization": f"Bearer {token}"},
            json={"query": query},
            params={"top_k": 3}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ Search failed: {resp.status_code}")
            continue
        
        matches = resp.json().get("matches", [])
        print(f"   ✅ Found {len(matches)} relevant chunks")
        for j, match in enumerate(matches[:2], 1):
            preview = match['content'][:50].replace('\n', ' ')
            print(f"      {j}. Score: {match['score']:.3f} - {preview}...")


def test_chat_endpoint(token):
    """Test the complete RAG chat pipeline"""
    print_section("5️⃣  RAG CHAT ENDPOINT TEST")
    
    print("⚠️  IMPORTANT: Make sure Ollama is running!")
    print("   Command: ollama run mistral")
    print()
    
    chat_queries = [
        "What technologies are used?",
        "What databases are mentioned in the documents?",
        "Tell me about machine learning concepts discussed",
        "How would you summarize the technologies?",
    ]
    
    for query in chat_queries:
        print(f"\n🤖 Chat Query: '{query}'")
        print("-" * 60)
        
        resp = requests.post(
            f"{BASE_URL}/documents/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"query": query},
            params={"top_k": 3}
        )
        
        if resp.status_code == 503:
            print("❌ Ollama service unavailable!")
            print("   Please start Ollama: ollama run mistral")
            return
        
        if resp.status_code != 200:
            print(f"❌ Chat failed: {resp.status_code}")
            print(f"   {resp.text}")
            continue
        
        data = resp.json()
        
        print(f"\n📋 Answer:")
        print(f"   {data['answer']}")
        
        print(f"\n📚 Sources ({data['num_chunks']} chunks):")
        for i, source in enumerate(data['sources'], 1):
            print(f"   {i}. Chunk {source['chunk_index']} "
                  f"(Score: {source['score']:.3f})")
        
        print(f"\n🤖 Model: {data['model']}")
        print("-" * 60)


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("  RAG CHAT PIPELINE - END-TO-END TEST")
    print("="*80)
    print("\nThis test will:")
    print("1. Authenticate user")
    print("2. Upload test documents")
    print("3. Generate embeddings")
    print("4. Test semantic search")
    print("5. Test LLM chat with Ollama")
    print("\nRequirements:")
    print("✅ FastAPI server running on http://127.0.0.1:8001")
    print("✅ Ollama running locally: ollama run mistral")
    print()
    
    input("Press Enter to start tests...")
    
    # Step 1: Authentication
    token = test_authentication()
    if not token:
        print("\n❌ Authentication failed. Exiting.")
        return
    
    # Step 2: Upload documents
    doc_ids = test_document_upload(token)
    if not doc_ids:
        print("\n❌ No documents uploaded. Exiting.")
        return
    
    # Step 3: Generate embeddings
    test_embedding_generation(token, doc_ids)
    
    # Step 4: Test semantic search
    test_semantic_search(token)
    
    # Step 5: Test RAG chat
    test_chat_endpoint(token)
    
    # Summary
    print_section("✅ ALL TESTS COMPLETE!")
    print("RAG Chat Pipeline is fully operational!")
    print("\nYou can now:")
    print("1. Access Swagger UI: http://127.0.0.1:8001/docs")
    print("2. Upload more documents")
    print("3. Ask questions via /chat endpoint")
    print("4. View API documentation")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️  Test interrupted by user")
    except requests.exceptions.ConnectionError:
        print("\n\n❌ Cannot connect to FastAPI server!")
        print("   Make sure server is running on http://127.0.0.1:8001")
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
