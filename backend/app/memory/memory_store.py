"""Database-backed memory shared across runs.

Memory only ever adds guidance. It is never consulted when deciding PASS or FAIL, so it has
no way to relax a mandatory rubric requirement.
"""

from typing import Any

from sqlalchemy import or_, select

from app.db.models import AgentMemory, PromptVersion, RubricVersion
from app.db.session import session_scope

FAILURE_PATTERN = "failure_pattern"
CORRECTION_STRATEGY = "correction_strategy"
HUMAN_FEEDBACK = "human_feedback"
RUN_SUMMARY = "run_summary"
TOPIC_PATTERN = "topic_pattern"
GLOBAL_TOPIC = "*"

MAX_GUIDANCE_ITEMS = 8
MAX_EVIDENCE_CHARS = 400

CRITERION_GUIDANCE: dict[str, str] = {
    "Q01": "Check each factual statement against the reference material before including it.",
    "Q02": "Keep sentences short and use common words throughout, including in lists and examples.",
    "Q03": "Explain every technical term immediately, in the same sentence where it first appears.",
    "Q04": "State plainly what the concept is near the start, before giving any details.",
    "Q05": "Name the concrete problem the concept solves before describing how it works.",
    "Q06": "Describe every stage of the workflow, in order, leaving none implied.",
    "Q07": "Work the example through completely with real-looking input, the materials used, the selection made and the final output.",
    "Q08": "Introduce each idea before relying on it, moving from simple ideas to harder ones.",
    "Q09": "Fill every section, including the summary, takeaways, questions and an answer to each question.",
    "Q10": "Re-read the lesson for statements that conflict, especially between the summary and earlier sections.",
}


def _upsert(
    session,
    *,
    memory_type: str,
    topic_key: str,
    memory_key: str,
    content: str,
    criterion_id: str | None = None,
    run_id: str | None = None,
    is_demo: bool = False,
    success: bool = False,
    details: dict[str, Any] | None = None,
) -> AgentMemory:
    record = session.scalars(
        select(AgentMemory).where(
            AgentMemory.memory_type == memory_type,
            AgentMemory.topic_key == topic_key,
            AgentMemory.memory_key == memory_key,
        )
    ).one_or_none()
    if record is None:
        record = AgentMemory(
            memory_type=memory_type,
            topic_key=topic_key,
            memory_key=memory_key,
            criterion_id=criterion_id,
            content=content,
            occurrences=0,
            demo_occurrences=0,
            success_count=0,
            details={},
        )
        session.add(record)
    record.content = content
    record.occurrences += 1
    record.demo_occurrences += 1 if is_demo else 0
    record.success_count += 1 if success else 0
    record.source_run_id = run_id
    record.details = {**(record.details or {}), **(details or {})}
    return record


