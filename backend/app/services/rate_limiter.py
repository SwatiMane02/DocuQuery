"""
In-memory, per-user sliding-window rate limiter.

Protects the Gemini API from being hammered by a single user. Kept as
a small, isolated class with a simple interface (`allow(key)`) so it
can be swapped for a Redis-backed limiter later without touching call
sites - just construct a different implementation with the same
interface.
"""

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict

from app.core.config import settings


class SlidingWindowRateLimiter:
    """Allows at most `limit` calls per `window_seconds` per key."""

    def __init__(self, limit: int, window_seconds: int = 60) -> None:
        self._limit = limit
        self._window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        """Return True if the call is allowed, False if rate-limited."""
        now = time.time()
        cutoff = now - self._window_seconds

        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] < cutoff:
                hits.popleft()

            if len(hits) >= self._limit:
                return False

            hits.append(now)
            return True

    def retry_after_seconds(self, key: str) -> int:
        """Seconds until the oldest hit in the current window expires."""
        with self._lock:
            hits = self._hits.get(key)
            if not hits:
                return 0
            return max(0, int(self._window_seconds - (time.time() - hits[0])))


# Singleton instance used by the /chat endpoint
chat_rate_limiter = SlidingWindowRateLimiter(
    limit=settings.RATE_LIMIT_PER_MINUTE,
    window_seconds=60,
)
