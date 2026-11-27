from fastapi import APIRouter

from app.deps import DB, CurrentUser
from app.schemas.error import ErrorResponse
from app.schemas.stamps import AddStampRequest, StampsResponse
from app.services import stamps

router = APIRouter(prefix="/me/stamps", tags=["stamps"], responses={401: {"model": ErrorResponse}})


@router.get("", response_model=StampsResponse, summary="내 도장과 카테고리별 진행도")
def get_stamps(db: DB, user: CurrentUser) -> StampsResponse:
    return stamps.get_stamps(db, user.id)


@router.post(
    "",
    response_model=StampsResponse,
    summary="도장 받기",
    responses={404: {"model": ErrorResponse}},
)
def add_stamp(data: AddStampRequest, db: DB, user: CurrentUser) -> StampsResponse:
    return stamps.add_stamp(db, user.id, data.phrase_id)