def _memory_dict(record: AgentMemory) -> dict[str, Any]:
    return {
        "id": record.id,
        "memory_type": record.memory_type,
        "topic_key": record.topic_key,
        "criterion_id": record.criterion_id,
        "memory_key": record.memory_key,
        "content": record.content,
        "occurrences": record.occurrences,
        "demo_occurrences": record.demo_occurrences,
        "success_count": record.success_count,
        "is_active": record.is_active,
        "source_run_id": record.source_run_id,
        "details": record.details,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


class MemoryStore:
    def __init__(self, min_occurrences: int = 2) -> None:
        self.min_occurrences = min_occurrences

    def retrieve(self, topic_key: str) -> dict[str, Any]:
        """Build the guidance for the next generation of this topic."""
        with session_scope() as session:
            rows = session.scalars(
                select(AgentMemory)
                .where(
                    AgentMemory.is_active,
                    or_(AgentMemory.topic_key == topic_key, AgentMemory.topic_key == GLOBAL_TOPIC),
                )
                .order_by(AgentMemory.occurrences.desc(), AgentMemory.updated_at.desc())
            ).all()
            guidance: list[str] = []
            notes: list[str] = []
            record_ids: list[str] = []

            def take(record: AgentMemory, line: str) -> None:
                if line not in guidance:
                    guidance.append(line)
                    record_ids.append(record.id)

            for record in rows:
                if record.memory_type == TOPIC_PATTERN and record.topic_key == topic_key:
                    take(record, f"Approved guidance for this topic: {record.content}")
            for record in rows:
                if record.memory_type == HUMAN_FEEDBACK and record.topic_key == topic_key:
                    take(record, f"A human reviewer said about an earlier lesson: {record.content}")

            # Topic-specific records outrank global ones for the same criterion.
            seen: set[str] = set()
            for record in sorted(rows, key=lambda item: item.topic_key == GLOBAL_TOPIC):
                if record.memory_type != CORRECTION_STRATEGY or record.criterion_id in seen:
                    continue
                seen.add(record.criterion_id)
                take(record, f"This fixed {record.criterion_id} before ({record.success_count} times): {record.content}")

            seen = set()
            for record in sorted(rows, key=lambda item: item.topic_key == GLOBAL_TOPIC):
                if (
                    record.memory_type != FAILURE_PATTERN
                    or record.occurrences < self.min_occurrences
                    or record.criterion_id in seen
                ):
                    continue
                seen.add(record.criterion_id)
                take(record, f"{record.criterion_id} has failed {record.occurrences} times. {CRITERION_GUIDANCE[record.criterion_id]}")
                notes.append(
                    f"{record.criterion_id} has often failed in the past, most recently because: {record.content} "
                    "Check it carefully. The rubric still applies exactly as written."
                )

            guidance = guidance[:MAX_GUIDANCE_ITEMS]
            return {
                "generator_guidance": guidance,
                "evaluator_notes": notes[:MAX_GUIDANCE_ITEMS],
                "record_ids": record_ids[:MAX_GUIDANCE_ITEMS],
                "used": bool(guidance or notes),
            }

    def record_evaluation(
        self,
        *,
        run_id: str,
        topic_key: str,
        evaluation: dict[str, Any],
        previous_evaluation: dict[str, Any] | None,
        previous_feedback: dict[str, Any] | None,
        is_demo: bool,
    ) -> None:
        with session_scope() as session:
            for check in evaluation["checks"]:
                if check["status"] != "FAIL":
                    continue
                for scope in (topic_key, GLOBAL_TOPIC):
                    _upsert(
                        session,
                        memory_type=FAILURE_PATTERN,
                        topic_key=scope,
                        memory_key=check["criterion_id"],
                        criterion_id=check["criterion_id"],
                        content=check["failure_reason"] or "",
                        run_id=run_id,
                        is_demo=is_demo,
                        details={
                            "criterion_name": check["criterion_name"],
                            "last_evidence": check["evidence"][:MAX_EVIDENCE_CHARS],
                            "affected_sections": check["affected_sections"],
                        },
                    )
            if not previous_evaluation or not previous_feedback:
                return
            passing_now = {c["criterion_id"] for c in evaluation["checks"] if c["status"] == "PASS"}
            for item in previous_feedback["failed_criteria"]:
                if item["criterion_id"] not in passing_now:
                    continue
                for scope in (topic_key, GLOBAL_TOPIC):
                    _upsert(
                        session,
                        memory_type=CORRECTION_STRATEGY,
                        topic_key=scope,
                        memory_key=item["criterion_id"],
                        criterion_id=item["criterion_id"],
                        content=f"{item['instruction']} {item['suggested_correction']}",
                        run_id=run_id,
                        is_demo=is_demo,
                        success=True,
                        details={
                            "criterion_name": item["criterion_name"],
                            "target_sections": item["target_sections"],
                        },
                    )

    def record_run_outcome(
        self, *, run_id: str, topic_key: str, status: str, attempts: int, is_demo: bool
    ) -> None:
        with session_scope() as session:
            _upsert(
                session,
                memory_type=RUN_SUMMARY,
                topic_key=topic_key,
                memory_key=run_id,
                content=f"Run ended with status {status} after {attempts} generation(s).",
                run_id=run_id,
                is_demo=is_demo,
                details={"status": status, "attempts": attempts},
            )

    def record_human_feedback(self, feedback: dict[str, Any]) -> None:
        """Approvals are kept on the feedback table; only requested changes become guidance."""
        if feedback["rating"] == "approve":
            return
        with session_scope() as session:
            _upsert(
                session,
                memory_type=HUMAN_FEEDBACK,
                topic_key=feedback["topic_key"],
                memory_key=feedback["id"],
                criterion_id=feedback["criterion_id"],
                content=feedback["comment"],
                run_id=feedback["run_id"],
                details={"rating": feedback["rating"], "reviewer": feedback["reviewer"]},
            )

    def list_records(self, memory_type: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        with session_scope() as session:
            query = select(AgentMemory).order_by(AgentMemory.updated_at.desc()).limit(limit)
            if memory_type:
                query = query.where(AgentMemory.memory_type == memory_type)
            return [_memory_dict(record) for record in session.scalars(query)]

    def patterns(self) -> dict[str, Any]:
        with session_scope() as session:
            records = session.scalars(
                select(AgentMemory)
                .where(AgentMemory.is_active)
                .order_by(AgentMemory.occurrences.desc())
            ).all()
            prompts = session.scalars(select(PromptVersion).where(PromptVersion.is_active)).all()
            rubric = session.scalars(select(RubricVersion).where(RubricVersion.is_active)).one_or_none()

            def of_type(kind: str, *, topic_only: bool = False, global_only: bool = False) -> list[dict[str, Any]]:
                return [
                    _memory_dict(record)
                    for record in records
                    if record.memory_type == kind
                    and not (topic_only and record.topic_key == GLOBAL_TOPIC)
                    and not (global_only and record.topic_key != GLOBAL_TOPIC)
                ]

            return {
                "failure_patterns": of_type(FAILURE_PATTERN, global_only=True),
                "correction_strategies": of_type(CORRECTION_STRATEGY, global_only=True),
                "topic_patterns": of_type(FAILURE_PATTERN, topic_only=True)
                + of_type(CORRECTION_STRATEGY, topic_only=True)
                + of_type(TOPIC_PATTERN),
                "human_feedback": of_type(HUMAN_FEEDBACK),
                "active_prompt_versions": {prompt.name: prompt.version for prompt in prompts},
                "active_rubric_version": rubric.version if rubric else None,
            }
