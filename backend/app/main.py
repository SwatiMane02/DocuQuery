"""
Main FastAPI application entry point.

This module:
1. Initializes FastAPI app with configuration
2. Sets up lifespan events (startup/shutdown)
3. Registers API routers
4. Defines root endpoints

Application Structure:
- app/main.py: FastAPI app initialization (THIS FILE)
- app/api/: API route handlers (auth.py, documents.py, etc.)
- app/services/: Business logic (auth_service.py, document_service.py, etc.)
- app/models/: Database document models
- app/schemas/: API request/response schemas
- app/core/: Configuration and security utilities
- app/db/: Database connection and utilities

Router Organization:
Each API module (auth, documents, etc.) creates its own router with prefix.
Main app includes all routers, grouping them logically.

Example:
- api/auth.py creates router with prefix="/auth"
- api/documents.py creates router with prefix="/documents"
- Main app includes both: app.include_router(auth.router), etc.
- Results in endpoints: /auth/login, /auth/register, /documents/upload, etc.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.db.database import connect_to_mongo, close_mongo_connection, ping_database
from app.api import auth, documents, llm_ops, conversations, analytics, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager for startup/shutdown events.
    """
    # ===== STARTUP =====
    import logging
    logging.getLogger("app").setLevel(logging.INFO)

    # Validate production configuration
    settings.validate_production_config()
    
    # Connect to MongoDB when application starts
    await connect_to_mongo()

    # ===== APPLICATION RUNNING =====
    yield

    # ===== SHUTDOWN =====
    # Close MongoDB connection when application stops
    await close_mongo_connection()


# ============================================================================
# APP INITIALIZATION
# ============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    description="RAG Document Intelligence Platform",
    lifespan=lifespan
)


# ============================================================================
# CORS MIDDLEWARE
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


# ============================================================================
# ROUTER REGISTRATION
# ============================================================================

# Include authentication router
# All routes in auth.router will be prefixed with /auth
# Example: GET /auth/me, POST /auth/login, POST /auth/register
app.include_router(auth.router)

# Include documents router
# All routes in documents.router will be prefixed with /documents
# Example: POST /documents/upload, GET /documents, DELETE /documents/{id}
app.include_router(documents.router)

# Include conversations router
# All routes in conversations.router will be prefixed with /conversations
app.include_router(conversations.router)

# Include analytics router: /analytics/user
app.include_router(analytics.router)

# Include admin router: /admin/stats, /admin/users
app.include_router(admin.router)

# Include LLM ops router: GET /health/llm, GET /metrics/llm
app.include_router(llm_ops.router)


# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    """
    Root endpoint - API welcome message.
    
    Returns:
        Welcome message with app name and version
    """
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint - actively verify API and database connectivity.
    
    Used by:
    - Load balancers to verify server is healthy
    - Monitoring systems to track uptime
    - Kubernetes liveness/readiness probes
    
    Returns:
        200 OK when healthy and database connected
        503 Service Unavailable when database unreachable
    """
    db_connected = await ping_database()
    content = {
        "status": "healthy" if db_connected else "unhealthy",
        "database": "connected" if db_connected else "disconnected",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }
    status_code = status.HTTP_200_OK if db_connected else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=status_code, content=content)