"""Lesson generation and run history. Handlers are sync, so FastAPI runs them in a threadpool."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_run_service
from app.core.rate_limit import enforce_rate_limit
from app.schemas.api import (
    EvaluationOut,
    FeedbackOut,
    FeedbackRequest,
    GenerateLessonRequest,
    GenerateLessonResponse,
    HistoryResponse,
    RejectionOut,
    RunDetail,
    VersionOut,
)
from app.services import run_repository as repo
from app.services.run_service import RunService

router = APIRouter(prefix="/lessons", tags=["lessons"])


@router.post(
    "/generate",
    response_model=GenerateLessonResponse,
    dependencies=[Depends(enforce_rate_limit)],
    summary="Generate and evaluate a lesson, waiting for the final result",
)
def generate_lesson(
    request: GenerateLessonRequest, service: RunService = Depends(get_run_service)
) -> dict:
    return service.run(service.prepare(request))


@router.post(
    "/generate/stream",
    dependencies=[Depends(enforce_rate_limit)],
    summary="Generate and evaluate a lesson, streaming progress as Server-Sent Events",
    response_class=StreamingResponse,
)
def generate_lesson_stream(
    request: GenerateLessonRequest, service: RunService = Depends(get_run_service)
) -> StreamingResponse:
    # prepare() runs here so that bad requests get a proper status code before streaming starts.
    state = service.prepare(request)
    return StreamingResponse(
        service.stream(state),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# Declared before /{run_id} so that "history" isn't parsed as a run ID.
@router.get("/history", response_model=HistoryResponse, summary="List previous runs")
def history(
    limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0)
) -> dict:
    return repo.list_history(limit, offset)


@router.get("/{run_id}", response_model=RunDetail, summary="Get one run")
def get_run(run_id: UUID) -> dict:
    return repo.get_run_detail(str(run_id))


@router.get("/{run_id}/evaluations", response_model=list[EvaluationOut], summary="Get every evaluation in a run")
def get_evaluations(run_id: UUID) -> list[dict]:
    return repo.list_evaluations(str(run_id))


@router.get("/{run_id}/rejections", response_model=list[RejectionOut], summary="Get a run's rejection log")
def get_rejections(run_id: UUID) -> list[dict]:
    return repo.list_rejections(str(run_id))


@router.get("/{run_id}/versions", response_model=list[VersionOut], summary="Get every lesson version in a run")
def get_versions(run_id: UUID) -> list[dict]:
    return repo.list_versions(str(run_id))


@router.post(
    "/{run_id}/feedback",
    response_model=FeedbackOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record human feedback, which later generations use as guidance",
)
def add_feedback(
    run_id: UUID, request: FeedbackRequest, service: RunService = Depends(get_run_service)
) -> dict:
    feedback = repo.add_human_feedback(str(run_id), **request.model_dump())
    service.memory.record_human_feedback(feedback)
    return feedback
