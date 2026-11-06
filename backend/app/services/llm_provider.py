"""
Provider-agnostic LLM interface.

Kept in its own module (rather than inside gemini_service.py) so that
concrete providers (gemini_service.py today; openai_service.py,
groq_service.py, claude_service.py tomorrow) and
llm_provider_factory.py all depend on this neutral contract instead of
on each other.
"""

import abc
from typing import NamedTuple


class GenerationResult(NamedTuple):
    """Result of a single LLM generation call, for cost/observability logging."""
    answer: str
    retry_count: int
    prompt_tokens: int | None = None
    response_tokens: int | None = None


class LLMProvider(abc.ABC):
    """Provider-agnostic interface for LLM answer generation."""

    @abc.abstractmethod
    async def generate_answer(self, prompt: str) -> GenerationResult:
        """
        Return the generated answer (plus retry/token metadata) for a
        fully-built prompt.

        Raises one of the app.services.llm_errors types on failure.
        """
        raise NotImplementedError
