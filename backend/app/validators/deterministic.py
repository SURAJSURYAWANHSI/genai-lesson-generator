"""Deterministic checks. These verify structure and rules, not semantic quality.

Semantic judgement (is the example any good, is the explanation correct) belongs to the
evaluator model. Nothing here treats the presence of a keyword as proof of quality.
"""

from typing import Any

from app.core.errors import RetryLimitExceededError, StatusConsistencyError
from app.prompts.topic_requirements import is_rag_topic
from app.schemas.evaluation import (
    MANDATORY_CRITERION_IDS,
    DeterministicIssue,
    EvaluationResult,
    LLMEvaluation,
)
from app.schemas.lesson import Lesson, word_count

ABSOLUTE_MAX_ATTEMPTS = 3
MIN_ACTIONABLE_CHARS = 10

_TEXT_SECTIONS: dict[str, str] = {
    "title": "Q09",
    "introduction": "Q04",
    "what_it_means": "Q04",
    "why_it_matters": "Q05",
    "real_world_analogy": "Q09",
    "summary": "Q09",
}
_LIST_SECTIONS: dict[str, str] = {
    "important_components": "Q06",
    "step_by_step_process": "Q06",
    "example_walkthrough": "Q07",
    "terminology": "Q03",
    "common_mistakes": "Q09",
    "key_takeaways": "Q09",
    "knowledge_check_questions": "Q09",
    "knowledge_check_answers": "Q09",
}


def _issue(code: str, criterion: str, section: str, message: str, fix: str) -> DeterministicIssue:
    return DeterministicIssue(
        code=code, criterion_id=criterion, section=section, message=message, suggested_correction=fix
    )


def _has_blank_field(item: Any) -> bool:
    if isinstance(item, str):
        return not item.strip()
    if isinstance(item, dict):
        return any(_has_blank_field(value) for value in item.values() if isinstance(value, str))
    return False


def _check_practical_example(lesson: Lesson, topic: str) -> list[DeterministicIssue]:
    example = lesson.practical_example
    issues: list[DeterministicIssue] = []
    for field in ("scenario", "starting_input", "final_result"):
        if not getattr(example, field).strip():
            issues.append(
                _issue(
                    "practical_example_incomplete",
                    "Q07",
                    "practical_example",
                    f"The practical example has no {field.replace('_', ' ')}.",
                    "Show a full worked example from the starting input through to the final result.",
                )
            )
    if is_rag_topic(topic):
        titles = {material.title for material in example.source_materials}
        fix = "Show a question, at least two documents, the selected document, the prompt given to the model and the final answer."
        if len(example.source_materials) < 2:
            issues.append(
                _issue("rag_example_too_few_documents", "Q07", "practical_example",
                       "A RAG example needs at least two documents to show retrieval choosing between them.", fix)
            )
        if not example.selected_materials:
            issues.append(
                _issue("rag_example_no_retrieved_document", "Q07", "practical_example",
                       "The example does not show which document was retrieved.", fix)
            )
        elif not set(example.selected_materials) <= titles:
            issues.append(
                _issue("rag_example_unknown_document", "Q07", "practical_example",
                       "The example retrieves a document that is not in its list of documents.", fix)
            )
        if not example.intermediate_step.strip():
            issues.append(
                _issue("rag_example_no_augmented_prompt", "Q07", "practical_example",
                       "The example does not show how the retrieved text is given to the model.", fix)
            )
    return issues


def _check_knowledge_answers(lesson: Lesson) -> list[DeterministicIssue]:
    questions = {question.number for question in lesson.knowledge_check_questions}
    answered = {answer.number for answer in lesson.knowledge_check_answers if answer.answer.strip()}
    missing = sorted(questions - answered)
    if not missing or not lesson.knowledge_check_answers:
        return []  # An empty answer list is already reported as a missing section.
    return [
        _issue("knowledge_answers_incomplete", "Q09", "knowledge_check_answers",
               f"Questions {missing} have no answer.", "Give a simple answer for every knowledge-check question.")
    ]


