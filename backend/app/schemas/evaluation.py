"""Evaluation and revision-feedback schemas."""

from typing import Literal

from pydantic import BaseModel, computed_field

CheckStatus = Literal["PASS", "FAIL"]

MANDATORY_CRITERION_IDS: tuple[str, ...] = tuple(f"Q{i:02d}" for i in range(1, 11))


class LLMCheck(BaseModel):
    """What the evaluator model must return for each criterion."""

    criterion_id: str
    criterion_name: str
    status: CheckStatus
    evidence: str
    failure_reason: str | None
    suggested_correction: str | None
    affected_sections: list[str]


class LLMEvaluation(BaseModel):
    checks: list[LLMCheck]


class CriterionCheck(LLMCheck):
    source: Literal["llm", "deterministic", "llm+deterministic"] = "llm"


class DeterministicIssue(BaseModel):
    code: str
    criterion_id: str
    section: str
    message: str
    suggested_correction: str


class EvaluationResult(BaseModel):
    checks: list[CriterionCheck]
    deterministic_issues: list[DeterministicIssue] = []

    @computed_field
    @property
    def complete(self) -> bool:
        return sorted(check.criterion_id for check in self.checks) == list(MANDATORY_CRITERION_IDS)

    @computed_field
    @property
    def passed(self) -> bool:
        # Strict gate: there is no weighted score that could outvote a failed criterion.
        return self.complete and all(check.status == "PASS" for check in self.checks)

    @property
    def failed_checks(self) -> list[CriterionCheck]:
        return [check for check in self.checks if check.status == "FAIL"]


class FailedCriterionFeedback(BaseModel):
    criterion_id: str
    criterion_name: str
    evidence: str
    failure_reason: str
    suggested_correction: str
    instruction: str
    target_sections: list[str]


class RevisionFeedback(BaseModel):
    attempt: int
    failed_criteria: list[FailedCriterionFeedback]
    sections_to_revise: list[str]
    sections_to_preserve: list[str]
