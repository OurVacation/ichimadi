import json
import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://ichimadi:ichimadi@db:5432/ichimadi_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["APP_ENV"] = "test"

from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from alembic import command  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Phrase, PhraseSet, User, UserRole  # noqa: E402

CONTENT = Path(__file__).resolve().parents[2] / "content"


@pytest.fixture(scope="session")
def database():
    url = make_url(TEST_DATABASE_URL)
    # Only create a dedicated test database, never mutate the application database.
    if not url.database or not url.database.endswith("_test"):
        raise ValueError("TEST_DATABASE_URL database name must end with _test")
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        if not connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
        ):
            connection.exec_driver_sql(
                "CREATE DATABASE " + admin.dialect.identifier_preparer.quote(url.database)
            )
    admin.dispose()
    command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
    yield
    engine.dispose()


@pytest.fixture
def db(database):
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        ) as session:
            yield session
        transaction.rollback()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


def hackathon_phrases():
    items = json.loads((CONTENT / "phrases.json").read_text())
    return [item for item in items if item.get("set", "hackathon") == "hackathon"]


@pytest.fixture
def seeded(db):
    db.add(PhraseSet(code="hackathon", name_ja="ハッカソン会場", sort_order=0))
    db.flush()
    for order, item in enumerate(hackathon_phrases()):
        db.add(
            Phrase(
                id=item["id"],
                set_code="hackathon",
                sort_order=order,
                label=item["label"],
                ko=item["ko"],
                kana=item["kana"],
                ja_meaning=item["ja"],
                usage_ja=item["when"],
                reply_ko=item["reply"],
                reply_kana=item["replyKana"],
                reply_ja=item["replyJa"],
            )
        )
    db.flush()


@pytest.fixture
def make_user(db):
    def make(login_id="judge01", password="4821", role="judge"):
        user = User(login_id=login_id, password_hash=hash_password(password), role=UserRole(role))
        db.add(user)
        db.flush()
        return user

    return make


@pytest.fixture
def auth_header():
    return lambda user: {"Authorization": "Bearer " + create_access_token(user.id)}
