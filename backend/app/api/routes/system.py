"""Health and dashboard statistics. Never returns secrets."""

import logging
from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import session_scope
from app.schemas.api import HealthResponse
from app.services import run_repository as repo
from app.services.error_injection import ERROR_TYPES

router = APIRouter(tags=["system"])
logger = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse, summary="Check system health and configuration")
def health() -> dict[str, Any]:
    settings = get_settings()
    database = "ok"
    try:
        with session_scope() as session:
            session.execute(text("SELECT 1"))
    except Exception:
        logger.exception("health_database_unavailable")
        database = "unavailable"
    generator_provider = settings.provider_for("generator")
    evaluator_provider = settings.provider_for("evaluator")
    return {
        "status": "ok" if database == "ok" else "degraded",
        "environment": settings.app_env,
        "database": database,
        "generator_provider": generator_provider,
        "generator_model": settings.model_for("generator"),
        "evaluator_provider": evaluator_provider,
        "evaluator_model": settings.model_for("evaluator"),
        "mock_mode": "mock" in (generator_provider, evaluator_provider),
        "demo_allowed": settings.demo_allowed,
        "error_types": [
            {
                "key": item.key,
                "label": item.label,
                "description": item.description,
                "expected_criteria": list(item.expected_criteria),
                "rag_only": item.rag_only,
            }
            for item in ERROR_TYPES.values()
        ],
    }


@router.get("/stats", summary="Get dashboard statistics")
def stats() -> dict[str, Any]:
    return repo.get_stats()
