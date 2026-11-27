import json
from collections import defaultdict
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import SessionLocal
from app.models import Phrase, PhraseSet


def seed(db: Session, content_dir: Path) -> tuple[int, int]:
    sets = json.loads((content_dir / "phrase_sets.json").read_text("utf-8"))
    phrases = json.loads((content_dir / "phrases.json").read_text("utf-8"))
    db.execute(update(PhraseSet).values(is_active=False))
    for order, item in enumerate(sets):
        values = dict(code=item["code"], name_ja=item["name_ja"], sort_order=order, is_active=True)
        db.execute(
            insert(PhraseSet)
            .values(**values)
            .on_conflict_do_update(index_elements=[PhraseSet.code], set_=values)
        )
    # Retained inactive phrases must not occupy positions reused by the new content.
    # Deferred uniqueness also permits swapping the order of existing active phrases.
    existing = db.scalars(select(Phrase).order_by(Phrase.id)).all()
    for index, phrase in enumerate(existing, 1):
        phrase.sort_order = -index
        phrase.is_active = False
    db.flush()
    orders: dict[str, int] = defaultdict(int)
    fields = {
        "label": "label",
        "ko": "ko",
        "kana": "kana",
        "ja": "ja_meaning",
        "when": "usage_ja",
        "reply": "reply_ko",
        "replyKana": "reply_kana",
        "replyJa": "reply_ja",
    }
    for item in phrases:
        code = item.get("set", "hackathon")
        values = {target: item[source] for source, target in fields.items()}
        values.update(id=item["id"], set_code=code, sort_order=orders[code], is_active=True)
        orders[code] += 1
        db.execute(
            insert(Phrase)
            .values(**values)
            .on_conflict_do_update(index_elements=[Phrase.id], set_=values)
        )
    db.commit()
    db.expire_all()
    return len(sets), len(phrases)


def main() -> None:
    with SessionLocal() as db:
        sets, phrases = seed(db, settings.content_dir)
    print(f"seeded {sets} sets, {phrases} phrases")


if __name__ == "__main__":
    main()
