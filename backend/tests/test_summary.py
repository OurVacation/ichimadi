from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.models import Phrase, PhraseSet, Stamp


@pytest.fixture
def two_sets(db, seeded):
    """hackathon(q1~q6) + cafe(c1, c2)"""
    db.add(PhraseSet(code="cafe", name_ja="カフェ", sort_order=1))
    db.flush()
    for order, pid in enumerate(["c1", "c2"]):
        db.add(
            Phrase(
                id=pid,
                set_code="cafe",
                sort_order=order,
                label=f"ラベル{pid}",
                ko=f"한마디 {pid}",
                kana="ハンマディ",
                ja_meaning="一言",
                usage_ja="とき",
                reply_ko="네",
                reply_kana="ネ",
                reply_ja="はい",
            )
        )
    db.flush()


def stamp(client, headers, *ids):
    for pid in ids:
        assert (
            client.post("/api/me/stamps", headers=headers, json={"phrase_id": pid}).status_code
            == 200
        )


def test_requires_auth(client):
    result = client.get("/api/me/summary")
    assert result.status_code == 401
    assert result.json()["code"] == "unauthorized"


def test_empty(client, make_user, auth_header, two_sets):
    assert client.get("/api/me/summary", headers=auth_header(make_user())).json() == {
        "account_id": "judge01",
        "animal": None,
        "korean_name": None,
        "stamp_count": 0,
        "phrase_count": 8,
        "sets": [
            {
                "code": "hackathon",
                "name_ja": "ハッカソン会場",
                "count": 0,
                "total": 6,
                "completed": False,
                "stamps": [],
            },
            {
                "code": "cafe",
                "name_ja": "カフェ",
                "count": 0,
                "total": 2,
                "completed": False,
                "stamps": [],
            },
        ],
    }


def test_progress_by_set(client, db, make_user, auth_header, two_sets):
    headers = auth_header(make_user())
    client.put("/api/me/profile", headers=headers, json={"animal": "bear", "korean_name": "양자"})
    stamp(client, headers, "q3", "c2", "c1", "q1", "c1")
    # 한 테스트는 한 트랜잭션이라 now()가 모두 같다. 받은 순서대로 시각을 넣어 정렬을 확인한다.
    base = datetime(2026, 11, 29, 5, tzinfo=UTC)
    for minutes, pid in enumerate(["q3", "c2", "c1", "q1"]):
        db.execute(
            update(Stamp)
            .where(Stamp.phrase_id == pid)
            .values(stamped_at=base + timedelta(minutes=minutes))
        )
    body = client.get("/api/me/summary", headers=headers).json()
    assert (body["animal"], body["korean_name"]) == ("bear", "양자")
    assert (body["stamp_count"], body["phrase_count"]) == (4, 8)
    hackathon, cafe = body["sets"]
    assert (hackathon["count"], hackathon["completed"]) == (2, False)
    assert [s["phrase_id"] for s in hackathon["stamps"]] == ["q3", "q1"]
    assert hackathon["stamps"][0]["label"] == "機能"
    assert hackathon["stamps"][0]["ko"] == "어떤 기능인가요?"
    assert (cafe["count"], cafe["completed"]) == (2, True)
    assert [s["phrase_id"] for s in cafe["stamps"]] == ["c2", "c1"]
    assert cafe["stamps"][0]["stamped_at"] == "2026-11-29T05:01:00Z"


def test_isolation(client, make_user, auth_header, two_sets):
    a, b = make_user("a"), make_user("b")
    stamp(client, auth_header(a), "q1", "c1")
    body = client.get("/api/me/summary", headers=auth_header(b)).json()
    assert body["account_id"] == "b"
    assert body["stamp_count"] == 0
    assert all(s["stamps"] == [] for s in body["sets"])


def test_inactive_content_hidden(client, db, make_user, auth_header, two_sets):
    headers = auth_header(make_user())
    stamp(client, headers, "q1", "q2", "c1")
    db.get(Phrase, "q1").is_active = False
    db.get(PhraseSet, "cafe").is_active = False
    db.flush()
    body = client.get("/api/me/summary", headers=headers).json()
    assert [s["code"] for s in body["sets"]] == ["hackathon"]
    assert body["sets"][0]["total"] == 5
    assert [s["phrase_id"] for s in body["sets"][0]["stamps"]] == ["q2"]
    assert (body["stamp_count"], body["phrase_count"]) == (1, 5)
