"""
LLM Provider Factory.

LLMService --> LLMProviderFactory --> GeminiService (today)
                                   --> OpenAIService / GroqService / ClaudeService (future)

Adding a new provider means: write a class implementing LLMProvider
(app.services.llm_provider) that raises app.services.llm_errors types,
then add one branch here. LLMService never changes.

Provider is chosen from settings.LLM_PROVIDER (.env: LLM_PROVIDER=gemini).
"""

from app.core.config import settings
from app.services.llm_provider import LLMProvider


def get_llm_provider() -> LLMProvider:
    """Return the singleton LLMProvider instance for the configured provider."""
    provider_name = settings.LLM_PROVIDER.strip().lower()

    if provider_name == "gemini":
        from app.services.gemini_service import gemini_service
        return gemini_service

    raise ValueError(
        f"Unsupported LLM_PROVIDER '{provider_name}'. "
        f"Supported providers: gemini (openai, groq, claude planned)."
    )
