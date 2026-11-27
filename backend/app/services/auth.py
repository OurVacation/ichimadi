from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.core.normalize import normalize_login_id, normalize_password
from app.core.security import DUMMY_HASH, create_access_token, verify_password
from app.models import User
from app.schemas.auth import LoginResponse


def login(db: Session, login_id: str, password: str) -> LoginResponse:
    user = db.scalar(select(User).where(User.login_id == normalize_login_id(login_id)))
    valid = verify_password(
        normalize_password(password), user.password_hash if user else DUMMY_HASH
    )
    if user is None or not valid:
        raise AppError("invalid_credentials", "IDかパスワードが違います", 401)
    return LoginResponse(
        access_token=create_access_token(user.id),
        account_id=user.login_id,
        expires_in=settings.jwt_expire_hours * 3600,
    )
