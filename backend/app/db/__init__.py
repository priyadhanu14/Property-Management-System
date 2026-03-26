from app.db.base import Base

# Lazy imports — session.py creates the async engine at module level,
# which fails during Alembic migrations (sync context).
# Import these where needed instead of eagerly here.


def __getattr__(name: str):
    if name in ("async_session_maker", "get_session"):
        from app.db.session import async_session_maker, get_session
        return {"async_session_maker": async_session_maker, "get_session": get_session}[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["async_session_maker", "get_session", "Base"]
