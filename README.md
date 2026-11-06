#  DocuQuery — RAG Document Intelligence Platform

> An enterprise-grade Retrieval-Augmented Generation (RAG) platform that lets users upload documents and query them using natural language — with source-cited answers powered by LLMs.

##  Problem Statement

Organizations spend countless hours manually searching through:

- PDFs
- Reports
- DOCX files
- CSV datasets
- Text documents

to find specific information.

**DocuQuery** solves this problem by combining document ingestion, semantic chunking, vector embeddings, similarity search, and large language models (LLMs) to provide accurate, source-grounded answers in seconds.

---

##  Key Features

###  Document Processing
- Multi-format upload (PDF, DOCX, CSV, TXT)
- Text extraction and preprocessing
- Semantic chunking & recursive text splitting
- Embedding generation using Sentence Transformers

###  RAG Question Answering
- Natural language querying across documents
- Top-k semantic retrieval
- LLM-generated answers with source citations
- Multi-document cross-query support

###  Authentication & User Management
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access (Free vs Pro)

###  Analytics & Feedback
- Query history tracking
- User feedback (thumbs up/down)
- Usage analytics dashboard

###  Deployment
- Dockerized backend
- Vercel frontend deployment
- Render backend deployment
- CI/CD with GitHub Actions

---

## 🏗️ Technology Stack

| Layer | Technology |
|------|------------|
| Backend API | Python, FastAPI |
| Frontend | React (Vite + TanStack Router) |
| Database | MongoDB Atlas |
| Vector Search | Cosine similarity over chunk embeddings stored in MongoDB (no separate vector DB) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 (local, 384-dim) |
| LLM | Google Gemini (`gemini-2.5-flash` by default), pluggable via `LLMProviderFactory` |
| Authentication | JWT, Passlib |
| File Storage | Local `uploads/` + Cloudinary |

---

## 🏛️ Architecture Overview

**Ingestion:**

```text
User Upload (PDF/DOCX/CSV/TXT)
          │
          ▼
   Document Parsing (extraction_service)
          │
          ▼
   Semantic Chunking (chunking_service)
          │
          ▼
Vector Embedding (sentence-transformers/all-MiniLM-L6-v2)
          │
          ▼
  Chunk + embedding stored in MongoDB (document_chunks collection)
```

**Query (`POST /documents/chat`):**

```text
User Query
  │
  ▼
Rate limit check (per-user, in-memory sliding window: RATE_LIMIT_PER_MINUTE)
  │
  ▼
Exact cache check (user_id + document_id + normalized question)
  │
  ▼
Semantic cache check (question-embedding cosine similarity ≥ SEMANTIC_CACHE_THRESHOLD)
  │
  ▼
Query Embedding (same sentence-transformers model as ingestion)
  │
  ▼
Cosine Similarity Search over MongoDB-stored chunk embeddings → Top-K
  │
  ▼
Dynamic Context Budget (heuristic chunk count from query shape:
  short/definition → few chunks, summary/comparison → more chunks)
  │
  ▼
Chunk Budgeting (dedupe near-identical, drop empty/tiny chunks,
  cap by MAX_CONTEXT_CHARACTERS / MAX_PROMPT_TOKENS)
  │
  ▼
Prompt Building (extraction vs. summary prompt template)
  │
  ▼
LLMProviderFactory (LLM_PROVIDER=gemini) → GeminiService.generate_answer()
  │
  ▼
Answer + source chunks → cached for next identical/similar question → User
```

Only the final "generate answer" step calls an external API (Gemini).
Everything upstream — extraction, chunking, embeddings, similarity search,
MongoDB — is self-hosted.

---

## 🔑 Gemini Setup

