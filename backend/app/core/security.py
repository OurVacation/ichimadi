from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), password_hash.encode())
    except ValueError:
        return False


DUMMY_HASH = hash_password("dummy-password")


def create_access_token(user_id: int) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": str(user_id), "iat": now, "exp": now + timedelta(hours=settings.jwt_expire_hours)},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> int | None:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "iat", "exp"]},
        )
        user_id = int(claims["sub"])
        return user_id if 0 < user_id <= 9223372036854775807 else None
    except (jwt.InvalidTokenError, ValueError, TypeError):
        return None
