"""The 10 tables required by the brief. Types are portable across SQLite and PostgreSQL."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def new_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always timezone-aware UTC. SQLite otherwise drops the offset on read."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return value.astimezone(timezone.utc) if value is not None else None

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class Base(DeclarativeBase):
    pass


def _pk() -> Mapped[str]:
    return mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)


def _run_fk() -> Mapped[str]:
    return mapped_column(
        Uuid(as_uuid=False), ForeignKey("lesson_runs.id", ondelete="CASCADE"), nullable=False
    )


def _created() -> Mapped[datetime]:
    return mapped_column(UTCDateTime(), default=utcnow, nullable=False)


def _updated() -> Mapped[datetime]:
    return mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow, nullable=False)


class LessonRun(Base):
    __tablename__ = "lesson_runs"
    __table_args__ = (Index("ix_lesson_runs_status_created", "status", "created_at"),)

    id: Mapped[str] = _pk()
    topic: Mapped[str] = mapped_column(String(300), nullable=False)
    topic_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    learner_profile: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="RUNNING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    demo_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_injection: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    memory_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    memory_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    # Reference text may be private, so only its source, hash and size are kept.
    reference_source: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    reference_sha256: Mapped[str | None] = mapped_column(String(64))
    reference_chars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_provider: Mapped[str] = mapped_column(String(30), nullable=False)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    evaluator_provider: Mapped[str] = mapped_column(String(30), nullable=False)
    evaluator_model: Mapped[str] = mapped_column(String(120), nullable=False)
    prompt_version: Mapped[int | None] = mapped_column(Integer)
    evaluator_prompt_version: Mapped[int | None] = mapped_column(Integer)
    rubric_version: Mapped[int | None] = mapped_column(Integer)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    versions: Mapped[list["LessonVersion"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="LessonVersion.version"
    )
    evaluations: Mapped[list["Evaluation"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="Evaluation.attempt_number"
    )
    rejections: Mapped[list["RejectionLog"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="RejectionLog.attempt_number"
    )


class LessonVersion(Base):
    __tablename__ = "lesson_versions"
    __table_args__ = (UniqueConstraint("run_id", "version", name="uq_lesson_versions_run_version"),)

    id: Mapped[str] = _pk()
    run_id: Mapped[str] = _run_fk()
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    is_injected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    injected_error_type: Mapped[str | None] = mapped_column(String(50))
    changed_sections: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    model_provider: Mapped[str] = mapped_column(String(30), nullable=False)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    prompt_version: Mapped[int | None] = mapped_column(Integer)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = _created()

    run: Mapped[LessonRun] = relationship(back_populates="versions")


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (UniqueConstraint("run_id", "attempt_number", name="uq_evaluations_run_attempt"),)

    id: Mapped[str] = _pk()
    run_id: Mapped[str] = _run_fk()
    lesson_version_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("lesson_versions.id", ondelete="CASCADE"), nullable=False
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    rubric_version: Mapped[int | None] = mapped_column(Integer)
    prompt_version: Mapped[int | None] = mapped_column(Integer)
    model_provider: Mapped[str] = mapped_column(String(30), nullable=False)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    deterministic_issues: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    llm_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = _created()

    run: Mapped[LessonRun] = relationship(back_populates="evaluations")
    checks: Mapped[list["EvaluationCheck"]] = relationship(
        back_populates="evaluation", cascade="all, delete-orphan", order_by="EvaluationCheck.criterion_id"
    )


class EvaluationCheck(Base):
    __tablename__ = "evaluation_checks"
    __table_args__ = (
        UniqueConstraint("evaluation_id", "criterion_id", name="uq_evaluation_checks_eval_criterion"),
        Index("ix_evaluation_checks_criterion_status", "criterion_id", "status"),
    )

    id: Mapped[str] = _pk()
    evaluation_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    criterion_id: Mapped[str] = mapped_column(String(5), nullable=False)
    criterion_name: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    suggested_correction: Mapped[str | None] = mapped_column(Text)
    affected_sections: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="llm")
    created_at: Mapped[datetime] = _created()

    evaluation: Mapped[Evaluation] = relationship(back_populates="checks")


class RejectionLog(Base):
    __tablename__ = "rejection_logs"
    __table_args__ = (UniqueConstraint("run_id", "attempt_number", name="uq_rejection_logs_run_attempt"),)

    id: Mapped[str] = _pk()
    run_id: Mapped[str] = _run_fk()
    evaluation_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    lesson_version_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("lesson_versions.id", ondelete="CASCADE"), nullable=False
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    lesson_version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="FAIL")
    failed_criterion_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    failed_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    generator_feedback: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    previous_lesson: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    revised_lesson: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    revised_version: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    run: Mapped[LessonRun] = relationship(back_populates="rejections")


class EvolutionProposal(Base):
    __tablename__ = "evolution_proposals"
    __table_args__ = (Index("ix_evolution_proposals_fingerprint_status", "fingerprint", "status"),)

    id: Mapped[str] = _pk()
    proposal_type: Mapped[str] = mapped_column(String(40), nullable=False)
    target: Mapped[str] = mapped_column(String(40), nullable=False)
    criterion_id: Mapped[str | None] = mapped_column(String(5))
    topic_key: Mapped[str | None] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    proposed_change: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING", index=True)
    previous_version: Mapped[int | None] = mapped_column(Integer)
    resulting_version: Mapped[int | None] = mapped_column(Integer)
    applied_memory_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False))
    baseline_metrics: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    decided_by: Mapped[str | None] = mapped_column(String(120))
    decision_note: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class AgentMemory(Base):
    __tablename__ = "agent_memory"
    __table_args__ = (
        UniqueConstraint("memory_type", "topic_key", "memory_key", name="uq_agent_memory_identity"),
        Index("ix_agent_memory_lookup", "memory_type", "topic_key", "is_active"),
    )

    id: Mapped[str] = _pk()
    memory_type: Mapped[str] = mapped_column(String(40), nullable=False)
    topic_key: Mapped[str] = mapped_column(String(120), nullable=False)
    criterion_id: Mapped[str | None] = mapped_column(String(5))
    memory_key: Mapped[str] = mapped_column(String(160), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    occurrences: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    demo_occurrences: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source_run_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("lesson_runs.id", ondelete="SET NULL")
    )
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class PromptVersion(Base):
    __tablename__ = "prompt_versions"
    __table_args__ = (
        UniqueConstraint("name", "version", name="uq_prompt_versions_name_version"),
        Index(
            "uq_prompt_versions_one_active",
            "name",
            unique=True,
            sqlite_where=text("is_active"),
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[str] = _pk()
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    change_summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_proposal_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("evolution_proposals.id", ondelete="SET NULL")
    )
    created_by: Mapped[str] = mapped_column(String(120), nullable=False, default="system")
    created_at: Mapped[datetime] = _created()


class RubricVersion(Base):
    __tablename__ = "rubric_versions"
    __table_args__ = (
        Index(
            "uq_rubric_versions_one_active",
            "is_active",
            unique=True,
            sqlite_where=text("is_active"),
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[str] = _pk()
    version: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    definition: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    change_summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_proposal_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("evolution_proposals.id", ondelete="SET NULL")
    )
    created_by: Mapped[str] = mapped_column(String(120), nullable=False, default="system")
    created_at: Mapped[datetime] = _created()


class HumanFeedback(Base):
    __tablename__ = "human_feedback"

    id: Mapped[str] = _pk()
    run_id: Mapped[str] = _run_fk()
    lesson_version_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("lesson_versions.id", ondelete="SET NULL")
    )
    rating: Mapped[str] = mapped_column(String(20), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    criterion_id: Mapped[str | None] = mapped_column(String(5))
    reviewer: Mapped[str] = mapped_column(String(120), nullable=False, default="anonymous")
    created_at: Mapped[datetime] = _created()
