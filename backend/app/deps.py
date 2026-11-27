from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db import get_db
from app.llm.base import NameGenerator
from app.llm.gemini import GeminiNameGenerator
from app.models import User

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DB, cred: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    user_id = decode_access_token(cred.credentials) if cred else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_name_generator() -> NameGenerator:
    return GeminiNameGenerator(settings)
