from pydantic import BaseModel, ConfigDict


class PhraseSetItem(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"code": "hackathon", "name_ja": "ハッカソン会場", "phrase_count": 6}]
        }
    )
    code: str
    name_ja: str
    phrase_count: int


class PhraseSetsResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "phrase_sets": [
                        {"code": "hackathon", "name_ja": "ハッカソン会場", "phrase_count": 6}
                    ]
                }
            ]
        }
    )
    phrase_sets: list[PhraseSetItem]


class PhraseItem(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "q1",
                    "set_code": "hackathon",
                    "label": "はじめまして",
                    "ko": "어떤 앱인가요?",
                    "kana": "オットン エビンガヨ?",
                    "ja": "どんなアプリですか？",
                    "when": "他のチームのブースに初めて行ったとき",
                    "reply": "일본인을 위한 ○○ 앱이에요",
                    "reply_kana": "イルボニヌル ウィハン ○○ エビエヨ",
                    "reply_ja": "日本人のための○○アプリです",
                }
            ]
        }
    )
    id: str
    set_code: str
    label: str
    ko: str
    kana: str
    ja: str
    when: str
    reply: str
    reply_kana: str
    reply_ja: str


class PhrasesResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"phrases": PhraseItem.model_config["json_schema_extra"]["examples"]}]
        }
    )
    phrases: list[PhraseItem]
