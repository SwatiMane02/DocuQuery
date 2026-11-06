"""
In-memory TTL cache for /chat answers - exact match + semantic match.

Exact cache:
Key: (user_id, document_id, normalized question)
If the exact same question is asked again within the TTL window, the
cached response is returned instead of re-running retrieval + calling
the LLM.

Semantic cache (extends the above, does not replace it):
Every cached entry also stores the question's embedding (reusing the
existing sentence-transformers/all-MiniLM-L6-v2 model via
embedding_service - no new embedding model introduced). A new question
is compared by cosine similarity against cached questions scoped to
the same (user_id, document_id); if similarity >= SEMANTIC_CACHE_THRESHOLD
the cached answer is served. Both caches respect the same TTL.

This is a plain process-local structure - fine for a single instance;
swap for Redis if the app is ever scaled horizontally (kept isolated
in this module for exactly that reason).
"""

import logging
import re
import time
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

CacheKey = Tuple[str, str, str]


def _normalize_question(question: str) -> str:
    return re.sub(r"\s+", " ", question.strip().lower())


def build_cache_key(user_id: str, document_id: Optional[str], question: str) -> CacheKey:
    return (user_id, document_id or "", _normalize_question(question))


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    a_arr = np.array(a)
    b_arr = np.array(b)
    denom = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    if denom == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / denom)


class TTLCache:
    """
    Thread-safe in-memory cache with per-entry expiry and an optional
    semantic (embedding-similarity) lookup scoped by a partition key
    (user_id, document_id).
    """

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl_seconds = ttl_seconds
        self._store: Dict[CacheKey, Tuple[float, Any, Optional[List[float]]]] = {}
        self._lock = Lock()

    def get(self, key: CacheKey) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value, _embedding = entry
            if time.time() >= expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: CacheKey, value: Any, embedding: Optional[List[float]] = None) -> None:
        with self._lock:
            self._store[key] = (time.time() + self._ttl_seconds, value, embedding)

    def get_semantic(
        self,
        user_id: str,
        document_id: Optional[str],
        question_embedding: List[float],
        threshold: float = None,
    ) -> Optional[Any]:
        """
        Scan cached entries for the same (user_id, document_id) and
        return the cached value for the closest question if its cosine
        similarity to question_embedding is >= threshold. Expired
        entries are skipped (and lazily evicted).
        """
        threshold = threshold if threshold is not None else settings.SEMANTIC_CACHE_THRESHOLD
        doc_part = document_id or ""
        now = time.time()

        best_score = -1.0
        best_value = None
        expired_keys = []

        with self._lock:
            for key, (expires_at, value, embedding) in self._store.items():
                if key[0] != user_id or key[1] != doc_part:
                    continue
                if now >= expires_at:
                    expired_keys.append(key)
                    continue
                if embedding is None:
                    continue
                score = _cosine_similarity(question_embedding, embedding)
                if score > best_score:
                    best_score = score
                    best_value = value

            for key in expired_keys:
                del self._store[key]

        if best_score >= threshold:
            logger.info(f"🧠 Semantic cache hit (similarity={best_score:.4f})")
            return best_value
        return None


# Singleton instance used by the /chat endpoint
chat_cache = TTLCache(ttl_seconds=settings.CHAT_CACHE_TTL_SECONDS)
