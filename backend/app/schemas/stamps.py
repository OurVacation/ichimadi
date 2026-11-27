from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AddStampRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"phrase_id": "q1"}]})
    phrase_id: str


class StampItem(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"phrase_id": "q1", "set_code": "hackathon", "stamped_at": "2026-11-29T05:00:00Z"}
            ]
        }
    )
    phrase_id: str
    set_code: str
    stamped_at: datetime


class SetProgress(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"set_code": "hackathon", "count": 0, "total": 6, "completed": False}]
        }
    )
    set_code: str
    count: int
    total: int
    completed: bool


class StampsResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "stamps": [],
                    "progress": [
                        {"set_code": "hackathon", "count": 0, "total": 6, "completed": False}
                    ],
                }
            ]
        }
    )
    stamps: list[StampItem]
    progress: list[SetProgress]
