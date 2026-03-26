"""Supabase JWT authentication dependency for FastAPI."""
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


async def require_auth(request: Request) -> dict:
    """Validate Supabase JWT from Authorization header.

    Returns the decoded token payload on success.
    Skips validation when SUPABASE_JWT_SECRET is not configured (dev mode).
    """
    # Skip auth when explicitly disabled or no JWT secret configured (local dev)
    if settings.auth_disabled or not settings.supabase_jwt_secret:
        return {}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Missing token")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[ALGORITHM],
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

    return payload