1. Get an API key from [Google AI Studio](https://aistudio.google.com/).
2. Set `GEMINI_API_KEY` in `backend/.env`.
3. Optionally change `GEMINI_MODEL` (default `gemini-2.5-flash`).

The Gemini client is a lazily-created **singleton**
(`backend/app/services/gemini_service.py`) — created once, reused across
every request, never recreated per call. Verify it's configured without
spending a request via `GET /health/llm`.

To swap providers later (OpenAI, Groq, Claude), implement `LLMProvider`
(`backend/app/services/llm_provider.py`) and add one branch in
`llm_provider_factory.py` — `LLMService` and the `/chat` endpoint never
need to change.

---

## ⚙️ Environment Variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | — | MongoDB Atlas (or local) connection string |
| `DATABASE_NAME` | `docuquery` | Mongo database name |
| `SECRET_KEY` | — | JWT signing secret |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | JWT expiry |
| `GEMINI_API_KEY` | — | Gemini API key (required for `/chat`) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name |
| `GEMINI_TIMEOUT_SECONDS` | `30` | Per-call timeout |
| `GEMINI_MAX_RETRIES` | `2` | Retries (exponential backoff) for transient errors only |
| `LLM_PROVIDER` | `gemini` | Provider selected by `LLMProviderFactory` |
| `TOP_K_RESULTS` | `10` | Chunks retrieved by semantic search |
| `MAX_CONTEXT_CHUNKS` | `10` | Upper bound on chunks sent to the LLM |
| `MIN_CONTEXT_CHUNKS` | `2` | Lower bound (short factual questions) |
| `DEFAULT_CONTEXT_CHUNKS` | `5` | Baseline for a normal question |
| `MAX_CONTEXT_CHARACTERS` | `12000` | Character budget for chunk content in the prompt |
| `MAX_PROMPT_TOKENS` | `3000` | Approximate token budget for the prompt |
| `MAX_OUTPUT_TOKENS` | `512` | Max tokens Gemini may generate |
| `TEMPERATURE` | `0.2` | Gemini sampling temperature |
| `CHAT_CACHE_TTL_SECONDS` | `600` | Exact + semantic cache TTL |
| `SEMANTIC_CACHE_THRESHOLD` | `0.95` | Min cosine similarity for a semantic cache hit |
| `RATE_LIMIT_PER_MINUTE` | `20` | Per-user `/chat` requests per rolling 60s window |
| `STREAMING_ENABLED` | `false` | Enables `POST /documents/chat/stream` |

Never commit real secrets — `.env` is gitignored; use `.env.example` as the template.

---

## 🚀 Deployment

- Run the backend behind a process manager (`uvicorn --workers N`, or
  `gunicorn -k uvicorn.workers.UvicornWorker`).
- The in-memory cache, rate limiter, and metrics are **per-process** — if you
  scale to multiple instances/workers, each gets its own cache and counters.
  For shared state across instances, swap `TTLCache`, `SlidingWindowRateLimiter`,
  and `LLMMetrics` (`backend/app/services/`) for Redis-backed equivalents —
  each is already isolated behind a small class interface for exactly this
  reason.
- MongoDB Atlas: make sure the deployment's outbound IP is allow-listed under
  Network Access.
- Frontend: `npm run build`, serve `dist/` as a static site.

---

## 🏭 Production Recommendations

- Set `DEBUG=False` in production.
- Keep `GEMINI_MAX_RETRIES` low (1–2) — retries add latency, not just resilience.
- Watch `GET /metrics/llm` for `quota_failures` / `rate_limited` trending up —
  that's your earliest signal to raise `RATE_LIMIT_PER_MINUTE` or your Gemini
  quota.
- `SEMANTIC_CACHE_THRESHOLD=0.95` is conservative (few false-positive hits).
  Lowering it increases cache hit rate but risks serving a stale/wrong-ish
  answer for a meaningfully different question — tune carefully.
- Streaming (`STREAMING_ENABLED=true`) trades a fully-cacheable, retryable
  request for lower time-to-first-token; the streaming endpoint is not cached
  and does not retry mid-stream.

---

## 🩺 Troubleshooting

**MongoDB Atlas: `SSL: TLSV1_ALERT_INTERNAL_ERROR` / `ServerSelectionTimeoutError`**
The Atlas cluster itself is rejecting the TLS handshake — not a client bug.
Check: (1) your current IP is in Atlas → Network Access → IP Access List,
(2) the cluster isn't paused (free tier auto-pauses on inactivity), (3) the
database user/password are still valid. Verify independently with
`openssl s_client -connect <shard-host>:27017 -tls1_2`.

**`GET /health/llm` returns `"status": "unhealthy"`**
`GEMINI_API_KEY` or `GEMINI_MODEL` is missing/empty in `.env`. This check is
free (no API call) — it only verifies configuration is present.

**`/documents/chat` returns 401**
Either the JWT is invalid/expired (re-login), or `GEMINI_API_KEY` itself is
invalid — check `GET /health/llm` to disambiguate.

**`/documents/chat` returns 429**
Either your own per-user rate limit (`RATE_LIMIT_PER_MINUTE`) or Gemini's
quota/rate limit was hit — the error message and `GET /metrics/llm`
(`rate_limited` vs. `quota_failures`) tell you which.

**`/documents/chat` returns 504**
Gemini didn't respond within `GEMINI_TIMEOUT_SECONDS`, even after retries.
Check Gemini's status page, or raise the timeout for consistently slow models.

**Cache seems "stuck" on an old answer**
The exact/semantic cache respects `CHAT_CACHE_TTL_SECONDS` (10 min default) —
wait it out, or lower the TTL/threshold for faster iteration during development.
