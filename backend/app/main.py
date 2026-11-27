from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.routers import auth, health, me, stamps
from app.schemas.error import ErrorResponse

app = FastAPI(
    title=settings.app_name,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    # 기본 422 스키마({"detail": ...}) 대신 실제 에러 형식을 계약에 남긴다.
    responses={422: {"model": ErrorResponse}},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

api_router = APIRouter(prefix="/api")
for router in (health.router, auth.router, me.router, stamps.router):
    api_router.include_router(router)
app.include_router(api_router)
