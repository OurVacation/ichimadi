from fastapi import APIRouter

from app.deps import DB, CurrentUser
from app.schemas.error import ErrorResponse
from app.schemas.me import MeResponse, ProfileRequest
from app.services import profile

router = APIRouter(prefix="/me", tags=["me"], responses={401: {"model": ErrorResponse}})


@router.get("", response_model=MeResponse, summary="내 정보")
def me(db: DB, user: CurrentUser) -> MeResponse:
    return profile.get_profile(db, user)


@router.put("/profile", response_model=MeResponse, summary="도장 프로필 저장")
def save_profile(data: ProfileRequest, db: DB, user: CurrentUser) -> MeResponse:
    return profile.save_profile(db, user, data)
