from pathlib import Path
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ichimadi"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    database_url: str = "postgresql+psycopg://ichimadi:ichimadi@db:5432/ichimadi"
    app_env: Literal["local", "test", "prod"] = "local"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_hours: int = Field(default=72, gt=0)
    content_dir: Path = Path(__file__).resolve().parents[3] / "content"

    @model_validator(mode="after")
    def validate_production_secret(self) -> Self:
        if self.app_env == "prod" and self.jwt_secret == "dev-secret-change-me":
            raise ValueError("JWT_SECRET must be changed in production")
        return self


settings = Settings()
