from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
import os

# Resolve .env from the project root regardless of where uvicorn is launched from.
# config.py lives at backend/app/core/config.py → 3 parents up = project root.
_ENV_FILE = Path(__file__).parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_NAME: str = "Quality Intelligence Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_DOCS_ENABLED: bool = True

    # Database
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "quality_platform"
    POSTGRES_USER: str = "qp_user"
    POSTGRES_PASSWORD: str = "change_me"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Auth / JWT
    SECRET_KEY: str = "change_me_very_long_random_secret_key_at_least_64_chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # File storage
    UPLOAD_DIR: str = "/app/storage/uploads"
    EXPORT_DIR: str = "/app/storage/exports"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    TRUSTED_HOSTS: str = "localhost,127.0.0.1"

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [host.strip() for host in self.TRUSTED_HOSTS.split(",") if host.strip()]

    # Logging
    LOG_LEVEL: str = "INFO"

    # Azure Document Intelligence (optional)
    AZURE_DI_ENDPOINT: str = ""
    AZURE_DI_API_KEY: str = ""

    @property
    def azure_di_enabled(self) -> bool:
        return bool(self.AZURE_DI_ENDPOINT and self.AZURE_DI_API_KEY)

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.ENVIRONMENT.lower() != "production":
            return self

        insecure_passwords = {"change_me", "change_me_strong_password", "qp_dev_password_2026"}
        if self.POSTGRES_PASSWORD in insecure_passwords or len(self.POSTGRES_PASSWORD) < 16:
            raise ValueError("POSTGRES_PASSWORD must be a strong value of at least 16 characters in production")
        if self.SECRET_KEY.startswith("change_me") or len(self.SECRET_KEY) < 64:
            raise ValueError("SECRET_KEY must be a random value of at least 64 characters in production")
        if self.DEBUG:
            raise ValueError("DEBUG must be false in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
