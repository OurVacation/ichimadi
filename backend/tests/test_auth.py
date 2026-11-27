import jwt
import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.core.config import Settings, settings
from app.core.security import decode_access_token, verify_password
from app.models import User, UserRole
from scripts.create_accounts import create_accounts, write_accounts


@pytest.mark.parametrize("login_id", ["j01", "ｊ０１", " J01 "])
def test_login(client, make_user, login_id):
    user = make_user(login_id="j01")
    result = client.post("/api/auth/login", json={"login_id": login_id, "password": " ４８２１ "})
    assert result.status_code == 200
    body = result.json()
    assert body["account_id"] == "j01"
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 259200
    assert decode_access_token(body["access_token"]) == user.id
    claims = jwt.decode(body["access_token"], settings.jwt_secret, algorithms=["HS256"])
    assert claims["sub"] == str(user.id)


def test_bad_credentials(client, make_user):
    make_user()
    wrong = client.post("/api/auth/login", json={"login_id": "judge01", "password": "wrong"})
    missing = client.post("/api/auth/login", json={"login_id": "missing", "password": "4821"})
    assert wrong.status_code == missing.status_code == 401
    assert (
        wrong.json()
        == missing.json()
        == {"code": "invalid_credentials", "message_ja": "IDかパスワードが違います"}
    )


@pytest.mark.parametrize("password", ["x" * 128, "가" * 128])
def test_long_password_is_bad_credentials(client, make_user, password):
    make_user()
    result = client.post("/api/auth/login", json={"login_id": "judge01", "password": password})
    assert result.status_code == 401


def test_create_accounts(db, tmp_path):
    accounts = create_accounts(db, " Ｊ ", 3, UserRole.judge)
    assert [a["login_id"] for a in accounts] == ["j01", "j02", "j03"]
    assert all(len(a["password"]) == 4 and a["password"].isdigit() for a in accounts)
    assert create_accounts(db, "j", 3, UserRole.judge) == []
    assert db.scalar(select(func.count()).select_from(User)) == 3
    for account in accounts:
        user = db.scalar(select(User).where(User.login_id == account["login_id"]))
        assert verify_password(account["password"], user.password_hash)
    path = tmp_path / "judges.accounts.csv"
    write_accounts(path, accounts)
    assert path.read_text().splitlines()[0] == "login_id,password,role"
    assert path.stat().st_mode & 0o777 == 0o600
    with pytest.raises(FileExistsError):
        write_accounts(path, [])


def test_production_secret():
    with pytest.raises(ValidationError):
        Settings(app_env="prod", jwt_secret="dev-secret-change-me")
    assert Settings(app_env="prod", jwt_secret="custom-production-secret").app_env == "prod"
