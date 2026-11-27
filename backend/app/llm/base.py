from typing import Protocol

from pydantic import BaseModel, ConfigDict


class Candidate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"name": "전양자", "note": "「田」と「陽子」の韓国語読み"}]}
    )
    name: str
    note: str


class NameGeneratorError(Exception):
    pass


class NameGenerator(Protocol):
    model: str

    def generate(self, full_name: str) -> list[Candidate]: ...
