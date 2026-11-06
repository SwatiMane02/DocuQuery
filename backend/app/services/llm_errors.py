"""
Provider-agnostic LLM error types.

Any LLM provider service (gemini_service.py today; openai_service.py,
groq_service.py, etc. tomorrow) should raise these instead of raw
provider SDK exceptions. This lets LLMService and the API layer map
errors to HTTP status codes without knowing which provider is active.
"""


class LLMError(Exception):
    """Base class for all LLM provider errors."""


class LLMAuthError(LLMError):
    """Invalid or missing API key. Maps to HTTP 401."""


class LLMQuotaExceededError(LLMError):
    """Billing quota exhausted. Maps to HTTP 429."""


class LLMRateLimitError(LLMError):
    """Too many requests in a short window. Maps to HTTP 429."""


class LLMTimeoutError(LLMError):
    """Provider did not respond in time. Maps to HTTP 504."""


class LLMUnavailableError(LLMError):
    """Provider is down / returned a server error. Maps to HTTP 503."""


class LLMModelNotFoundError(LLMError):
    """Configured model name does not exist. Maps to HTTP 503."""
