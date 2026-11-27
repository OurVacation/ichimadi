import pytest
from sqlalchemy import func, select

from app.models import StampProfile


@pytest.mark.parametrize(
    ("method", "path", "data"),
    [
        ("get", "/api/me", None),
        ("put", "/api/me/profile", {"animal": "tiger", "korean_name": None}),
    ],
)
def test_requires_auth(client, method, path, data):
    assert client.request(method, path, json=data).status_code == 401


def test_initial_profile(client, db, make_user, auth_header):
    user = make_user()
    assert client.get("/api/me", headers=auth_header(user)).json() == {
        "account_id": "judge01",
        "animal": None,
        "korean_name": None,
    }
    assert db.scalar(select(func.count()).select_from(StampProfile)) == 0


@pytest.mark.parametrize("name", [None, "", "  ", "양자", " 양자 "])
def test_profile_roundtrip(client, make_user, auth_header, name):
    user = make_user()
    headers = auth_header(user)
    data = {"animal": "tiger", "korean_name": name}
    expected = {
        "account_id": "judge01",
        "animal": "tiger",
        "korean_name": name.strip() if name is not None else None,
    }
    for _ in range(2):
        result = client.put("/api/me/profile", headers=headers, json=data)
        assert result.status_code == 200
        assert result.json() == expected
        assert client.get("/api/me", headers=headers).json() == expected


@pytest.mark.parametrize(
    "data",
    [
        {"animal": "cat", "korean_name": None},
        {"animal": None, "korean_name": "yoko"},
        {"animal": "tiger", "korean_name": "가나다라마바사아자차카"},
    ],
)
def test_invalid_profile(client, make_user, auth_header, data):
    result = client.put("/api/me/profile", headers=auth_header(make_user()), json=data)
    assert result.status_code == 422
    assert result.json()["code"] == "invalid_profile"


@pytest.mark.parametrize("data", [{}, {"animal": None}, {"korean_name": None}])
def test_missing_keys(client, make_user, auth_header, data):
    result = client.put("/api/me/profile", headers=auth_header(make_user()), json=data)
    assert result.status_code == 422
    assert result.json()["code"] == "validation_error"


def test_profile_isolation(client, make_user, auth_header):
    a, b = make_user("a"), make_user("b")
    assert (
        client.put(
            "/api/me/profile",
            headers=auth_header(a),
            json={"animal": "bear", "korean_name": "양자"},
        ).status_code
        == 200
    )
    assert client.get("/api/me", headers=auth_header(b)).json() == {
        "account_id": "b",
        "animal": None,
        "korean_name": None,
    }
