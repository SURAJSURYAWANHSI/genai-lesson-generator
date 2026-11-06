"""Read access to persistent memory."""

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_run_service
from app.services.run_service import RunService

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", summary="List memory records")
def list_memory(
    memory_type: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=200, ge=1, le=500),
    service: RunService = Depends(get_run_service),
) -> list[dict[str, Any]]:
    return service.memory.list_records(memory_type, limit)


@router.get("/patterns", summary="Get learned failure patterns, strategies and topic patterns")
def memory_patterns(service: RunService = Depends(get_run_service)) -> dict[str, Any]:
    return service.memory.patterns()
