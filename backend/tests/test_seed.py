import json

import pytest
from sqlalchemy import select

from app.models import Phrase, PhraseSet
from scripts.seed import seed
from tests.conftest import CONTENT


def content_at(tmp_path):
    for name in ("phrases.json", "phrase_sets.json"):
        (tmp_path / name).write_text((CONTENT / name).read_text())
    return tmp_path


def snapshot(db):
    return [
        tuple(getattr(p, c.name) for c in Phrase.__table__.columns)
        for p in db.scalars(select(Phrase).order_by(Phrase.id))
    ]


def test_seed_idempotent(db, tmp_path):
    path = content_at(tmp_path)
    assert seed(db, path) == (4, 24)
    first = snapshot(db)
    assert seed(db, path) == (4, 24)
    assert snapshot(db) == first
    codes = ["hackathon", "cafe", "convenience", "transit"]
    for order, code in enumerate(codes):
        category = db.get(PhraseSet, code)
        assert category.is_active and category.sort_order == order
        orders = db.scalars(select(Phrase.sort_order).where(Phrase.set_code == code))
        assert sorted(orders) == list(range(6))


def test_remove_reorder_restore(db, tmp_path):
    path = content_at(tmp_path)
    source = json.loads((path / "phrases.json").read_text())
    seed(db, path)
    (path / "phrases.json").write_text(json.dumps(list(reversed(source[1:]))))
    seed(db, path)
    assert not db.get(Phrase, "q1").is_active
    assert db.get(Phrase, "q6").sort_order == 0
    assert db.get(Phrase, "q2").sort_order == 4
    (path / "phrases.json").write_text(json.dumps(source))
    seed(db, path)
    assert db.get(Phrase, "q1").is_active
    assert db.get(Phrase, "q1").sort_order == 0
    (path / "phrases.json").write_text("[]")
    (path / "phrase_sets.json").write_text("[]")
    seed(db, path)
    assert not db.get(PhraseSet, "hackathon").is_active
    assert all(not p.is_active for p in db.scalars(select(Phrase)))


def test_explicit_set(db, tmp_path):
    path = content_at(tmp_path)
    source = [p for p in json.loads((path / "phrases.json").read_text()) if "set" not in p]
    source[0]["set"] = "other"
    (path / "phrases.json").write_text(json.dumps(source))
    (path / "phrase_sets.json").write_text(
        json.dumps(
            [
                {"code": "hackathon", "name_ja": "ハッカソン会場"},
                {"code": "other", "name_ja": "ハッカソン会場"},
            ]
        )
    )
    seed(db, path)
    assert db.get(Phrase, "q1").set_code == "other"
    assert db.get(Phrase, "q1").sort_order == db.get(Phrase, "q2").sort_order == 0


def test_seed_transaction_rolls_back(db, tmp_path):
    path = content_at(tmp_path)
    seed(db, path)
    first = snapshot(db)
    source = json.loads((path / "phrases.json").read_text())
    del source[-1]["ko"]
    (path / "phrases.json").write_text(json.dumps(source))
    with pytest.raises(KeyError):
        seed(db, path)
    db.rollback()
    assert snapshot(db) == first
