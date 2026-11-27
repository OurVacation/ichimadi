from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

HTTP_ERRORS = {
    401: ("unauthorized", "ログインが必要です。"),
    403: ("forbidden", "この操作はできません。"),
    404: ("not_found", "見つかりませんでした。"),
    405: ("method_not_allowed", "この操作はできません。"),
}


class AppError(Exception):
    def __init__(self, code: str, message_ja: str, status: int = 400) -> None:
        super().__init__(code)
        self.code = code
        self.message_ja = message_ja
        self.status = status


def _response(
    code: str, message_ja: str, status: int, headers: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(
        {"code": code, "message_ja": message_ja}, status_code=status, headers=headers
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return _response(exc.code, exc.message_ja, exc.status)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
        return _response("validation_error", "入力内容を確認してください。", 422)

    @app.exception_handler(HTTPException)
    async def handle_http_error(_: Request, exc: HTTPException) -> JSONResponse:
        code, message_ja = HTTP_ERRORS.get(
            exc.status_code, ("http_error", "リクエストを処理できませんでした。")
        )
        return _response(code, message_ja, exc.status_code, exc.headers)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, __: Exception) -> JSONResponse:
        return _response("internal_error", "エラーが発生しました。もう一度お試しください。", 500)
