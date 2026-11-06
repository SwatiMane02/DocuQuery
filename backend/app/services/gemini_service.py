"""
Gemini Service - LLM inference layer for the RAG pipeline.

Implements LLMProvider so LLMService (and the API layer) depend only
on the provider-agnostic interface + app.services.llm_errors, never on
Gemini-specific exceptions. Adding a future provider (OpenAI, Groq,
Claude) means writing a new class that implements LLMProvider and
raises the same llm_errors types - no changes needed in LLMService or
the /chat endpoint.

Configuration (via app.core.config.settings, read from .env):
- GEMINI_API_KEY
- GEMINI_MODEL (default: gemini-2.5-flash)
- GEMINI_TIMEOUT_SECONDS (default: 30)
- GEMINI_MAX_RETRIES (default: 2, exponential backoff, transient errors only)
"""

import asyncio
import logging
from typing import AsyncIterator

from google import genai
from google.genai import errors as genai_errors

from app.core.config import settings
from app.services.llm_provider import LLMProvider, GenerationResult
from app.services.llm_errors import (
    LLMAuthError,
    LLMModelNotFoundError,
    LLMQuotaExceededError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)

logger = logging.getLogger(__name__)


class GeminiService(LLMProvider):
    """
    Gemini implementation of LLMProvider.

    Reuses a single genai.Client instance (singleton, created lazily
    on first use) across requests instead of recreating it per call.
    """

    def __init__(self) -> None:
        self._client: genai.Client | None = None

    def _get_client(self) -> genai.Client:
        # Created exactly once; subsequent calls reuse the same client.
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise LLMAuthError(
                    "GEMINI_API_KEY is not configured. Set it in the .env file."
                )
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    @staticmethod
    def _classify_client_error(e: genai_errors.ClientError) -> Exception:
        status_code = getattr(e, "code", None)
        message = str(e)
        lower = message.lower()

        if status_code == 401 or "api key" in lower or "unauthenticated" in lower:
            return LLMAuthError(f"Gemini API key invalid: {message}")
        if status_code == 429 and "quota" in lower:
            return LLMQuotaExceededError(f"Gemini quota exceeded: {message}")
        if status_code == 429 or "rate" in lower:
            return LLMRateLimitError(f"Gemini rate limit exceeded: {message}")
        if status_code == 404 or "not found" in lower:
            return LLMModelNotFoundError(
                f"Gemini model not found: {settings.GEMINI_MODEL}: {message}"
            )
        return LLMUnavailableError(f"Gemini API error: {message}")

    async def generate_answer(self, prompt: str) -> GenerationResult:
        """
        Send a fully-built RAG prompt to Gemini and return the answer text
        plus retry/token metadata (for cost/observability logging).

        Runs the (synchronous) SDK call in a thread so the event loop
        is not blocked, with a request timeout and a small number of
        retries (exponential backoff) for transient failures only.
        Auth/quota/rate-limit errors fail fast without retrying.
        """
        client = self._get_client()
        model = settings.GEMINI_MODEL
        max_retries = settings.GEMINI_MAX_RETRIES

        attempt = 0
        while True:
            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=model,
                        contents=prompt,
                        config={
                            "temperature": settings.TEMPERATURE,
                            "top_p": 0.1,
                            "max_output_tokens": settings.MAX_OUTPUT_TOKENS,
                        },
                    ),
                    timeout=settings.GEMINI_TIMEOUT_SECONDS,
                )
                usage = getattr(response, "usage_metadata", None)
                return GenerationResult(
                    answer=(response.text or "").strip(),
                    retry_count=attempt,
                    prompt_tokens=getattr(usage, "prompt_token_count", None) if usage else None,
                    response_tokens=getattr(usage, "candidates_token_count", None) if usage else None,
                )

            except genai_errors.ClientError as e:
                # Client errors (bad key, quota, invalid model, ...) are not transient.
                logger.error(f"❌ Gemini client error: {str(e)}")
                raise self._classify_client_error(e) from e

            except (genai_errors.ServerError, asyncio.TimeoutError, asyncio.CancelledError) as e:
                attempt += 1
                is_timeout = isinstance(e, asyncio.TimeoutError)
                if attempt > max_retries:
                    if is_timeout:
                        logger.error(f"❌ Gemini API timeout after {attempt} attempt(s)")
                        raise LLMTimeoutError(
                            f"Gemini API timeout after {settings.GEMINI_TIMEOUT_SECONDS}s "
                            f"({attempt} attempt(s))"
                        ) from e
                    logger.error(f"❌ Gemini server error after {attempt} attempt(s): {str(e)}")
                    raise LLMUnavailableError(f"Gemini API server error: {str(e)}") from e

                backoff = 2 ** (attempt - 1)  # 1s, 2s, ...
                logger.warning(
                    f"⚠️ Gemini transient error (attempt {attempt}/{max_retries}), "
                    f"retrying in {backoff}s: {str(e)}"
                )
                await asyncio.sleep(backoff)

            except Exception as e:
                logger.error(f"❌ Gemini API call failed: {str(e)}")
                raise LLMUnavailableError(f"Gemini API call failed: {str(e)}") from e

    async def generate_answer_stream(self, prompt: str) -> AsyncIterator[str]:
        """
        Stream the answer text in chunks as Gemini generates it.

        Used only by the optional POST /documents/chat/stream endpoint
        (gated by settings.STREAMING_ENABLED). No retry logic here -
        once tokens start streaming to the client, retrying transparently
        isn't possible, so failures simply propagate as llm_errors.
        """
        client = self._get_client()
        model = settings.GEMINI_MODEL

        try:
            stream = await asyncio.to_thread(
                lambda: list(
                    client.models.generate_content_stream(
                        model=model,
                        contents=prompt,
                        config={
                            "temperature": settings.TEMPERATURE,
                            "top_p": 0.1,
                            "max_output_tokens": settings.MAX_OUTPUT_TOKENS,
                        },
                    )
                )
            )
        except genai_errors.ClientError as e:
            logger.error(f"❌ Gemini client error (stream): {str(e)}")
            raise self._classify_client_error(e) from e
        except Exception as e:
            logger.error(f"❌ Gemini stream failed: {str(e)}")
            raise LLMUnavailableError(f"Gemini API call failed: {str(e)}") from e

        for event in stream:
            if event.text:
                yield event.text


# Singleton instance - reused across requests, client created lazily on first use
gemini_service = GeminiService()
