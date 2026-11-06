"""All run persistence. Each function is one short database transaction."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.errors import DuplicateRunError, RunNotFoundError
from app.db.models import (
    Evaluation,
    EvaluationCheck,
    HumanFeedback,
    LessonRun,
    LessonVersion,
    PromptVersion,
    RejectionLog,
    RubricVersion,
    utcnow,
)
from app.db.session import session_scope
from app.prompts.evaluator_prompt import EVALUATOR_PROMPT_NAME, EVALUATOR_SYSTEM_PROMPT
from app.prompts.generator_prompt import GENERATOR_PROMPT_NAME, GENERATOR_SYSTEM_PROMPT
from app.schemas.lesson import content_hash
from app.validators.rubric import RUBRIC_DEFINITION, validate_rubric_definition

RUNNING = "RUNNING"
PASS = "PASS"
REJECTED = "REJECTED"
ERROR = "ERROR"


def seed_defaults() -> None:
    """Create version 1 of the prompts and rubric once. Existing versions are left alone."""
    with session_scope() as session:
        for name, content in (
            (GENERATOR_PROMPT_NAME, GENERATOR_SYSTEM_PROMPT),
            (EVALUATOR_PROMPT_NAME, EVALUATOR_SYSTEM_PROMPT),
        ):
            if not session.scalar(select(PromptVersion.id).where(PromptVersion.name == name).limit(1)):
                session.add(
                    PromptVersion(name=name, version=1, content=content, is_active=True,
                                  change_summary="Initial version.")
                )
        if not session.scalar(select(RubricVersion.id).limit(1)):
            session.add(
                RubricVersion(version=1, definition=RUBRIC_DEFINITION, is_active=True,
                              change_summary="Initial mandatory 10-check rubric.")
            )


def load_active_configuration() -> dict[str, Any]:
    seed_defaults()
    with session_scope() as session:
        prompts = {
            row.name: row
            for row in session.scalars(select(PromptVersion).where(PromptVersion.is_active))
        }
        rubric = session.scalars(select(RubricVersion).where(RubricVersion.is_active)).one()
        validate_rubric_definition(rubric.definition)
        return {
            "generator_prompt": prompts[GENERATOR_PROMPT_NAME].content,
            "generator_prompt_version": prompts[GENERATOR_PROMPT_NAME].version,
            "evaluator_prompt": prompts[EVALUATOR_PROMPT_NAME].content,
            "evaluator_prompt_version": prompts[EVALUATOR_PROMPT_NAME].version,
            "rubric": rubric.definition,
            "rubric_version": rubric.version,
        }


def run_exists(run_id: str) -> bool:
    with session_scope() as session:
        return session.get(LessonRun, run_id) is not None


def create_run(**fields: Any) -> None:
    try:
        with session_scope() as session:
            session.add(LessonRun(status=RUNNING, estimated_cost_usd=0.0, **fields))
    except IntegrityError as error:
        raise DuplicateRunError(f"Run {fields.get('id')} already exists.") from error


def _get_run(session, run_id: str) -> LessonRun:
    run = session.get(LessonRun, run_id)
    if run is None:
        raise RunNotFoundError(f"Run {run_id} was not found.")
    return run


def _add_usage(run: LessonRun, input_tokens: int, output_tokens: int, cost: float | None) -> None:
    run.input_tokens += input_tokens
    run.output_tokens += output_tokens
    # One unknown cost makes the total unknown, rather than quietly understated.
    run.estimated_cost_usd = (
        None if run.estimated_cost_usd is None or cost is None else run.estimated_cost_usd + cost
    )


def update_run(run_id: str, **fields: Any) -> None:
    with session_scope() as session:
        run = _get_run(session, run_id)
        for key, value in fields.items():
            setattr(run, key, value)


def add_version(
    *,
    run_id: str,
    attempt: int,
    content: dict[str, Any],
    source: str,
    changed: list[str],
    injected_error_type: str | None,
    provider: str,
    model: str,
    prompt_version: int,
    input_tokens: int,
    output_tokens: int,
    cost: float | None,
) -> str:
    with session_scope() as session:
        run = _get_run(session, run_id)
        version = LessonVersion(
            run_id=run_id,
            version=attempt,
            attempt_number=attempt,
            content=content,
            content_hash=content_hash(content),
            source=source,
            is_injected=injected_error_type is not None,
            injected_error_type=injected_error_type,
            changed_sections=changed,
            model_provider=provider,
            model_name=model,
            prompt_version=prompt_version,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=cost,
        )
        session.add(version)
        run.attempts = attempt
        _add_usage(run, input_tokens, output_tokens, cost)
        session.flush()
        return version.id


def add_evaluation(
    *,
    run_id: str,
    version_id: str,
    attempt: int,
    evaluation: dict[str, Any],
    lesson: dict[str, Any],
    meta: dict[str, Any],
    rubric_version: int,
    prompt_version: int,
) -> dict[str, Any] | None:
    """Store the evaluation, its checks and, for a failure, the rejection log entry."""
    with session_scope() as session:
        run = _get_run(session, run_id)
        record = Evaluation(
            run_id=run_id,
            lesson_version_id=version_id,
            attempt_number=attempt,
            status=PASS if evaluation["passed"] else "FAIL",
            rubric_version=rubric_version,
            prompt_version=prompt_version,
            model_provider=meta["provider"],
            model_name=meta["model"],
            deterministic_issues=evaluation["deterministic_issues"],
            llm_attempts=meta["llm_attempts"],
            input_tokens=meta["input_tokens"],
            output_tokens=meta["output_tokens"],
            estimated_cost_usd=meta["cost_usd"],
        )
        record.checks = [
            EvaluationCheck(
                criterion_id=check["criterion_id"],
                criterion_name=check["criterion_name"],
                status=check["status"],
                evidence=check["evidence"],
                failure_reason=check["failure_reason"],
                suggested_correction=check["suggested_correction"],
                affected_sections=check["affected_sections"],
                source=check["source"],
            )
            for check in evaluation["checks"]
        ]
        session.add(record)
        _add_usage(run, meta["input_tokens"], meta["output_tokens"], meta["cost_usd"])
        session.flush()
        if evaluation["passed"]:
            return None
        failed = [check for check in evaluation["checks"] if check["status"] == "FAIL"]
        session.add(
            RejectionLog(
                run_id=run_id,
                evaluation_id=record.id,
                lesson_version_id=version_id,
                attempt_number=attempt,
                lesson_version=attempt,
                failed_criterion_ids=[check["criterion_id"] for check in failed],
                failed_checks=[
                    {
                        "criterion_id": check["criterion_id"],
                        "criterion_name": check["criterion_name"],
                        "evidence": check["evidence"],
                        "failure_reason": check["failure_reason"],
                        "suggested_correction": check["suggested_correction"],
                    }
                    for check in failed
                ],
                previous_lesson=lesson,
            )
        )
        session.flush()
        return {
            "run_id": run_id,
            "attempt": attempt,
            "status": "FAIL",
            "failed_checks": [
                {key: check[key] for key in ("criterion_id", "criterion_name", "evidence", "failure_reason", "suggested_correction")}
                for check in failed
            ],
        }


def _rejection_for(session, run_id: str, attempt: int) -> RejectionLog:
    return session.scalars(
        select(RejectionLog).where(RejectionLog.run_id == run_id, RejectionLog.attempt_number == attempt)
    ).one()


def attach_feedback(run_id: str, attempt: int, feedback: dict[str, Any]) -> None:
    with session_scope() as session:
        _rejection_for(session, run_id, attempt).generator_feedback = feedback


def attach_revision(run_id: str, failed_attempt: int, revised: dict[str, Any], version: int) -> None:
    with session_scope() as session:
        entry = _rejection_for(session, run_id, failed_attempt)
        entry.revised_lesson = revised
        entry.revised_version = version


def complete_run(
    run_id: str,
    status: str,
    *,
    final_version_id: str | None = None,
    error_message: str | None = None,
    error_injection: dict[str, Any] | None = None,
) -> None:
    with session_scope() as session:
        run = _get_run(session, run_id)
        run.status = status
        run.error_message = error_message
        run.completed_at = utcnow()
        if error_injection is not None:
            run.error_injection = error_injection
        if final_version_id:
            session.get(LessonVersion, final_version_id).is_final = True


def abort_run_if_running(run_id: str, message: str) -> None:
    with session_scope() as session:
        run = session.get(LessonRun, run_id)
        if run is not None and run.status == RUNNING:
            run.status = ERROR
            run.error_message = message
            run.completed_at = utcnow()


def mark_interrupted_runs() -> int:
    """Runs still RUNNING at startup died with the previous process."""
    with session_scope() as session:
        runs = session.scalars(select(LessonRun).where(LessonRun.status == RUNNING)).all()
        for run in runs:
            run.status = ERROR
            run.error_message = "The server restarted before this run finished."
            run.completed_at = utcnow()
        return len(runs)


def add_human_feedback(run_id: str, **fields: Any) -> dict[str, Any]:
    with session_scope() as session:
        run = _get_run(session, run_id)
        latest = run.versions[-1].id if run.versions else None
        record = HumanFeedback(run_id=run_id, lesson_version_id=latest, **fields)
        session.add(record)
        session.flush()
        return {
            "id": record.id,
            "run_id": run_id,
            "topic_key": run.topic_key,
            "rating": record.rating,
            "comment": record.comment,
            "criterion_id": record.criterion_id,
            "reviewer": record.reviewer,
            "created_at": record.created_at,
        }


# --- Read models -----------------------------------------------------------


def _run_summary(run: LessonRun) -> dict[str, Any]:
    return {
        "run_id": run.id,
        "topic": run.topic,
        "status": run.status,
        "attempts": run.attempts,
        "max_attempts": run.max_attempts,
        "demo_mode": run.demo_mode,
        "memory_used": run.memory_used,
        "model_provider": run.model_provider,
        "model_name": run.model_name,
        "created_at": run.created_at,
        "completed_at": run.completed_at,
    }


def _evaluation_dict(record: Evaluation) -> dict[str, Any]:
    return {
        "id": record.id,
        "attempt_number": record.attempt_number,
        "lesson_version_id": record.lesson_version_id,
        "status": record.status,
        "passed": record.status == PASS,
        "rubric_version": record.rubric_version,
        "prompt_version": record.prompt_version,
        "model_provider": record.model_provider,
        "model_name": record.model_name,
        "deterministic_issues": record.deterministic_issues,
        "llm_attempts": record.llm_attempts,
        "input_tokens": record.input_tokens,
        "output_tokens": record.output_tokens,
        "estimated_cost_usd": record.estimated_cost_usd,
        "created_at": record.created_at,
        "checks": [
            {
                "criterion_id": check.criterion_id,
                "criterion_name": check.criterion_name,
                "status": check.status,
                "evidence": check.evidence,
                "failure_reason": check.failure_reason,
                "suggested_correction": check.suggested_correction,
                "affected_sections": check.affected_sections,
                "source": check.source,
            }
            for check in record.checks
        ],
    }


def _version_dict(version: LessonVersion) -> dict[str, Any]:
    return {
        "id": version.id,
        "version": version.version,
        "attempt_number": version.attempt_number,
        "content": version.content,
        "content_hash": version.content_hash,
        "source": version.source,
        "is_injected": version.is_injected,
        "injected_error_type": version.injected_error_type,
        "changed_sections": version.changed_sections,
        "is_final": version.is_final,
        "model_provider": version.model_provider,
        "model_name": version.model_name,
        "prompt_version": version.prompt_version,
        "input_tokens": version.input_tokens,
        "output_tokens": version.output_tokens,
        "estimated_cost_usd": version.estimated_cost_usd,
        "created_at": version.created_at,
    }


def _rejection_dict(entry: RejectionLog) -> dict[str, Any]:
    return {
        "id": entry.id,
        "run_id": entry.run_id,
        "attempt": entry.attempt_number,
        "lesson_version": entry.lesson_version,
        "status": entry.status,
        "failed_criterion_ids": entry.failed_criterion_ids,
        "failed_checks": entry.failed_checks,
        "generator_feedback": entry.generator_feedback,
        "previous_lesson": entry.previous_lesson,
        "revised_lesson": entry.revised_lesson,
        "revised_version": entry.revised_version,
        "created_at": entry.created_at,
    }


def get_run_detail(run_id: str) -> dict[str, Any]:
    with session_scope() as session:
        run = _get_run(session, run_id)
        final = next((version for version in run.versions if version.is_final), None)
        latest = run.versions[-1] if run.versions else None
        return {
            **_run_summary(run),
            "learner_profile": run.learner_profile,
            "error_message": run.error_message,
            "error_injection": run.error_injection,
            "memory_snapshot": run.memory_snapshot,
            "reference_source": run.reference_source,
            "reference_chars": run.reference_chars,
            "evaluator_provider": run.evaluator_provider,
            "evaluator_model": run.evaluator_model,
            "prompt_version": run.prompt_version,
            "evaluator_prompt_version": run.evaluator_prompt_version,
            "rubric_version": run.rubric_version,
            "input_tokens": run.input_tokens,
            "output_tokens": run.output_tokens,
            "estimated_cost_usd": run.estimated_cost_usd,
            "final_lesson": final.content if final else None,
            "final_version": final.version if final else None,
            "latest_lesson": latest.content if latest else None,
            "latest_version": latest.version if latest else None,
            "evaluation": _evaluation_dict(run.evaluations[-1]) if run.evaluations else None,
            "rejection_count": len(run.rejections),
        }


def get_generate_response(run_id: str) -> dict[str, Any]:
    with session_scope() as session:
        run = _get_run(session, run_id)
        final = next((version for version in run.versions if version.is_final), None)
        return {
            "run_id": run.id,
            "status": run.status,
            "attempts": run.attempts,
            "final_lesson": final.content if final else None,
            "evaluation": _evaluation_dict(run.evaluations[-1]) if run.evaluations else None,
            "rejection_log": [_rejection_dict(entry) for entry in run.rejections],
            "memory_used": run.memory_used,
            "error_message": run.error_message,
            "error_injection": run.error_injection,
        }


def list_evaluations(run_id: str) -> list[dict[str, Any]]:
    with session_scope() as session:
        return [_evaluation_dict(record) for record in _get_run(session, run_id).evaluations]


def list_rejections(run_id: str) -> list[dict[str, Any]]:
    with session_scope() as session:
        return [_rejection_dict(entry) for entry in _get_run(session, run_id).rejections]


def list_versions(run_id: str) -> list[dict[str, Any]]:
    with session_scope() as session:
        return [_version_dict(version) for version in _get_run(session, run_id).versions]


def list_history(limit: int, offset: int) -> dict[str, Any]:
    with session_scope() as session:
        total = session.scalar(select(func.count()).select_from(LessonRun))
        runs = session.scalars(
            select(LessonRun).order_by(LessonRun.created_at.desc()).limit(limit).offset(offset)
        ).all()
        return {"total": total, "items": [_run_summary(run) for run in runs]}


def get_stats() -> dict[str, Any]:
    with session_scope() as session:
        counts = dict(
            session.execute(select(LessonRun.status, func.count()).group_by(LessonRun.status)).all()
        )
        average = session.scalar(
            select(func.avg(LessonRun.attempts)).where(LessonRun.status.in_((PASS, REJECTED)))
        )
        failures = session.execute(
            select(EvaluationCheck.criterion_id, EvaluationCheck.criterion_name, func.count())
            .where(EvaluationCheck.status == "FAIL")
            .group_by(EvaluationCheck.criterion_id, EvaluationCheck.criterion_name)
            .order_by(EvaluationCheck.criterion_id)
        ).all()
        recent = session.scalars(select(LessonRun).order_by(LessonRun.created_at.desc()).limit(8)).all()
        return {
            "total_runs": sum(counts.values()),
            "passing_lessons": counts.get(PASS, 0),
            "rejected_lessons": counts.get(REJECTED, 0),
            "errored_runs": counts.get(ERROR, 0),
            "running": counts.get(RUNNING, 0),
            "average_attempts": round(float(average), 2) if average is not None else None,
            "rubric_failures": [
                {"criterion_id": cid, "criterion_name": name, "failures": count}
                for cid, name, count in failures
            ],
            "recent_runs": [_run_summary(run) for run in recent],
        }
