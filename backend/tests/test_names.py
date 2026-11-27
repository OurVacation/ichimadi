import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from google.genai import _api_client, _transformers, types
from sqlalchemy import func, select

from app.core.config import Settings
from app.deps import get_name_generator
from app.llm.base import Candidate, NameGeneratorError
from app.llm.gemini import RESPONSE_SCHEMA, GeminiNameGenerator
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
        generator = GeminiNameGenerator(Settings(gemini_api_key="fake"))
        assert generator.generate("田中 陽子") == CANDIDATES
        options = factory.call_args.kwargs["http_options"]
        assert options.timeout == 10_000
        assert options.retry_options.attempts == 1
        arguments = client.models.generate_content.call_args.kwargs
        assert arguments["contents"] == "田中 陽子"
        assert arguments["config"].response_schema == RESPONSE_SCHEMA
        assert arguments["config"].response_mime_type == "application/json"
        assert arguments["config"].thinking_config.thinking_level == types.ThinkingLevel.LOW


def test_timeout_is_at_least_api_minimum():
    # Gemini API 는 10초 미만의 마감 시간을 400 으로 거부한다
    assert GeminiNameGenerator(Settings(name_suggest_timeout_seconds=2.5)).timeout_ms == 10_000
    assert GeminiNameGenerator(Settings(name_suggest_timeout_seconds=15)).timeout_ms == 15_000


@pytest.mark.parametrize(
    ("level", "expected"),
    [("minimal", types.ThinkingLevel.MINIMAL), ("low", types.ThinkingLevel.LOW), ("", None)],
)
def test_thinking_level(level, expected):
    config = GeminiNameGenerator(Settings(gemini_thinking_level=level)).generation_config()
    assert (config.thinking_config.thinking_level if config.thinking_config else None) == expected


def test_response_schema_converts_with_sdk():
    # 실제 SDK 변환 함수로 확인한다 (네트워크 없음).
    # 예시(examples) 같은 추가 키가 섞이면 여기서 실패한다.
    schema = _transformers.t_schema(None, RESPONSE_SCHEMA)
    assert schema.type == types.Type.ARRAY
    assert set(schema.items.properties) == {"name", "note"}
    assert schema.items.description is None


def test_request_reaches_http_layer():
    # 요청 직전(HTTP 전송)까지 실제 SDK 코드를 그대로 통과하는지 확인한다. 전송은 가로채서 막는다.
    captured = {}

    class Sent(Exception):
        pass

    def fake_request(self, http_method, path, request_dict, http_options=None):
        captured.update(path=path, body=request_dict, timeout=self._http_options.timeout)
        raise Sent

    with patch.object(_api_client.BaseApiClient, "request", fake_request):
        generator = GeminiNameGenerator(
            Settings(
                gemini_api_key="fake", gemini_model="test-model", gemini_thinking_level="minimal"
            )
        )
        with pytest.raises(NameGeneratorError) as raised:
            generator.generate("田中 陽子")
    assert isinstance(raised.value.__cause__, Sent)
    assert captured["path"] == "models/test-model:generateContent"
    assert captured["timeout"] == 10_000
    config = captured["body"]["generationConfig"]
    thinking = config["thinkingConfig"]  # 이 단계의 키 표기는 SDK 버전에 따라 다르다
    assert thinking.get("thinkingLevel", thinking.get("thinking_level")) == "MINIMAL"
    assert "examples" not in json.dumps(config["responseSchema"])


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
