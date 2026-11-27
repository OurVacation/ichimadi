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
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    # 이름 후보는 짧은 작업이라 thinking 이 낮을수록 빠르다. 모델마다 받는 값이 다르다
    # (gemini-3.8-flash 는 minimal 을 거부하고 low 부터 받는다). 빈 값이면 모델 기본값을 쓴다.
    gemini_thinking_level: Literal["", "minimal", "low", "medium", "high"] = "low"
    # Gemini SDK 의 HTTP 제한 시간(초). API 가 10초 미만의 마감 시간을 400 으로 거부하므로
    # 10초보다 작게 설정해도 GeminiNameGenerator 가 10초로 올린다.
    # FE 는 3초 뒤 자체 규칙으로 대신한다.
    name_suggest_timeout_seconds: float = Field(default=10.0, gt=0)

    @model_validator(mode="after")
    def validate_production_secret(self) -> Self:
        if self.app_env == "prod" and self.jwt_secret == "dev-secret-change-me":
            raise ValueError("JWT_SECRET must be changed in production")
        return self


settings = Settings()
