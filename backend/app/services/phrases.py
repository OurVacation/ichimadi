from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Phrase, PhraseSet
from app.schemas.phrases import PhraseItem, PhraseSetItem, PhraseSetsResponse, PhrasesResponse


def get_phrase_sets(db: Session) -> PhraseSetsResponse:
    rows = db.execute(
        select(PhraseSet.code, PhraseSet.name_ja, func.count(Phrase.id).label("phrase_count"))
        .outerjoin(Phrase, (Phrase.set_code == PhraseSet.code) & Phrase.is_active)
        .where(PhraseSet.is_active)
        .group_by(PhraseSet.code)
        .order_by(PhraseSet.sort_order, PhraseSet.code)
    )
    return PhraseSetsResponse(phrase_sets=[PhraseSetItem(**row._mapping) for row in rows])


def get_phrases(db: Session, set_code: str | None) -> PhrasesResponse:
    if set_code is not None:
        category = db.get(PhraseSet, set_code)
        if category is None or not category.is_active:
            raise AppError("unknown_phrase_set", "このカテゴリは見つかりませんでした", 404)
    query = select(Phrase).join(PhraseSet).where(Phrase.is_active, PhraseSet.is_active)
    if set_code is not None:
        query = query.where(Phrase.set_code == set_code)
    phrases = db.scalars(query.order_by(PhraseSet.sort_order, PhraseSet.code, Phrase.sort_order))
    return PhrasesResponse(
        phrases=[
            PhraseItem(
                id=p.id,
                set_code=p.set_code,
                label=p.label,
                ko=p.ko,
                kana=p.kana,
                ja=p.ja_meaning,
                when=p.usage_ja,
                reply=p.reply_ko,
                reply_kana=p.reply_kana,
                reply_ja=p.reply_ja,
            )
            for p in phrases
        ]
    )
