from contextlib import nullcontext
from unittest.mock import patch

import pytest

from app.core.security import verify_password
from app.models import NameSuggestion, Stamp, StampProfile
from scripts.reset import main, reset_accounts


def test_reset_isolation(db, seeded, make_user):
    a, b = make_user("a"), make_user("b")
    for user in (a, b):
        db.add(Stamp(user_id=user.id, phrase_id="q1"))
        db.add(StampProfile(user_id=user.id, animal="tiger", korean_name="양자"))
    db.flush()
    accounts = reset_accounts(db, [a], new_passwords=True)
    assert len(accounts) == 1
    assert verify_password(accounts[0]["password"], a.password_hash)
    assert not verify_password("4821", a.password_hash)
    db.expire_all()
    assert db.get(Stamp, (a.id, "q1")) is None
    assert db.get(StampProfile, a.id) is None
    assert db.get(Stamp, (b.id, "q1")) is not None
    assert db.get(StampProfile, b.id) is not None
    assert verify_password("4821", b.password_hash)


def test_reset_without_new_password(db, seeded, make_user):
    user = make_user()
    assert reset_accounts(db, [user]) == []
    assert verify_password("4821", user.password_hash)


def test_reset_names(db):
    db.add(NameSuggestion(input_key="test", candidates=[], model="fake"))
    db.flush()
    with (
        patch("scripts.reset.SessionLocal", return_value=nullcontext(db)),
        patch("sys.argv", ["reset", "--names", "--yes"]),
    ):
        main()
    assert db.get(NameSuggestion, "test") is None


@pytest.mark.parametrize("ids", ["", " ", ",", "judge01,"])
def test_reset_rejects_empty_ids(ids):
    with (
        patch("sys.argv", ["reset", "--login-ids", ids, "--yes"]),
        patch("scripts.reset.SessionLocal") as factory,
        pytest.raises(SystemExit) as exc,
    ):
        main()
    assert exc.value.code == 2
    factory.assert_not_called()


@pytest.mark.parametrize("arguments", [["--role", "team"], ["--login-ids", " ＴＥＡＭ０１ "]])
def test_reset_cli_target(db, make_user, arguments):
    judge = make_user("judge01", role="judge")
    team = make_user("team01", role="team")
    for user in (judge, team):
        db.add(StampProfile(user_id=user.id, animal="bear"))
    db.flush()
    with (
        patch("scripts.reset.SessionLocal", return_value=nullcontext(db)),
        patch("sys.argv", ["reset", *arguments, "--yes"]),
    ):
        main()
    db.expire_all()
    assert db.get(StampProfile, judge.id) is not None
    assert db.get(StampProfile, team.id) is None


def test_reset_cancel_preserves_data(db, make_user):
    user = make_user()
    db.add(StampProfile(user_id=user.id, animal="bear"))
    db.flush()
    with (
        patch("scripts.reset.SessionLocal", return_value=nullcontext(db)),
        patch("sys.argv", ["reset", "--login-ids", "judge01"]),
        patch("builtins.input", return_value="no"),
    ):
        main()
    assert db.get(StampProfile, user.id) is not None
