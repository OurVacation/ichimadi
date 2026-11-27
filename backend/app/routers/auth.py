from fastapi import APIRouter

from app.deps import DB
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.error import ErrorResponse
from app.services import auth

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="로그인",
    responses={401: {"model": ErrorResponse}},
)
def login(data: LoginRequest, db: DB) -> LoginResponse:
    return auth.login(db, data.login_id, data.password)
