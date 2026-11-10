"""
Application configuration module.

This module loads and validates environment variables using Pydantic BaseSettings.
It provides a singleton settings object that can be imported and used throughout
the application.

Key concepts:
- All configuration comes from environment variables or .env file
- Type validation ensures correct data types
- Secrets are never hardcoded
- Settings are loaded once at startup for performance
"""

from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Pydantic's BaseSettings automatically:
    1. Loads variables from .env file (if python-dotenv is installed)
    2. Reads from actual environment variables
    3. Validates types (e.g., DEBUG must be boolean)
    4. Raises errors if required fields are missing
    
    Usage:
        from app.core.config import settings
        
        print(settings.APP_NAME)      # "DocuQuery API"
        print(settings.DEBUG)          # True
        print(settings.DATABASE_NAME)  # "docuquery"
    """
    
    # Application metadata
    APP_NAME: str = Field(default="DocuQuery API", description="Application name")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment: development, staging, production, test"
    )
    PORT: int = Field(default=8000, description="Port for running the application")
    
    # Debug mode - controls verbose logging and error details
    DEBUG: bool = Field(default=False, description="Enable debug mode")

    # CORS configuration - comma-separated list of allowed origins
    CORS_ORIGINS: str = Field(
        default="https://docu-query-theta.vercel.app,http://localhost:5173,http://localhost:3000,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:8080",
        description="Allowed CORS origins (comma-separated string)"
    )
    
    # Database configuration (MongoDB Atlas / Cloud / Local)
    MONGODB_URI: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection string (e.g., mongodb+srv://... for MongoDB Atlas)"
    )
    DATABASE_NAME: str = Field(
        default="docuquery",
        description="MongoDB database name"
    )
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: int = Field(
        default=5000,
        description="Server selection timeout in ms for MongoDB Atlas"
    )
    MONGODB_CONNECT_TIMEOUT_MS: int = Field(
        default=5000,
        description="Connection timeout in ms for MongoDB Atlas"
    )
    
    # Security settings
    SECRET_KEY: str = Field(
        description="Secret key for signing JWTs - keep this secure!",
        min_length=32
    )
    ALGORITHM: str = Field(
        default="HS256",
        description="Algorithm for JWT encoding/decoding"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="JWT access token expiration time in minutes"
    )

    # Cloudinary storage configuration
    CLOUDINARY_CLOUD_NAME: str = Field(
        default="",
        description="Cloudinary cloud name for file storage"
    )
    CLOUDINARY_API_KEY: str = Field(
        default="",
        description="Cloudinary API key"
    )
    CLOUDINARY_API_SECRET: str = Field(
        default="",
        description="Cloudinary API secret"
    )

    # Gemini LLM configuration
    GEMINI_API_KEY: str = Field(
        default="",
        description="API key for Google Gemini (generative-language) API"
    )
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Gemini model used for RAG answer generation"
    )
    GEMINI_TIMEOUT_SECONDS: float = Field(
        default=30.0,
        description="Max time to wait for a single Gemini API call"
    )
    GEMINI_MAX_RETRIES: int = Field(
        default=2,
        description="Max retries (with exponential backoff) for transient Gemini errors"
    )

    # Embedding model configuration (Gemini zero-memory embeddings)
    EMBEDDING_MODEL: str = Field(
        default="gemini-embedding-001",
        description="Gemini model used for generating embeddings"
    )
    EMBEDDING_DIMENSIONS: int = Field(
        default=384,
        description="Embedding vector dimensions (384 for fast retrieval and compatibility)"
    )

    # RAG retrieval / context-budget configuration
    TOP_K_RESULTS: int = Field(
        default=10,
        description="Default number of chunks retrieved for /chat"
    )
    MAX_CONTEXT_CHUNKS: int = Field(
        default=10,
        description="Max number of chunks to include in the prompt after budgeting"
    )
    MAX_CONTEXT_CHARACTERS: int = Field(
        default=12000,
        description="Max total characters of chunk content sent to the LLM per request"
    )
    MAX_OUTPUT_TOKENS: int = Field(
        default=512,
        description="Max tokens Gemini may generate per answer"
    )
    TEMPERATURE: float = Field(
        default=0.2,
        description="Gemini sampling temperature (low = deterministic, factual)"
    )

    # In-memory answer cache (per document_id + question)
    CHAT_CACHE_TTL_SECONDS: int = Field(
        default=600,
        description="How long an identical question's answer is cached (10 min default)"
    )
    SEMANTIC_CACHE_THRESHOLD: float = Field(
        default=0.95,
        description="Min cosine similarity between question embeddings to serve a semantic cache hit"
    )

    # Dynamic context budget (chunk count is chosen per-query, within these bounds)
    MIN_CONTEXT_CHUNKS: int = Field(
        default=2,
        description="Fewest chunks to send for a short factual question"
    )
    DEFAULT_CONTEXT_CHUNKS: int = Field(
        default=5,
        description="Chunks to send for a normal question"
    )

    # Token budgeting (approximate; stops adding chunks once exceeded)
    MAX_PROMPT_TOKENS: int = Field(
        default=3000,
        description="Approximate max tokens (prompt) sent to the LLM per request"
    )

    # Streaming
    STREAMING_ENABLED: bool = Field(
        default=False,
        description="Enable POST /documents/chat/stream (SSE-style token streaming)"
    )

    # Rate limiting (in-memory, per user)
    RATE_LIMIT_PER_MINUTE: int = Field(
        default=20,
        description="Max /chat requests per user per rolling 60s window"
    )

    # Provider selection (future-proofing: openai, groq, claude, ...)
    LLM_PROVIDER: str = Field(
        default="gemini",
        description="Which LLM provider LLMProviderFactory should construct"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """
        Parse CORS_ORIGINS into a clean, normalized list of allowed origin strings.
        Supports comma-separated strings or pre-configured lists.
        Enforces security and production best practices:
        - Strips whitespace and trailing slashes from each origin URL
        - Prevents wildcard '*' when credentials are enabled or in production
        - Preserves and supports production Vercel frontend and localhost origins
        """
        is_prod = self.ENVIRONMENT.lower() == "production" or (not self.DEBUG and self.ENVIRONMENT.lower() != "development")

        if not self.CORS_ORIGINS:
            if is_prod:
                return ["https://docu-query-theta.vercel.app"]
            return [
                "https://docu-query-theta.vercel.app",
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
            ]

        raw_items = self.CORS_ORIGINS if isinstance(self.CORS_ORIGINS, list) else self.CORS_ORIGINS.split(",")

        parsed: list[str] = []
        for item in raw_items:
            origin = str(item).strip().rstrip("/")
            if not origin:
                continue
            # Wildcard '*' is disallowed in production or with credentials per W3C CORS specification
            if origin == "*":
                if is_prod or not self.DEBUG:
                    continue
            if origin not in parsed:
                parsed.append(origin)

        # Fallback if list is empty after filtering
        if not parsed:
            if is_prod:
                parsed = ["https://docu-query-theta.vercel.app"]
            else:
                parsed = ["http://localhost:5173", "http://localhost:3000"]

        return parsed

    def validate_production_config(self) -> None:
        """
        Validate critical environment variables for production deployments.
        Raises clear, actionable RuntimeError messages without leaking secrets.
        """
        is_prod = self.ENVIRONMENT.lower() == "production" or (not self.DEBUG and self.ENVIRONMENT.lower() != "development")
        
        # 1. SECRET_KEY validation
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise RuntimeError(
                "Production configuration error: SECRET_KEY must be set to a secure key of at least 32 characters."
            )
        if "your-super-secret-key" in self.SECRET_KEY or "change-this" in self.SECRET_KEY:
            raise RuntimeError(
                "Production configuration error: SECRET_KEY contains default placeholder value. Set a secure production secret key."
            )

        # 2. Database validation
        if not self.MONGODB_URI:
            raise RuntimeError(
                "Production configuration error: MONGODB_URI environment variable is required."
            )
        if is_prod and ("localhost" in self.MONGODB_URI.lower() or "127.0.0.1" in self.MONGODB_URI):
            raise RuntimeError(
                "Production configuration error: MONGODB_URI points to localhost in production mode. "
                "Configure a valid MongoDB Atlas connection string (e.g., mongodb+srv://...)."
            )

        # 3. Gemini API Key validation
        if not self.GEMINI_API_KEY or "your_gemini_api_key" in self.GEMINI_API_KEY:
            if is_prod:
                raise RuntimeError(
                    "Production configuration error: GEMINI_API_KEY must be set for production AI operations."
                )

        # 4. Cloudinary configuration validation
        if is_prod:
            missing_cloudinary = []
            if not self.CLOUDINARY_CLOUD_NAME or "your_cloudinary" in self.CLOUDINARY_CLOUD_NAME:
                missing_cloudinary.append("CLOUDINARY_CLOUD_NAME")
            if not self.CLOUDINARY_API_KEY or "your_cloudinary" in self.CLOUDINARY_API_KEY:
                missing_cloudinary.append("CLOUDINARY_API_KEY")
            if not self.CLOUDINARY_API_SECRET or "your_cloudinary" in self.CLOUDINARY_API_SECRET:
                missing_cloudinary.append("CLOUDINARY_API_SECRET")
            if missing_cloudinary:
                missing_vars = ", ".join(missing_cloudinary)
                raise RuntimeError(
                    f"Production configuration error: Missing Cloudinary credentials ({missing_vars}) for cloud file storage."
                )

    class Config:
        """Pydantic configuration for BaseSettings."""
        # Load environment variables from .env file
        # Requires: pip install python-dotenv
        env_file = str(Path(__file__).resolve().parent.parent.parent / ".env")
        env_file_encoding = "utf-8"
        # Case-insensitive environment variable matching
        case_sensitive = False
        # Additional settings configuration
        extra = "ignore"  # Ignore extra environment variables not defined in Settings


# Singleton instance - created once at application startup
# This object is imported throughout the app to access settings
settings = Settings()


# Example of how to use settings in other modules:
"""
# In app/main.py or any other module:
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)
"""
