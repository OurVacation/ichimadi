from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import Animal

_STAMP_EXAMPLE = {
    "phrase_id": "q1",
    "label": "はじめまして",
    "ko": "어떤 앱인가요?",
    "stamped_at": "2026-11-29T05:00:00Z",
}
_SET_EXAMPLE = {
    "code": "hackathon",
    "name_ja": "ハッカソン会場",
    "count": 1,
    "total": 6,
    "completed": False,
    "stamps": [_STAMP_EXAMPLE],
}


class SummaryStamp(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [_STAMP_EXAMPLE]})
    phrase_id: str
    label: str
    ko: str
    stamped_at: datetime


class SummarySet(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [_SET_EXAMPLE]})
    code: str
    name_ja: str
    count: int
    total: int
    completed: bool
    stamps: list[SummaryStamp]


class SummaryResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "account_id": "judge01",
                    "animal": "tiger",
                    "korean_name": "양자",
                    "stamp_count": 1,
                    "phrase_count": 24,
                    "sets": [
                        _SET_EXAMPLE,
                        {
                            "code": "cafe",
                            "name_ja": "カフェ",
                            "count": 0,
                            "total": 6,
                            "completed": False,
                            "stamps": [],
                        },
                    ],
                }
            ]
        }
    )
    account_id: str
    animal: Animal | None
    korean_name: str | None
    stamp_count: int
    phrase_count: int
    sets: list[SummarySet]
