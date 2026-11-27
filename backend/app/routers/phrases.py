from fastapi import APIRouter, Response

from app.deps import DB
from app.schemas.error import ErrorResponse
from app.schemas.phrases import PhraseSetsResponse, PhrasesResponse
from app.services import phrases

router = APIRouter(tags=["phrases"])


@router.get("/phrase-sets", response_model=PhraseSetsResponse, summary="한마디 카테고리 목록")
def get_phrase_sets(db: DB, response: Response) -> PhraseSetsResponse:
    response.headers["Cache-Control"] = "public, max-age=300"
    return phrases.get_phrase_sets(db)


@router.get(
    "/phrases",
    response_model=PhrasesResponse,
    summary="한마디 목록",
    responses={404: {"model": ErrorResponse}},
)
def get_phrases(db: DB, response: Response, set_code: str | None = None) -> PhrasesResponse:
    response.headers["Cache-Control"] = "public, max-age=300"
    return phrases.get_phrases(db, set_code)
