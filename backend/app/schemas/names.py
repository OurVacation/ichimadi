from pydantic import BaseModel, ConfigDict

from app.llm.base import Candidate


class NameSuggestRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"ja_name": "田中 陽子"}]})
    ja_name: str


class NameSuggestResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "candidates": [
                        {"name": "전양자", "note": "「田」と「陽子」の韓国語読み"},
                        {"name": "전요코", "note": "「田」を韓国の姓に、名前は音のまま"},
                        {"name": "전서연", "note": "「陽子」の明るい印象に近い韓国の名前"},
                    ]
                }
            ]
        }
    )
    candidates: list[Candidate]
