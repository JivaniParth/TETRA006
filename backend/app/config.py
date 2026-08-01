import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    GEMINI_API_KEYS: str = "placeholder_key"
    GEMINI_MODELS: str = "gemini-2.5-flash,gemini-1.5-flash"
    
    MEDGEMMA_TUNNEL_URL: str = "http://localhost:8000"
    MEDGEMMA_MODEL_NAME: str = "medgemma-4b"
    MEDGEMMA_API_KEY: str = "placeholder_key"

    
    JWT_SECRET: str = "change_me_secret_key"
    JWT_EXPIRY_MIN: int = 1440
    
    POSTGRES_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/medguard"
    REDIS_URL: str = "redis://localhost:6379/0"
    QDRANT_URL: str = "http://localhost:6333"
    KAFKA_BROKERS: str = "localhost:9092"
    
    MAX_SESSION_TURNS: int = 4
    SEMANTIC_CACHE_THRESHOLD: float = 0.92
    REPORT_CONFIDENCE_THRESHOLD: float = 0.85
    RATE_LIMIT_PER_MIN: int = 60

    @property
    def gemini_keys_list(self) -> List[str]:
        return [k.strip() for k in self.GEMINI_API_KEYS.split(",") if k.strip()]

    @property
    def gemini_models_list(self) -> List[str]:
        return [m.strip() for m in self.GEMINI_MODELS.split(",") if m.strip()]

settings = Settings()
