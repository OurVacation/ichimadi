from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import Phrase, PhraseSet, Stamp


@pytest.mark.parametrize("method", ["get", "post"])
def test_requires_auth(client, method):
    assert client.request(method, "/api/me/stamps", json={"phrase_id": "q1"}).status_code == 401


def test_idempotent_and_isolated(client, db, seeded, make_user, auth_header):
    a, b = make_user("a"), make_user("b")
    headers = auth_header(a)
    empty = {
        "stamps": [],
        "progress": [{"set_code": "hackathon", "count": 0, "total": 6, "completed": False}],
    }
    assert client.get("/api/me/stamps", headers=headers).json() == empty
    first = client.post(
        "/api/me/stamps",
        headers=headers,
        json={"phrase_id": "q1", "stamped_at": "2000-01-01T00:00:00Z", "user_id": b.id},
    )
    assert first.status_code == 200
    second = client.post("/api/me/stamps", headers=headers, json={"phrase_id": "q1"})
    assert second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["progress"][0]["count"] == 1
    assert db.scalar(select(func.count()).select_from(Stamp)) == 1
    assert db.get(Stamp, (a.id, "q1")).stamped_at.year == datetime.now(UTC).year
    assert client.get("/api/me/stamps", headers=auth_header(b)).json() == empty


@pytest.mark.parametrize("kind", ["missing", "inactive-phrase", "inactive-set"])
def test_unknown_phrase(client, db, seeded, make_user, auth_header, kind):
    if kind == "inactive-phrase":
        db.get(Phrase, "q1").is_active = False
    elif kind == "inactive-set":
        db.get(PhraseSet, "hackathon").is_active = False
    db.flush()
    result = client.post(
        "/api/me/stamps",
        headers=auth_header(make_user()),
        json={"phrase_id": "q99" if kind == "missing" else "q1"},
    )
    assert result.status_code == 404
    assert result.json()["code"] == "unknown_phrase"


def test_completed_per_category(client, db, seeded, make_user, auth_header):
    db.add(PhraseSet(code="empty", name_ja="ハッカソン会場", sort_order=1))
    db.add(PhraseSet(code="other", name_ja="ハッカソン会場", sort_order=2))
    db.flush()
    p = db.get(Phrase, "q1")
    values = {column.name: getattr(p, column.name) for column in Phrase.__table__.columns}
    values.update(id="other1", set_code="other")
    db.add(Phrase(**values))
    db.flush()
    user = make_user()
    for number in range(1, 7):
        result = client.post(
            "/api/me/stamps", headers=auth_header(user), json={"phrase_id": f"q{number}"}
        )
        assert result.status_code == 200
    assert result.json()["progress"] == [
        {"set_code": "hackathon", "count": 6, "total": 6, "completed": True},
        {"set_code": "empty", "count": 0, "total": 0, "completed": False},
        {"set_code": "other", "count": 0, "total": 1, "completed": False},
    ]


def test_order_and_visibility(client, db, seeded, make_user, auth_header):
    user = make_user()
    now = datetime.now(UTC)
    for phrase_id, offset in [("q3", -2), ("q2", -1), ("q1", -1)]:
        db.add(
            Stamp(user_id=user.id, phrase_id=phrase_id, stamped_at=now + timedelta(seconds=offset))
        )
    db.flush()
    assert [
        s["phrase_id"]
        for s in client.get("/api/me/stamps", headers=auth_header(user)).json()["stamps"]
    ] == ["q3", "q1", "q2"]
    db.get(Phrase, "q3").is_active = False
    db.flush()
    body = client.get("/api/me/stamps", headers=auth_header(user)).json()
    assert len(body["stamps"]) == 2
    assert body["progress"][0]["total"] == 5
    db.get(PhraseSet, "hackathon").is_active = False
    db.flush()
    assert client.get("/api/me/stamps", headers=auth_header(user)).json() == {
        "stamps": [],
        "progress": [],
    }
