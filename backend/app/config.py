from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load from env; Supabase URL/key for Postgres and Auth."""

    # Supabase / Postgres (async)
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/pms"

    # Supabase Auth (JWT validation)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""

    # Set to true to disable auth (local dev)
    auth_disabled: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
