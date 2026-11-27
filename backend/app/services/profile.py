import re

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Animal, StampProfile, User
from app.schemas.me import MeResponse, ProfileRequest


def get_profile(db: Session, user: User) -> MeResponse:
    profile = db.get(StampProfile, user.id)
    return MeResponse(
        account_id=user.login_id,
        animal=profile.animal if profile else None,
        korean_name=profile.korean_name if profile else None,
    )


def save_profile(db: Session, user: User, data: ProfileRequest) -> MeResponse:
    name = data.korean_name.strip() if data.korean_name is not None else None
    if (data.animal is not None and data.animal not in Animal) or (
        name not in (None, "") and re.fullmatch(r"[가-힣]{1,10}", name) is None
    ):
        raise AppError("invalid_profile", "動物か名前を確認してください", 422)
    statement = insert(StampProfile).values(user_id=user.id, animal=data.animal, korean_name=name)
    db.execute(
        statement.on_conflict_do_update(
            index_elements=[StampProfile.user_id],
            set_={"animal": data.animal, "korean_name": name, "updated_at": func.now()},
        )
    )
    db.commit()
    db.expire_all()
    return get_profile(db, user)
