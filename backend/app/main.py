"""FastAPI application: startup checks, middleware and safe error responses."""

import logging
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import evolution, lessons, memory, system
from app.core.config import get_settings
from app.core.errors import (
    AppError,
    ConfigurationError,
    DuplicateRunError,
    InjectionNotAllowedError,
    InjectionNotApplicableError,
    ProposalNotFoundError,
    ProposalStateError,
    RubricViolationError,
    RunNotFoundError,
)
from app.core.logging import configure_logging
from app.db.migrate import run_migrations
from app.services import run_repository as repo

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"

_STATUS_BY_ERROR: dict[type[AppError], int] = {
    RunNotFoundError: status.HTTP_404_NOT_FOUND,
    ProposalNotFoundError: status.HTTP_404_NOT_FOUND,
    DuplicateRunError: status.HTTP_409_CONFLICT,
    ProposalStateError: status.HTTP_409_CONFLICT,
    RubricViolationError: status.HTTP_409_CONFLICT,
    InjectionNotAllowedError: status.HTTP_403_FORBIDDEN,
    InjectionNotApplicableError: status.HTTP_422_UNPROCESSABLE_CONTENT,
    ConfigurationError: status.HTTP_503_SERVICE_UNAVAILABLE,
}


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    settings.validate_runtime()
    run_migrations()
    repo.seed_defaults()
    interrupted = repo.mark_interrupted_runs()
    logger.info(
        "application_started",
        extra={
            "environment": settings.app_env,
            "provider": settings.llm_provider,
            "interrupted_runs_closed": interrupted,
        },
    )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Self-Evaluating Lesson Generator",
        version="1.0.0",
        description="Generates lessons, evaluates them against a strict rubric, and regenerates from feedback.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            # The stack trace goes to the logs only; the client gets a reference ID.
            logger.exception(
                "unhandled_error",
                extra={"request_id": request_id, "path": request.url.path, "method": request.method},
            )
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error.", "request_id": request_id},
            )
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, error: AppError) -> JSONResponse:
        code = next(
            (value for kind, value in _STATUS_BY_ERROR.items() if isinstance(error, kind)),
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        return JSONResponse(status_code=code, content={"detail": str(error)})

    for module in (lessons, memory, evolution, system):
        app.include_router(module.router, prefix=API_PREFIX)
    return app


app = create_app()
