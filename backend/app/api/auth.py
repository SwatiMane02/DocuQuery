"""
Authentication API routes for user registration, login, and profile access.

API Endpoints:
- POST /auth/register: Create new user account
- POST /auth/login: Authenticate user and get JWT token
- GET /auth/me: Get current user profile (protected)

Route Structure:
1. Request → FastAPI receives JSON
2. FastAPI validates against schema
3. Route handler processes request
4. Service performs business logic
5. Response → FastAPI serializes response

Dependency Injection in FastAPI:
FastAPI uses Depends() to inject dependencies:
- HTTPException: Raise to return error response
- HTTPBearer: Get token from Authorization header
- get_current_user: Dependency that validates token and returns user

Protected Route Example:
@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    # FastAPI automatically:
    # 1. Gets token from Authorization: Bearer <token> header
    # 2. Calls get_current_user(token)
    # 3. If it raises exception: return error response
    # 4. If it returns user: pass to route handler

Error Handling:
- 400 Bad Request: Validation failed (Pydantic automatically handles)
- 401 Unauthorized: Invalid token or not authenticated
- 409 Conflict: Email already registered
- 422 Unprocessable Entity: Invalid input (Pydantic automatically handles)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, UserUpdate, PasswordChangeRequest
from app.services.auth_service import auth_service


# ============================================================================
# ROUTER SETUP
# ============================================================================

# Create router for authentication routes
# Parameters:
# - prefix="/auth": All routes in this router start with /auth
# - tags=["auth"]: Group these routes under "auth" in API documentation
router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

# HTTP Bearer scheme for JWT tokens
# Automatically extracts token from Authorization: Bearer <token> header
# If header missing: raises 403 Forbidden
# If header invalid format: raises 403 Forbidden
oauth2_scheme = HTTPBearer()


# ============================================================================
# DEPENDENCY INJECTION FUNCTIONS
# ============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
) -> User:
    """
    Dependency for protected routes.
    
    This function:
    1. Receives HTTPAuthCredentials from Authorization header
    2. Extracts JWT token
    3. Validates token using auth_service
    4. Returns User if valid, raises 401 if invalid
    
    Usage in protected routes:
    @router.get("/me")
    async def get_profile(current_user: User = Depends(get_current_user)):
        return current_user
    
    FastAPI automatically:
    - Validates Authorization header format
    - Calls this function
    - If raises HTTPException: returns error response
    - If returns User: passes to route handler
    
    Args:
        credentials: HTTP credentials from Authorization header
                    (FastAPI extracts this automatically)
    
    Returns:
        User object if token valid
    
    Raises:
        HTTPException 401: If token invalid, expired, or user not found
    """
    token = credentials.credentials
    
    # Get user from token
    user = await auth_service.get_current_user(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency for protected admin routes.
    
    Verifies that the current authenticated user has the 'admin' role.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access forbidden: admin role required",
        )
    return current_user



# ============================================================================
# ROUTES
# ============================================================================

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_create: UserCreate) -> Token:
    """
    Register a new user account.
    
    Process:
    1. Validate input using UserCreate schema
    2. Check if email already registered
    3. Hash password
    4. Save user to MongoDB
    5. Generate JWT token
    6. Return token
    
    Request Body (JSON):
    {
        "email": "john@example.com",
        "password": "SecurePassword123!",
        "full_name": "John Doe"
    }
    
    Success Response (201 Created):
    {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer"
    }
    
    Client uses token:
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    
    Error Responses:
    - 409 Conflict: Email already registered
    - 422 Unprocessable Entity: Invalid input (email format, password length, etc.)
    
    Args:
        user_create: UserCreate schema (validated by FastAPI)
    
    Returns:
        Token containing access_token and token_type
    """
    try:
        # Register user in database
        user = await auth_service.register_user(user_create)
    except ValueError as e:
        # Email already exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)  # "Email already registered"
        )
    
    # Generate JWT token for newly registered user
    token_data = {
        "sub": user.email,
        "email": user.email
    }
    access_token = create_access_token(data=token_data)
    
    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(user_login: UserLogin) -> Token:
    """
    Authenticate user and return JWT access token.
    
    Process:
    1. Validate input using UserLogin schema
    2. Find user by email in database
    3. Verify password matches stored hash
    4. Generate JWT token
    5. Return token to client
    
    Request Body (JSON):
    {
        "email": "john@example.com",
        "password": "SecurePassword123!"
    }
    
    Success Response (200 OK):
    {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer"
    }
    
    Client then includes token in requests:
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    
    Error Response (401 Unauthorized):
    - Email not found in database
    - Password doesn't match
    - Account is inactive
    
    Security Note:
    We return generic error message "Invalid email or password" for BOTH cases
    (email not found OR password wrong). This prevents attackers from enumerating
    valid email addresses through login endpoint.
    
    Args:
        user_login: UserLogin schema (validated by FastAPI)
    
    Returns:
        Token containing access_token and token_type
    
    Raises:
        HTTPException 401: If credentials invalid
    """
    # Authenticate user and get token
    access_token = await auth_service.authenticate_user(user_login)
    
    if not access_token:
        # Generic error for security (don't reveal which credential was wrong)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Get current user profile information.
    
    This is a protected endpoint that requires valid JWT token.
    
    Request (must include Authorization header):
    GET /auth/me
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    
    Success Response (200 OK):
    {
        "id": "507f1f77bcf86cd799439011",
        "email": "john@example.com",
        "full_name": "John Doe",
        "role": "free",
        "documents_limit": 10,
        "is_active": true,
        "created_at": "2024-05-24T10:30:00Z"
    }
    
    How FastAPI dependency injection works:
    1. Client sends Authorization header
    2. FastAPI extracts token from header
    3. FastAPI calls get_current_user(token)
    4. If token invalid: get_current_user raises HTTPException
    5. If token valid: get_current_user returns User
    6. User passed to this route handler
    
    Error Response (401 Unauthorized):
    - Token missing
    - Token invalid
    - Token expired
    - User (identified by token) no longer exists in database
    
    Response Uses UserResponse Schema:
    - Excludes hashed_password (security)
    - Excludes updated_at field (client doesn't need it)
    - Includes user profile information
    
    Args:
        current_user: User object from JWT token (injected by FastAPI)
    
    Returns:
        UserResponse with user profile data
    """
    # Simply return the current user
    # The dependency injection already validated the token
    # and loaded the user from database
    return current_user


@router.put("/me", response_model=UserResponse, summary="Update user profile")
async def update_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Update profile information (e.g., full_name, bio)."""
    updated = await auth_service.update_profile(
        user_id=str(current_user.id),
        data=payload.model_dump(exclude_none=True),
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return updated


@router.post("/change-password", summary="Change user password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Change account password."""
    success = await auth_service.change_password(
        user_id=str(current_user.id),
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    return {"message": "Password changed successfully"}


@router.get("/admin-check", response_model=UserResponse)
async def check_admin_access(
    current_admin: User = Depends(get_current_admin),
) -> UserResponse:
    """
    Endpoint to verify admin access. Protected by get_current_admin.
    """
    return current_admin
