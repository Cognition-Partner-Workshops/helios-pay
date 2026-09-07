from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    helios_jwt_secret: str = "local-development-only"
    database_url: str = "postgresql+psycopg://helios:helios@postgres:5432/helios"
    redis_url: str = "redis://redis:6379/0"
    webhook_hmac_key: str = "local-development-only"
    helios_llm_mode: str = "stub"
    helios_cors_origins: str = "http://localhost:3000"
    core_api_url: str = "http://core-api:8000"
    ledger_url: str = "http://ledger-worker:8090"
    gateway_url: str = "http://partner-gateway:8080"
    helios_enable_legacy: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
