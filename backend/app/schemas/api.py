"""API request and response schemas."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.config import get_settings
from app.schemas.evaluation import MANDATORY_CRITERION_IDS

ErrorInjectionType = Literal[
    "missing_term_explanation",
    "missing_practical_example",
    "incorrect_rag_stage",
    "contradictory_statements",
    "missing_summary",
    "missing_knowledge_answers",
]


class LearnerProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    education: str = Field(default="12th-grade graduate", max_length=120)
    background: str = Field(default="Non-English-medium education", max_length=120)
    english_level: Literal["basic", "intermediate", "advanced"] = "basic"
    technical_level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    programming_experience: str = Field(default="None", max_length=120)
    learning_preference: str = Field(default="Simple explanations and practical examples", max_length=200)


class GenerateLessonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=3)
    learner_profile: LearnerProfile = Field(default_factory=LearnerProfile)
    max_retries: int = Field(default=2, ge=0, le=2)
    reference_material: str | None = None
    demo_mode: bool = False
    error_injection: ErrorInjectionType | None = None
    persistent_error: bool = False
    run_id: UUID | None = None

    @field_validator("topic")
    @classmethod
    def _check_topic(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Topic must have at least 3 characters.")
        limit = get_settings().max_topic_chars
        if len(value) > limit:
            raise ValueError(f"Topic must have at most {limit} characters.")
        return value

    @field_validator("reference_material")
    @classmethod
    def _check_reference(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        limit = get_settings().max_reference_chars
        if len(value) > limit:
            raise ValueError(f"Reference material must have at most {limit} characters.")
        return value

    @model_validator(mode="after")
    def _check_injection(self) -> "GenerateLessonRequest":
        if self.error_injection and not self.demo_mode:
            raise ValueError("error_injection requires demo_mode to be true.")
        if self.persistent_error and not self.error_injection:
            raise ValueError("persistent_error requires error_injection.")
        return self


class CheckOut(BaseModel):
    criterion_id: str
    criterion_name: str
    status: Literal["PASS", "FAIL"]
    evidence: str
    failure_reason: str | None
    suggested_correction: str | None
    affected_sections: list[str]
    source: str


class EvaluationOut(BaseModel):
    id: str
    attempt_number: int
    lesson_version_id: str
    status: str
    passed: bool
    rubric_version: int | None
    prompt_version: int | None
    model_provider: str
    model_name: str
    deterministic_issues: list[dict[str, Any]]
    llm_attempts: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float | None
    created_at: datetime
    checks: list[CheckOut]


class RejectionOut(BaseModel):
    id: str
    run_id: str
    attempt: int
    lesson_version: int
    status: str
    failed_criterion_ids: list[str]
    failed_checks: list[dict[str, Any]]
    generator_feedback: dict[str, Any] | None
    previous_lesson: dict[str, Any]
    revised_lesson: dict[str, Any] | None
    revised_version: int | None
    created_at: datetime


class VersionOut(BaseModel):
    id: str
    version: int
    attempt_number: int
    content: dict[str, Any]
    content_hash: str
    source: str
    is_injected: bool
    injected_error_type: str | None
    changed_sections: list[str]
    is_final: bool
    model_provider: str
    model_name: str
    prompt_version: int | None
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float | None
    created_at: datetime


class GenerateLessonResponse(BaseModel):
    run_id: str
    status: Literal["RUNNING", "PASS", "REJECTED", "ERROR"]
    attempts: int
    final_lesson: dict[str, Any] | None
    evaluation: EvaluationOut | None
    rejection_log: list[RejectionOut]
    memory_used: bool
    error_message: str | None
    error_injection: dict[str, Any] | None


class RunSummary(BaseModel):
    run_id: str
    topic: str
    status: str
    attempts: int
    max_attempts: int
    demo_mode: bool
    memory_used: bool
    model_provider: str
    model_name: str
    created_at: datetime
    completed_at: datetime | None


class RunDetail(RunSummary):
    learner_profile: dict[str, Any]
    error_message: str | None
    error_injection: dict[str, Any] | None
    memory_snapshot: dict[str, Any] | None
    reference_source: str
    reference_chars: int
    evaluator_provider: str
    evaluator_model: str
    prompt_version: int | None
    evaluator_prompt_version: int | None
    rubric_version: int | None
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float | None
    final_lesson: dict[str, Any] | None
    final_version: int | None
    latest_lesson: dict[str, Any] | None
    latest_version: int | None
    evaluation: EvaluationOut | None
    rejection_count: int


class HistoryResponse(BaseModel):
    total: int
    items: list[RunSummary]


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: Literal["approve", "needs_changes", "reject"]
    comment: str = Field(min_length=1, max_length=2000)
    criterion_id: str | None = None
    reviewer: str = Field(default="anonymous", min_length=1, max_length=120)

    @field_validator("criterion_id")
    @classmethod
    def _check_criterion(cls, value: str | None) -> str | None:
        if value is not None and value not in MANDATORY_CRITERION_IDS:
            raise ValueError("criterion_id must be one of Q01 to Q10.")
        return value


class FeedbackOut(BaseModel):
    id: str
    run_id: str
    topic_key: str
    rating: str
    comment: str
    criterion_id: str | None
    reviewer: str
    created_at: datetime


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reviewer: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=2000)


class ProposalOut(BaseModel):
    id: str
    proposal_type: str
    target: str
    criterion_id: str | None
    topic_key: str | None
    title: str
    proposed_change: str
    rationale: str
    evidence: dict[str, Any]
    status: str
    previous_version: int | None
    resulting_version: int | None
    baseline_metrics: dict[str, Any] | None
    decided_by: str | None
    decision_note: str | None
    decided_at: datetime | None
    created_at: datetime


class PromptVersionOut(BaseModel):
    id: str
    name: str
    version: int
    content: str
    is_active: bool
    change_summary: str
    source_proposal_id: str | None
    created_by: str
    created_at: datetime


class ErrorTypeOut(BaseModel):
    key: str
    label: str
    description: str
    expected_criteria: list[str]
    rag_only: bool


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    environment: str
    database: Literal["ok", "unavailable"]
    generator_provider: str
    generator_model: str
    evaluator_provider: str
    evaluator_model: str
    mock_mode: bool
    demo_allowed: bool
    error_types: list[ErrorTypeOut]
