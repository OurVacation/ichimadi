import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import AppError, register_error_handlers

app = FastAPI()
register_error_handlers(app)


@app.get("/items/{item_id}")
def read_item(item_id: int) -> None:
    if item_id == 0:
        raise RuntimeError("boom")
    raise AppError("sample", "サンプル", 409)


client = TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize(
    ("path", "status", "code"),
    [
        ("/items/1", 409, "sample"),
        ("/items/abc", 422, "validation_error"),
        ("/missing", 404, "not_found"),
        ("/items/0", 500, "internal_error"),
    ],
)
def test_error_format(path: str, status: int, code: str) -> None:
    response = client.get(path)

    assert response.status_code == status
    assert set(response.json()) == {"code", "message_ja"}
    assert response.json()["code"] == code
