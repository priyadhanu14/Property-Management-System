"""Supabase JWT authentication dependency for FastAPI."""
import logging

import httpx
from fastapi import HTTPException, Request
from jose import JWTError, jwt, jwk
from jose.utils import base64url_decode

from app.config import settings

logger = logging.getLogger(__name__)

# Cache for JWKS keys
_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    """Fetch and cache JWKS from Supabase."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("Fetched JWKS from %s", jwks_url)
        return _jwks_cache


def _get_signing_key(token: str, jwks: dict) -> str | dict:
    """Find the correct key from JWKS to verify the token."""
    headers = jwt.get_unverified_headers(token)
    kid = headers.get("kid")
    alg = headers.get("alg", "HS256")

    # For HS256, use the JWT secret directly
    if alg == "HS256":
        return settings.supabase_jwt_secret

    # For asymmetric algorithms (ES256, RS256), find key by kid in JWKS
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise JWTError(f"No matching key found for kid={kid}")


async def require_auth(request: Request) -> dict:
    """Validate Supabase JWT from Authorization header.

    Returns the decoded token payload on success.
    Skips validation when auth is disabled or no Supabase URL configured.
    """
    if settings.auth_disabled:
        return {}

    # Skip auth if neither JWT secret nor Supabase URL is configured (local dev)
    if not settings.supabase_jwt_secret and not settings.supabase_url:
        return {}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Missing token")

    try:
        jwks = await _get_jwks() if settings.supabase_url else {"keys": []}
        key = _get_signing_key(token, jwks)
        headers = jwt.get_unverified_headers(token)
        alg = headers.get("alg", "HS256")

        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            options={"verify_aud": False},
        )
    except JWTError as e:
        logger.error("JWT decode failed: %s", e)
        raise HTTPException(401, "Invalid or expired token")
    except httpx.HTTPError as e:
        logger.error("Failed to fetch JWKS: %s", e)
        raise HTTPException(500, "Authentication service unavailable")

    return payload
