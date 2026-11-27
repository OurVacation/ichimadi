from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ichimadi"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    # 로컬 개발용 기본값. 배포 환경에서는 DATABASE_URL로 덮어쓴다.
    database_url: str = "postgresql+psycopg://ichimadi:ichimadi@db:5432/ichimadi"

    content_dir: Path = Path(__file__).resolve().parents[3] / "content"


settings = Settings()
