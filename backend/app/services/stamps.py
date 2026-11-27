from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Phrase, PhraseSet, Stamp
from app.schemas.stamps import SetProgress, StampItem, StampsResponse


def get_stamps(db: Session, user_id: int) -> StampsResponse:
    rows = db.execute(
        select(Stamp.phrase_id, Phrase.set_code, Stamp.stamped_at)
        .join(Phrase, Phrase.id == Stamp.phrase_id)
        .join(PhraseSet, PhraseSet.code == Phrase.set_code)
        .where(Stamp.user_id == user_id, Phrase.is_active, PhraseSet.is_active)
        .order_by(Stamp.stamped_at, Phrase.sort_order, Phrase.id)
    )
    stamps = [StampItem(**row._mapping) for row in rows]
    rows = db.execute(
        select(PhraseSet.code, func.count(Phrase.id).label("total"))
        .outerjoin(Phrase, (Phrase.set_code == PhraseSet.code) & Phrase.is_active)
        .where(PhraseSet.is_active)
        .group_by(PhraseSet.code)
        .order_by(PhraseSet.sort_order, PhraseSet.code)
    )
    counts: dict[str, int] = {}
    for stamp in stamps:
        counts[stamp.set_code] = counts.get(stamp.set_code, 0) + 1
    return StampsResponse(
        stamps=stamps,
        progress=[
            SetProgress(
                set_code=code,
                total=total,
                count=counts.get(code, 0),
                completed=total > 0 and counts.get(code, 0) == total,
            )
            for code, total in rows
        ],
    )


def add_stamp(db: Session, user_id: int, phrase_id: str) -> StampsResponse:
    phrase = db.scalar(
        select(Phrase)
        .join(PhraseSet)
        .where(Phrase.id == phrase_id, Phrase.is_active, PhraseSet.is_active)
    )
    if phrase is None:
        raise AppError("unknown_phrase", "この一言は見つかりませんでした", 404)
    db.execute(
        insert(Stamp)
        .values(user_id=user_id, phrase_id=phrase_id)
        .on_conflict_do_nothing(index_elements=[Stamp.user_id, Stamp.phrase_id])
    )
    db.commit()
    return get_stamps(db, user_id)
