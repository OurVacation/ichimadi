import json

import pytest

from app.models import Phrase, PhraseSet
from tests.conftest import CONTENT


def test_public_content(client, seeded):
    result = client.get("/api/phrase-sets")
    assert result.status_code == 200
    assert result.headers["Cache-Control"] == "public, max-age=300"
    assert result.json() == {
        "phrase_sets": [{"code": "hackathon", "name_ja": "ハッカソン会場", "phrase_count": 6}]
    }
    expected = []
    for item in json.loads((CONTENT / "phrases.json").read_text()):
        expected.append(
            {
                **{key: item[key] for key in ("id", "label", "ko", "kana", "ja", "when", "reply")},
                "set_code": "hackathon",
                "reply_kana": item["replyKana"],
                "reply_ja": item["replyJa"],
            }
        )
    for path in ("/api/phrases", "/api/phrases?set_code=hackathon"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "public, max-age=300"
        assert response.json() == {"phrases": expected}


@pytest.mark.parametrize("code", ["nope", ""])
def test_unknown_set(client, seeded, code):
    response = client.get("/api/phrases", params={"set_code": code})
    assert response.status_code == 404
    assert response.json()["code"] == "unknown_phrase_set"


def test_inactive_content(client, db, seeded):
    db.get(Phrase, "q1").is_active = False
    db.flush()
    assert len(client.get("/api/phrases").json()["phrases"]) == 5
    assert client.get("/api/phrase-sets").json()["phrase_sets"][0]["phrase_count"] == 5
    db.get(PhraseSet, "hackathon").is_active = False
    db.flush()
    assert client.get("/api/phrases").json() == {"phrases": []}
    assert client.get("/api/phrase-sets").json() == {"phrase_sets": []}
    assert client.get("/api/phrases?set_code=hackathon").status_code == 404


def test_category_order_and_empty_set(client, db, seeded):
    db.add(PhraseSet(code="first", name_ja="ハッカソン会場", sort_order=-1))
    db.add(PhraseSet(code="empty", name_ja="ハッカソン会場", sort_order=1))
    db.flush()
    db.get(Phrase, "q6").set_code = "first"
    db.flush()
    assert [p["id"] for p in client.get("/api/phrases").json()["phrases"]] == [
        "q6",
        "q1",
        "q2",
        "q3",
        "q4",
        "q5",
    ]
    categories = client.get("/api/phrase-sets").json()["phrase_sets"]
    assert [p["code"] for p in categories] == ["first", "hackathon", "empty"]
    assert categories[-1]["phrase_count"] == 0
