"""Self-evolution: proposals are created automatically, and applied only by a human decision."""

from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_run_service
from app.schemas.api import DecisionRequest, ProposalOut, PromptVersionOut
from app.services.run_service import RunService

router = APIRouter(prefix="/evolution", tags=["evolution"])


@router.get("/proposals", response_model=list[ProposalOut], summary="List improvement proposals")
def list_proposals(
    status: Literal["PENDING", "APPROVED", "REJECTED", "ROLLED_BACK"] | None = Query(default=None),
    service: RunService = Depends(get_run_service),
) -> list[dict[str, Any]]:
    return service.evolution.list_proposals(status)


@router.post("/proposals/{proposal_id}/approve", response_model=ProposalOut, summary="Approve and apply a proposal")
def approve(proposal_id: UUID, request: DecisionRequest, service: RunService = Depends(get_run_service)) -> dict[str, Any]:
    return service.evolution.approve(str(proposal_id), request.reviewer, request.note)


@router.post("/proposals/{proposal_id}/reject", response_model=ProposalOut, summary="Reject a proposal")
def reject(proposal_id: UUID, request: DecisionRequest, service: RunService = Depends(get_run_service)) -> dict[str, Any]:
    return service.evolution.reject(str(proposal_id), request.reviewer, request.note)


@router.post("/proposals/{proposal_id}/rollback", response_model=ProposalOut, summary="Undo an approved proposal")
def rollback(proposal_id: UUID, request: DecisionRequest, service: RunService = Depends(get_run_service)) -> dict[str, Any]:
    return service.evolution.rollback(str(proposal_id), request.reviewer, request.note)


@router.post("/analyze", response_model=list[ProposalOut], summary="Analyse history and create any new proposals")
def analyze(service: RunService = Depends(get_run_service)) -> list[dict[str, Any]]:
    return service.evolution.generate_proposals()


@router.get("/analysis", summary="Get statistics from historical evaluations")
def analysis(service: RunService = Depends(get_run_service)) -> dict[str, Any]:
    return service.evolution.analysis()


@router.get("/metrics", summary="Compare outcomes per generator prompt version")
def metrics(service: RunService = Depends(get_run_service)) -> list[dict[str, Any]]:
    return service.evolution.metrics()


@router.get("/prompts", response_model=list[PromptVersionOut], summary="List all prompt versions")
def prompts(service: RunService = Depends(get_run_service)) -> list[dict[str, Any]]:
    return service.evolution.prompt_versions()