def validate_lesson(
    lesson: Lesson, topic: str, *, min_words: int, max_words: int
) -> list[DeterministicIssue]:
    issues: list[DeterministicIssue] = []

    for section, criterion in _TEXT_SECTIONS.items():
        if not getattr(lesson, section).strip():
            issues.append(
                _issue("section_missing", criterion, section, f"The '{section}' section is empty.",
                       f"Write the '{section}' section.")
            )
    for section, criterion in _LIST_SECTIONS.items():
        items = getattr(lesson, section)
        if not items:
            issues.append(
                _issue("section_missing", criterion, section, f"The '{section}' section is empty.",
                       f"Write the '{section}' section.")
            )
            continue
        dumped = [item.model_dump() if hasattr(item, "model_dump") else item for item in items]
        if any(_has_blank_field(item) for item in dumped):
            issues.append(
                _issue("field_empty", criterion, section, f"The '{section}' section has an empty entry.",
                       f"Fill every entry in '{section}'.")
            )

    issues.extend(_check_practical_example(lesson, topic))
    issues.extend(_check_knowledge_answers(lesson))

    numbers = [step.step_number for step in lesson.step_by_step_process]
    if numbers and numbers != list(range(1, len(numbers) + 1)):
        issues.append(
            _issue("steps_out_of_order", "Q06", "step_by_step_process",
                   f"Steps are numbered {numbers}, not 1 to {len(numbers)} in order.",
                   "Number the steps in order, starting from 1.")
        )

    words = word_count(lesson)
    if words < min_words:
        issues.append(
            _issue("lesson_too_short", "Q09", "introduction",
                   f"The lesson has {words} words, below the minimum of {min_words}.",
                   "Expand the explanations so the lesson can stand on its own.")
        )
    if words > max_words:
        issues.append(
            _issue("lesson_too_long", "Q02", "introduction",
                   f"The lesson has {words} words, above the maximum of {max_words}.",
                   "Shorten the lesson. A beginner should not have to read this much in one lesson.")
        )
    return issues


def validate_evaluation_output(
    evaluation: LLMEvaluation, required_ids: tuple[str, ...] = MANDATORY_CRITERION_IDS
) -> list[str]:
    """Return every reason this evaluator output cannot be trusted. Empty means usable."""
    errors: list[str] = []
    ids = [check.criterion_id for check in evaluation.checks]
    for criterion in required_ids:
        if ids.count(criterion) == 0:
            errors.append(f"Criterion {criterion} is missing.")
        elif ids.count(criterion) > 1:
            errors.append(f"Criterion {criterion} appears more than once.")
    errors.extend(f"Unknown criterion {cid}." for cid in sorted(set(ids) - set(required_ids)))
    for check in evaluation.checks:
        if check.status not in ("PASS", "FAIL"):
            errors.append(f"{check.criterion_id}: invalid status {check.status!r}.")
        if not check.evidence.strip():
            errors.append(f"{check.criterion_id}: evidence is required.")
        if check.status == "FAIL":
            if len((check.failure_reason or "").strip()) < MIN_ACTIONABLE_CHARS:
                errors.append(f"{check.criterion_id}: a failed check needs a failure reason.")
            if len((check.suggested_correction or "").strip()) < MIN_ACTIONABLE_CHARS:
                errors.append(f"{check.criterion_id}: a failed check needs an actionable correction.")
    return errors


def enforce_attempt_limit(next_attempt: int, maximum_attempts: int) -> None:
    limit = min(maximum_attempts, ABSOLUTE_MAX_ATTEMPTS)
    if next_attempt > limit:
        raise RetryLimitExceededError(f"Generation attempt {next_attempt} exceeds the limit of {limit}.")


def assert_final_status_consistent(status: str, evaluation: dict[str, Any] | None) -> None:
    """A lesson can only be published when its latest evaluation passed every check."""
    passed = bool(evaluation) and EvaluationResult.model_validate(evaluation).passed
    if status == "PASS" and not passed:
        raise StatusConsistencyError("A run cannot be PASS unless every mandatory check passed.")
    if status == "REJECTED" and passed:
        raise StatusConsistencyError("A run cannot be REJECTED when every mandatory check passed.")
