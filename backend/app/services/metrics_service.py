"""
Simple in-memory runtime stats for the LLM/RAG chat pipeline.

No Prometheus, no external deps - just counters and a rolling latency
list, exposed via GET /metrics/llm. Good enough for a single-instance
deployment; if this scales out, replace with a shared store (Redis,
StatsD, etc.) behind the same increment/observe interface.
"""

from collections import defaultdict
from threading import Lock
from typing import Dict, List


class LLMMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._counters: Dict[str, int] = defaultdict(int)
        self._latencies_ms: List[float] = []
        self._max_latency_samples = 1000  # cap memory usage

    def increment(self, name: str, amount: int = 1) -> None:
        with self._lock:
            self._counters[name] += amount

    def observe_latency(self, ms: float) -> None:
        with self._lock:
            self._latencies_ms.append(ms)
            if len(self._latencies_ms) > self._max_latency_samples:
                self._latencies_ms.pop(0)

    def snapshot(self) -> dict:
        with self._lock:
            avg_latency = (
                sum(self._latencies_ms) / len(self._latencies_ms)
                if self._latencies_ms else 0.0
            )
            return {
                "gemini_requests": self._counters.get("gemini_requests", 0),
                "cache_hits": self._counters.get("cache_hits", 0),
                "semantic_cache_hits": self._counters.get("semantic_cache_hits", 0),
                "rate_limited": self._counters.get("rate_limited", 0),
                "timeouts": self._counters.get("timeouts", 0),
                "quota_failures": self._counters.get("quota_failures", 0),
                "auth_failures": self._counters.get("auth_failures", 0),
                "unavailable_errors": self._counters.get("unavailable_errors", 0),
                "gemini_call_skipped_no_chunks": self._counters.get("gemini_call_skipped_no_chunks", 0),
                "average_latency_ms": round(avg_latency, 1),
                "latency_samples": len(self._latencies_ms),
            }


# Singleton instance
llm_metrics = LLMMetrics()
