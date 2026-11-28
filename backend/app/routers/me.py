from fastapi import APIRouter

from app.deps import DB, CurrentUser
from app.schemas.error import ErrorResponse
from app.schemas.me import MeResponse, ProfileRequest
from app.schemas.summary import SummaryResponse
from app.services import profile, summary

router = APIRouter(prefix="/me", tags=["me"], responses={401: {"model": ErrorResponse}})


@router.get("", response_model=MeResponse, summary="내 정보")
def me(db: DB, user: CurrentUser) -> MeResponse:
    return profile.get_profile(db, user)


@router.put("/profile", response_model=MeResponse, summary="도장 프로필 저장")
def save_profile(data: ProfileRequest, db: DB, user: CurrentUser) -> MeResponse:
    return profile.save_profile(db, user, data)


@router.get(
    "/summary",
    response_model=SummaryResponse,
    summary="마이페이지 (도장 모양, 카테고리별 진행도와 받은 도장)",
)
def get_summary(db: DB, user: CurrentUser) -> SummaryResponse:
    return summary.get_summary(db, user)
