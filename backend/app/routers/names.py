from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import DB, CurrentUser, get_name_generator
from app.llm.base import NameGenerator
from app.schemas.error import ErrorResponse
from app.schemas.names import NameSuggestRequest, NameSuggestResponse
from app.services import names

router = APIRouter(prefix="/names", tags=["names"], responses={401: {"model": ErrorResponse}})


@router.post(
    "/suggest",
    response_model=NameSuggestResponse,
    summary="한국식 이름 후보",
    responses={503: {"model": ErrorResponse}},
)
def suggest(
    data: NameSuggestRequest,
    db: DB,
    user: CurrentUser,
    generator: Annotated[NameGenerator, Depends(get_name_generator)],
) -> NameSuggestResponse:
    return NameSuggestResponse(candidates=names.suggest(db, generator, data.ja_name))
