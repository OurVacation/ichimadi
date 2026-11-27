from pydantic import BaseModel, ConfigDict

from app.models import Animal


class ProfileRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"animal": "tiger", "korean_name": "양자"},
                {"animal": "tiger", "korean_name": ""},
            ]
        }
    )
    animal: str | None
    korean_name: str | None


class MeResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"account_id": "judge01", "animal": None, "korean_name": None}]
        }
    )
    account_id: str
    animal: Animal | None
    korean_name: str | None
