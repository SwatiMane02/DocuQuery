"""
Operational endpoints for the LLM/RAG chat pipeline.

- GET /health/llm: cheap readiness check (no generation call).
- GET /metrics/llm: simple JSON runtime stats (cache hits, request
  counts, average latency, error counts) - no Prometheus, just a dict.
"""

from fastapi import APIRouter

from app.core.config import settings
from app.services.metrics_service import llm_metrics

router = APIRouter(tags=["llm-ops"])


@router.get("/health/llm", summary="LLM provider health check")
async def llm_health() -> dict:
    """
    Verify the LLM provider is configured (API key present, model set)
    without making an actual (billed) generation call.
    """
    provider = settings.LLM_PROVIDER.strip().lower()

    if provider == "gemini":
        configured = bool(settings.GEMINI_API_KEY) and bool(settings.GEMINI_MODEL)
    else:
        configured = False

    return {
        "status": "healthy" if configured else "unhealthy",
        "provider": provider,
        "model": settings.GEMINI_MODEL if provider == "gemini" else None,
    }


@router.get("/metrics/llm", summary="LLM/RAG chat runtime metrics")
async def llm_metrics_endpoint() -> dict:
    """Simple in-memory counters and latency stats for the /chat pipeline."""
    return {
        "provider": settings.LLM_PROVIDER.strip().lower(),
        **llm_metrics.snapshot(),
    }
