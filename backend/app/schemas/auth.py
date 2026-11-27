from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"login_id": "judge01", "password": "4821"}]}
    )
    login_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "access_token": "eyJ...",
                    "token_type": "bearer",
                    "account_id": "judge01",
                    "expires_in": 259200,
                }
            ]
        }
    )
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    account_id: str
    expires_in: int
