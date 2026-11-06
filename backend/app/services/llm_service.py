"""
LLM Service for RAG Chat - Final RAG Pipeline Layer

Completes the RAG pipeline:
User Query → Retrieval → Context Injection → LLM → AI Answer

Provides methods to:
1. Build RAG prompts with retrieved context
2. Call the Gemini LLM API
3. Parse and format LLM responses

The LLMService integrates with RetrievalService to create a complete
chatbot that answers questions based on uploaded document context.

Architecture:
- Delegates inference to an LLMProvider obtained from
  llm_provider_factory (Gemini today; swapping providers is a config
  change, not a code change here)
- Model name is read from settings.GEMINI_MODEL
- Integrates semantic retrieval for context injection
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.config import settings
from app.services.llm_provider_factory import get_llm_provider
from app.services.llm_errors import LLMError

logger = logging.getLogger(__name__)

# Minimum content length for a chunk to be worth sending to the LLM.
# Filters out stray whitespace/near-empty chunks that waste tokens.
MIN_CHUNK_LENGTH = 20

# Rough token estimate: ~4 characters per token for English text.
# Good enough for budgeting purposes; not an exact tokenizer count.
CHARS_PER_TOKEN_ESTIMATE = 4


class LLMService:
    """
    Service for generating LLM responses using retrieved document context.

    Responsibilities:
    - Build RAG prompts with retrieved chunks as context
    - Call the Gemini LLM API (via gemini_service)
    - Parse and format LLM responses
    - Handle errors gracefully
    - Log all steps for debugging

    Configuration:
    - Model: settings.GEMINI_MODEL (default gemini-2.5-flash)
    """

    DEFAULT_MODEL = settings.GEMINI_MODEL

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Rough token count estimate (~4 chars/token). Approximation is fine for budgeting."""
        return max(1, len(text) // CHARS_PER_TOKEN_ESTIMATE)

    @staticmethod
    def choose_dynamic_chunk_budget(query: str) -> int:
        """
        Lightweight heuristic: pick a target chunk count from the query
        shape alone (no extra LLM call, negligible latency - just string
        checks). Bounded by MIN_CONTEXT_CHUNKS / MAX_CONTEXT_CHUNKS.

        - Summary / comparison / analytical questions -> more chunks
          (need broader coverage across the document).
        - Short factual / definition questions -> fewer chunks
          (the answer is usually in 1-2 highly-relevant chunks).
        - Everything else -> DEFAULT_CONTEXT_CHUNKS.
        """
        q = query.lower().strip()
        word_count = len(q.split())

        broad_keywords = ["summar", "overview", "synopsis", "tldr", "tl;dr", "compare", "comparison",
                          "difference between", "analy", "pros and cons", "evaluate"]
        definition_keywords = ["what is", "define", "definition of", "meaning of"]

        if any(kw in q for kw in broad_keywords):
            target = settings.MAX_CONTEXT_CHUNKS
        elif any(kw in q for kw in definition_keywords) or word_count <= 6:
            target = settings.MIN_CONTEXT_CHUNKS
        elif word_count <= 12:
            target = min(settings.DEFAULT_CONTEXT_CHUNKS, settings.MAX_CONTEXT_CHUNKS)
        else:
            # Longer, more involved questions get a bit more room, capped at max.
            target = min(settings.DEFAULT_CONTEXT_CHUNKS + 2, settings.MAX_CONTEXT_CHUNKS)

        return max(settings.MIN_CONTEXT_CHUNKS, min(target, settings.MAX_CONTEXT_CHUNKS))

    @staticmethod
    def select_chunks_within_budget(
        chunks: List[Dict[str, Any]],
        max_chunks: int = None,
        max_characters: int = None,
        max_tokens: int = None,
    ) -> List[Dict[str, Any]]:
        """
        Reduce retrieved chunks to the smallest set worth sending to the LLM.

        Chunks arrive pre-sorted by score (descending). This:
        1. Drops empty/whitespace/too-small chunks.
        2. Drops near-duplicate content (normalized exact match).
        3. Stops adding chunks once max_chunks, max_characters, or the
           estimated token budget is hit, always keeping the
           highest-scored chunks first.

        This directly reduces prompt size (tokens) without touching
        retrieval/embeddings/vector search.
        """
        max_chunks = max_chunks if max_chunks is not None else settings.MAX_CONTEXT_CHUNKS
        max_characters = max_characters if max_characters is not None else settings.MAX_CONTEXT_CHARACTERS
        max_tokens = max_tokens if max_tokens is not None else settings.MAX_PROMPT_TOKENS

        selected: List[Dict[str, Any]] = []
        seen_normalized: set = set()
        total_chars = 0

        for chunk in chunks:
            if len(selected) >= max_chunks:
                break

            content = (chunk.get("content") or "").strip()
            if len(content) < MIN_CHUNK_LENGTH:
                continue

            normalized = " ".join(content.lower().split())
            if normalized in seen_normalized:
                continue

            candidate_chars = total_chars + len(content)
            if candidate_chars > max_characters:
                # Doesn't fit in the remaining char budget - skip (lower-scored
                # chunks after this one may still be smaller, so continue
                # rather than break).
                continue

            if (candidate_chars // CHARS_PER_TOKEN_ESTIMATE) > max_tokens:
                # Would blow the token budget - skip for the same reason.
                continue

            seen_normalized.add(normalized)
            selected.append(chunk)
            total_chars = candidate_chars

        return selected

    @staticmethod
    def build_rag_prompt(query: str, chunks: List[Dict[str, Any]]) -> str:
        """
        Build a RAG prompt with retrieved context and user query.

        Formats the prompt to:
        1. Include all retrieved chunks as context
        2. Clearly present the user query
        3. Give instructions to answer from context only
        """
        logger.info(f"🔨 Building RAG prompt with {len(chunks)} chunks for query: '{query[:60]}...'")

        # Reverse chunk order: most relevant chunk (index 0 = highest score) goes last
        # LLMs have recency bias — content closest to the Question line gets most attention
        ordered_chunks = list(reversed(chunks))

        # Format retrieved chunks as context (no mention of "Chunk" headers)
        context_text = "\n\n".join([
            chunk.get('content', '')
            for chunk in ordered_chunks
        ])

        # Detect if this is a summary query
        is_summary = False
        q_lower = query.lower()
        if any(kw in q_lower for kw in ["summar", "overview", "synopsis", "tldr", "tl;dr"]):
            is_summary = True
            
        if is_summary:
            prompt = f"""You are a document extraction assistant.

Answer ONLY using the provided context.

Rules:
- Summarize the main facts from the context.
- Do not add any introductory or concluding remarks.
- Do not add preambles, disclaimers, or safety warnings.
- Return ONLY the summary text.

Context:
{context_text if context_text else "NOT_FOUND"}

Question:
{query}

Answer:"""
        else:
            prompt = f"""You are a document extraction assistant.

Answer ONLY using the provided context.

Rules:
- Extract the value exactly as it appears in the context.
- Do not simplify, shorten, format, or omit any details.
- For lists or multiple items, separate them with commas on a single line.
- Return ONLY the exact extracted text.
- Do not explain, or add introductory/concluding text.
- If the answer is not in the context, return exactly: NOT_FOUND

Context:
{context_text if context_text else "NOT_FOUND"}

Question:
{query}

Answer:"""
        
        logger.info(f"✅ RAG prompt built: {len(prompt)} characters, {len(chunks)} context chunks")
        logger.debug(f"Prompt preview: {prompt[:200]}...")
        
        return prompt
    
    @staticmethod
    async def generate_answer(
        query: str,
        chunks: List[Dict[str, Any]],
        model: str = DEFAULT_MODEL
    ) -> Dict[str, Any]:
        """
        Generate LLM answer using retrieved context.
        """
        logger.info(f"🤖 Generating LLM answer using model: {model}")
        
        if not query or not query.strip():
            logger.error("Query is empty")
            raise ValueError("Query cannot be empty")
        
        if not chunks:
            logger.warning("No context chunks provided for answer generation. Returning NOT_FOUND.")
            return {
                "answer": "NOT_FOUND",
                "query": query,
                "model": model,
                "num_chunks": 0,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        
        start_time = datetime.utcnow()

        try:
            # Step 1: Trim to the smallest set of chunks worth sending
            # (drops empty/tiny/duplicate chunks, stops at char/token
            # budget, and sizes the chunk count to the query itself)
            dynamic_max_chunks = LLMService.choose_dynamic_chunk_budget(query)
            budgeted_chunks = LLMService.select_chunks_within_budget(
                chunks, max_chunks=dynamic_max_chunks
            )

            if not budgeted_chunks:
                logger.warning("No chunks survived context budgeting. Returning NOT_FOUND.")
                return {
                    "answer": "NOT_FOUND",
                    "query": query,
                    "model": model,
                    "num_chunks": 0,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }

            # Step 2: Build RAG prompt
            prompt = LLMService.build_rag_prompt(query, budgeted_chunks)
            estimated_prompt_tokens = LLMService.estimate_tokens(prompt)

            # Step 3: Call the configured LLM provider (Gemini by default;
            # see llm_provider_factory for how other providers plug in)
            logger.info(
                f"📡 Calling LLM provider: model={model}, "
                f"chunks_retrieved={len(chunks)}, chunks_sent={len(budgeted_chunks)}, "
                f"estimated_prompt_tokens={estimated_prompt_tokens}"
            )

            provider = get_llm_provider()
            generation = await provider.generate_answer(prompt)
            answer_text = generation.answer

            elapsed_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            # Normalize/clean answer to NOT_FOUND if it indicates failure or is empty
            answer_clean = answer_text.strip(" '\"`.,").strip()
            refusal_keywords = [
                "i cannot assist", "i cannot extract", "i cannot identify", 
                "i can't assist", "i am unable to", "i'm unable to",
                "not found", "information is not available", "not mention"
            ]
            if (not answer_clean or 
                answer_clean.upper() == "NOT_FOUND" or 
                any(kw in answer_clean.lower() for kw in refusal_keywords)):
                answer_text = "NOT_FOUND"
            else:
                answer_text = answer_clean
            
            logger.info(
                f"✅ LLM answer generated: {len(answer_text)} chars, "
                f"chunks_retrieved={len(chunks)}, chunks_sent={len(budgeted_chunks)}, "
                f"estimated_prompt_tokens={estimated_prompt_tokens}, "
                f"response_tokens={generation.response_tokens}, "
                f"model={model}, response_time_ms={elapsed_ms:.0f}, "
                f"retry_count={generation.retry_count}, cache_hit=False"
            )

            # Step 4: Format and return result
            result = {
                "answer": answer_text,
                "query": query,
                "model": model,
                "num_chunks": len(chunks),
                "num_chunks_sent": len(budgeted_chunks),
                "response_time_ms": round(elapsed_ms, 1),
                "estimated_prompt_tokens": estimated_prompt_tokens,
                "response_tokens": generation.response_tokens,
                "retry_count": generation.retry_count,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }

            return result

        except LLMError:
            # Already a well-formed, typed error from gemini_service (invalid
            # key, quota/rate limit, missing model, timeout, ...) - propagate
            # as-is so the API layer can map it to the correct HTTP status.
            raise

        except Exception as e:
            logger.error(f"❌ LLM answer generation failed: {str(e)}")
            raise RuntimeError(f"LLM answer generation failed: {str(e)}") from e


# Singleton instance for use in endpoints
llm_service = LLMService()
