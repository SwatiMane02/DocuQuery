"""
Security utilities for JWT token generation and password hashing.

This module provides:
1. Password hashing using bcrypt (one-way encryption)
2. JWT token creation and validation
3. Dependency injection setup for FastAPI route protection

Key Security Principles:
- Passwords are NEVER stored in plain text
- bcrypt uses salt + hash to prevent rainbow table attacks
- JWT tokens are signed to prevent tampering
- Tokens have expiration times for security
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import ValidationError

from app.core.config import settings

# ============================================================================
# PASSWORD HASHING SETUP
# ============================================================================

# CryptContext: Passlib utility for managing password hashing
# 
# Explanation:
# - schemes=["bcrypt"]: Use bcrypt algorithm (recommended for passwords)
# - deprecated="auto": Automatically update hash if algorithm changes
# 
# bcrypt Benefits:
# 1. Automatically generates random salt for each password
# 2. Hashes are slow to compute (prevents brute-force attacks)
# 3. Industry standard for password storage
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a plain-text password using bcrypt.
    
    How it works:
    1. Takes plain-text password from user
    2. Generates random salt (part of bcrypt)
    3. Applies multiple hashing rounds (slowing computation)
    4. Returns hashed password (can never be reversed)
    
    IMPORTANT - BCRYPT 72-BYTE LIMIT:
    - Bcrypt truncates passwords longer than 72 bytes
    - Passwords are already validated at schema level to enforce this
    - If you see "password cannot be longer than 72 bytes" error:
      * Check requirements.txt: passlib and bcrypt versions
      * Ensure compatibility: passlib[bcrypt] with bcrypt>=4.0.0
      * Validate that UserCreate schema enforces 72-byte limit
    
    Example:
        plain_password = "MySecurePassword123!"
        hashed = hash_password(plain_password)
        # hashed = "$2b$12$abcdef1234567890..." (different each time due to salt)
    
    Args:
        password: Plain-text password from user input (max 72 UTF-8 bytes)
        
    Returns:
        Hashed password string (safe to store in database)
        
    Raises:
        ValueError: If password exceeds 72 bytes (caught by schema validator first)
    """
    # Validate 72-byte limit at runtime as defense-in-depth
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        raise ValueError(
            f'Password is {len(password_bytes)} bytes, exceeds bcrypt 72-byte limit. '
            f'This should have been caught by schema validation. '
            f'Please check UserCreate schema in app/schemas/user.py'
        )
    
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against its bcrypt hash.
    
    How it works:
    1. Takes plain-text password from login form
    2. Takes hashed password from database
    3. Applies same hashing algorithm to plain-text
    4. Compares results (bcrypt handles salt automatically)
    5. Returns True if they match, False otherwise
    
    Security Note:
    - Even with database leak, attacker can't recover original password
    - Hashing is one-way: can't decrypt hash back to password
    
    Example:
        user_provided = "MySecurePassword123!"
        db_hash = "$2b$12$abcdef1234567890..."
        is_correct = verify_password(user_provided, db_hash)
        # Returns True if password matches
    
    Args:
        plain_password: Password provided by user at login
        hashed_password: Password hash stored in database
        
    Returns:
        True if password is correct, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


# ============================================================================
# JWT TOKEN MANAGEMENT
# ============================================================================

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Create a JWT access token.
    
    JWT Structure:
    - Header: Algorithm info (alg: "HS256")
    - Payload: User data + expiration (sub, email, exp, iat)
    - Signature: HMAC(header+payload, secret_key)
    
    How JWT works:
    1. Server creates token with user's email/ID
    2. Server signs with SECRET_KEY (only server knows this)
    3. Client stores token in browser/app
    4. Client includes token in Authorization header for requests
    5. Server verifies token signature to check it's authentic
    6. Server reads payload to identify user
    
    Token Structure Example:
    {
        "sub": "user@example.com",           # Subject (user identifier)
        "exp": 1234567890,                    # Expiration time (Unix timestamp)
        "iat": 1234567800,                    # Issued at (Unix timestamp)
        "email": "user@example.com"           # Additional claims
    }
    
    Security Details:
    - Token expires after ACCESS_TOKEN_EXPIRE_MINUTES (default: 30 min)
    - Signature prevents token tampering
    - Without expiration, leaked tokens could be used forever
    
    Example:
        token_data = {"sub": "user@example.com", "email": "user@example.com"}
        token = create_access_token(data=token_data)
        # Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    
    Args:
        data: Dictionary containing token claims (must include "sub" for subject)
              Example: {"sub": "user_id", "email": "user@example.com"}
        expires_delta: Custom expiration time. If None, uses ACCESS_TOKEN_EXPIRE_MINUTES
        
    Returns:
        Encoded JWT token string
    """
    # Create a copy to avoid modifying original data
    to_encode = data.copy()
    
    # Calculate expiration time
    if expires_delta:
        # Use custom expiration if provided
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Use default expiration from settings
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # Add expiration to token payload
    # "exp" is standard JWT claim for expiration (Unix timestamp)
    to_encode.update({"exp": expire})
    
    # Create JWT token
    # Parameters:
    # 1. to_encode: payload dictionary
    # 2. settings.SECRET_KEY: key to sign with (keep this secret!)
    # 3. algorithm: HS256 uses HMAC-SHA256 for signing
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """
    Decode and verify a JWT access token.
    
    How token verification works:
    1. Extract header, payload, and signature from token
    2. Calculate expected signature using SECRET_KEY
    3. Compare with token's signature
    4. If match: token is valid and not tampered
    5. If mismatch: token is invalid/corrupted
    6. Check if token is expired
    7. Extract and return payload data
    
    Error Handling:
    - Invalid token (wrong signature): Returns None
    - Expired token (exp < current_time): Returns None
    - Malformed token: Returns None
    - Valid token: Returns payload dictionary
    
    Example:
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        payload = decode_access_token(token)
        if payload:
            user_email = payload.get("sub")  # user_email = "user@example.com"
            print(user_email)
        else:
            print("Invalid or expired token")
    
    Args:
        token: JWT token string from Authorization header
        
    Returns:
        Dictionary with token payload if valid (contains "sub", "email", etc)
        None if token is invalid or expired
    """
    try:
        # Decode JWT token
        # Parameters:
        # 1. token: the token to decode
        # 2. settings.SECRET_KEY: key to verify signature with
        # 3. algorithms: list of allowed algorithms (only HS256 is allowed)
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        # Extract "sub" claim (standard JWT claim for subject/user ID)
        subject: str | None = payload.get("sub")
        
        # "sub" must exist in token (we set it during token creation)
        if subject is None:
            return None
        
        # If we get here: token is valid and not expired
        return payload
        
    except JWTError:
        # Token verification failed (invalid signature or expired)
        # JWTError covers:
        # - Invalid signature
        # - Expired token (exp claim < current time)
        # - Malformed token
        # - Algorithm mismatch
        return None
    except ValidationError:
        # Token payload validation failed
        return None
