from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Phrase, PhraseSet, Stamp, User
from app.schemas.summary import SummaryResponse, SummarySet, SummaryStamp
from app.services.profile import get_profile


def get_summary(db: Session, user: User) -> SummaryResponse:
    """마이페이지 한 화면분: 도장 모양, 카테고리별 진행도와 받은 도장 (활성 콘텐츠만)."""
    profile = get_profile(db, user)
    categories = db.execute(
        select(PhraseSet.code, PhraseSet.name_ja, func.count(Phrase.id).label("total"))
        .outerjoin(Phrase, (Phrase.set_code == PhraseSet.code) & Phrase.is_active)
        .where(PhraseSet.is_active)
        .group_by(PhraseSet.code)
        .order_by(PhraseSet.sort_order, PhraseSet.code)
    ).all()
    rows = db.execute(
        select(Phrase.set_code, Phrase.id, Phrase.label, Phrase.ko, Stamp.stamped_at)
        .join(Phrase, Phrase.id == Stamp.phrase_id)
        .join(PhraseSet, PhraseSet.code == Phrase.set_code)
        .where(Stamp.user_id == user.id, Phrase.is_active, PhraseSet.is_active)
        .order_by(Stamp.stamped_at, Phrase.sort_order, Phrase.id)
    )
    stamps: dict[str, list[SummaryStamp]] = {}
    for set_code, phrase_id, label, ko, stamped_at in rows:
        stamps.setdefault(set_code, []).append(
            SummaryStamp(phrase_id=phrase_id, label=label, ko=ko, stamped_at=stamped_at)
        )
    sets = [
        SummarySet(
            code=code,
            name_ja=name_ja,
            count=len(stamps.get(code, [])),
            total=total,
            completed=total > 0 and len(stamps.get(code, [])) == total,
            stamps=stamps.get(code, []),
        )
        for code, name_ja, total in categories
    ]
    return SummaryResponse(
        **profile.model_dump(),
        stamp_count=sum(s.count for s in sets),
        phrase_count=sum(s.total for s in sets),
        sets=sets,
    )
