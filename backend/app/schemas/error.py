from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"code": "validation_error", "message_ja": "入力内容を確認してください。"}]
        }
    )

    code: str
    message_ja: str
