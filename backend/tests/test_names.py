import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from app.core.config import Settings
from app.deps import get_name_generator
from app.llm.base import Candidate, NameGeneratorError
from app.llm.gemini import GeminiNameGenerator
from app.main import app
from app.models import NameSuggestion

CANDIDATES = [
    Candidate(name=name, note=note)
    for name, note in [
        ("전양자", "「田」と「陽子」の韓国語読み"),
        ("전요코", "「田」を韓国の姓に、名前は音のまま"),
        ("전서연", "「陽子」の明るい印象に近い韓国の名前"),
    ]
]


class FakeGenerator:
    model = "fake-flash"

    def __init__(self, result=None, fail=False):
        self.result = CANDIDATES if result is None else result
        self.fail = fail
        self.calls = []

    def generate(self, full_name):
        self.calls.append(full_name)
        if self.fail:
            raise NameGeneratorError()
        return self.result


@pytest.fixture
def generator(client):
    generator = FakeGenerator()
    app.dependency_overrides[get_name_generator] = lambda: generator
    return generator


def test_requires_auth(client):
    assert client.post("/api/names/suggest", json={"ja_name": "田中 陽子"}).status_code == 401


def test_names_and_cache(client, db, generator, make_user, auth_header):
    headers = auth_header(make_user())
    results = [
        client.post("/api/names/suggest", headers=headers, json={"ja_name": name})
        for name in (" 田中　陽子 ", "田中 陽子")
    ]
    assert all(r.status_code == 200 for r in results)
    assert (
        results[0].json()
        == results[1].json()
        == {"candidates": [c.model_dump() for c in CANDIDATES]}
    )
    assert generator.calls == ["田中 陽子"]
    cached = db.get(NameSuggestion, "田中 陽子")
    assert cached.model == "fake-flash"
    assert cached.candidates == results[0].json()["candidates"]
    assert (
        client.post("/api/names/suggest", headers=headers, json={"ja_name": "陽子"}).status_code
        == 200
    )
    assert generator.calls == ["田中 陽子", "陽子"]


@pytest.mark.parametrize("name", ["", " 　", "あ" * 31])
def test_invalid_name(client, db, generator, make_user, auth_header, name):
    response = client.post(
        "/api/names/suggest", headers=auth_header(make_user()), json={"ja_name": name}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_ja_name"
    assert generator.calls == []
    assert db.scalar(select(func.count()).select_from(NameSuggestion)) == 0


@pytest.mark.parametrize(
    "kind",
    ["failure", "two", "english", "duplicate", "long", "empty-note", "long-note", "bad-shape"],
)
def test_invalid_output(client, db, generator, make_user, auth_header, kind):
    generator.result = [c.model_copy() for c in CANDIDATES]
    if kind == "failure":
        generator.fail = True
    elif kind == "two":
        generator.result.pop()
    elif kind == "bad-shape":
        generator.result = [{"name": "전양자"}]
    else:
        changes = {
            "english": {"name": "Yoko"},
            "duplicate": {"name": CANDIDATES[1].name},
            "long": {"name": "가" * 11},
            "empty-note": {"note": "  "},
            "long-note": {"note": "あ" * 41},
        }
        generator.result[0] = generator.result[0].model_copy(update=changes[kind])
    response = client.post(
        "/api/names/suggest", headers=auth_header(make_user()), json={"ja_name": "田中 陽子"}
    )
    assert response.status_code == 503
    assert response.json()["code"] == "name_suggest_unavailable"
    assert db.scalar(select(func.count()).select_from(NameSuggestion)) == 0


def test_candidate_whitespace(client, generator, make_user, auth_header):
    generator.result = [
        c.model_copy(update={"name": f" {c.name} ", "note": f" {c.note} "}) for c in CANDIDATES
    ]
    response = client.post(
        "/api/names/suggest", headers=auth_header(make_user()), json={"ja_name": "田中 陽子"}
    )
    assert response.status_code == 200
    assert response.json() == {"candidates": [c.model_dump() for c in CANDIDATES]}


def test_no_key_no_network():
    with patch("app.llm.gemini.genai.Client") as client:
        with pytest.raises(NameGeneratorError):
            GeminiNameGenerator(Settings(gemini_api_key="")).generate("田中 陽子")
        client.assert_not_called()


def test_no_key_endpoint(client, make_user, auth_header):
    app.dependency_overrides[get_name_generator] = lambda: GeminiNameGenerator(
        Settings(gemini_api_key="")
    )
    response = client.post(
        "/api/names/suggest", headers=auth_header(make_user()), json={"ja_name": "田中 陽子"}
    )
    assert response.status_code == 503
    assert response.json()["code"] == "name_suggest_unavailable"


def test_sdk_configuration():
    with patch("app.llm.gemini.genai.Client") as factory:
        client = factory.return_value.__enter__.return_value
        client.models.generate_content.return_value = SimpleNamespace(
            text=json.dumps([c.model_dump() for c in CANDIDATES])
        )
        generator = GeminiNameGenerator(
            Settings(gemini_api_key="fake", name_suggest_timeout_seconds=2.5)
        )
        assert generator.generate("田中 陽子") == CANDIDATES
        options = factory.call_args.kwargs["http_options"]
        assert options.timeout == 2500
        assert options.retry_options.attempts == 1
        arguments = client.models.generate_content.call_args.kwargs
        assert arguments["contents"] == "田中 陽子"
        assert arguments["config"].response_schema == list[Candidate]
        assert arguments["config"].response_mime_type == "application/json"


@pytest.mark.parametrize(
    "failure", [TimeoutError("private-name"), RuntimeError("private-response")]
)
def test_sdk_failure_is_private(failure):
    with (
        patch("app.llm.gemini.genai.Client") as factory,
        patch("app.llm.gemini.logger") as logger,
    ):
        factory.return_value.__enter__.return_value.models.generate_content.side_effect = failure
        with pytest.raises(NameGeneratorError):
            GeminiNameGenerator(Settings(gemini_api_key="fake")).generate("private-input")
    logger.warning.assert_called_once_with("name generation failed: %s", type(failure).__name__)
