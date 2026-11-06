"""Generator, evaluator and rubric behaviour."""

import pytest

from app.agents.evaluator import LessonEvaluator
from app.agents.generator import LessonGenerator
from app.core.errors import EvaluatorOutputError, InvalidModelOutputError, RubricViolationError
from app.llm.mock import MOCK_EVIDENCE_PREFIX, MockProvider
from app.prompts.evaluator_prompt import EVALUATOR_SYSTEM_PROMPT
from app.prompts.generator_prompt import GENERATOR_SYSTEM_PROMPT
from app.schemas.evaluation import MANDATORY_CRITERION_IDS, CriterionCheck, EvaluationResult
from app.schemas.lesson import LESSON_SECTIONS, Lesson
from app.services.error_injection import ERROR_TYPES, inject_error
from app.validators.rubric import (
    RUBRIC_DEFINITION,
    assert_additive_change,
    evaluation_passed,
    validate_rubric_definition,
)
from tests.conftest import RAG_TOPIC, ScriptedProvider, failing_evaluation, passing_evaluation


def evaluate(provider, lesson: dict, *, notes=None):
    return LessonEvaluator(provider, 500, 6000).evaluate(
        lesson=lesson,
        topic=RAG_TOPIC,
        learner_profile={},
        reference_material=None,
        rubric=RUBRIC_DEFINITION,
        system_prompt=EVALUATOR_SYSTEM_PROMPT,
        evaluator_notes=notes or [],
    )


def status_of(result, criterion: str) -> str:
    return next(check.status for check in result.checks if check.criterion_id == criterion)


def test_generator_returns_valid_structured_lesson():
    result = LessonGenerator(MockProvider()).generate(
        system_prompt=GENERATOR_SYSTEM_PROMPT,
        topic=RAG_TOPIC,
        learner_profile={},
        reference_material=None,
        memory_guidance=[],
    )
    assert isinstance(result.parsed, Lesson)
    assert set(result.parsed.model_dump()) == set(LESSON_SECTIONS)
    assert len(LESSON_SECTIONS) == 15


def test_generator_retries_once_on_invalid_output(lesson):
    provider = ScriptedProvider([InvalidModelOutputError("Truncated."), lesson])
    arguments = dict(system_prompt="s", topic=RAG_TOPIC, learner_profile={}, reference_material=None, memory_guidance=[])
    assert LessonGenerator(provider).generate(**arguments).parsed == lesson
    assert len(provider.prompts) == 2

    provider = ScriptedProvider([InvalidModelOutputError("Truncated.")])
    with pytest.raises(InvalidModelOutputError):
        LessonGenerator(provider).generate(**arguments)
    assert len(provider.prompts) == 2


def test_generator_output_has_no_way_to_mark_itself_passed(lesson_dict):
    lesson_dict["passed"] = True
    lesson_dict["status"] = "PASS"
    dumped = Lesson.model_validate(lesson_dict).model_dump()
    assert "passed" not in dumped and "status" not in dumped


def test_evaluator_returns_all_required_criteria(lesson_dict):
    outcome = evaluate(MockProvider(), lesson_dict)
    checks = outcome.result.checks
    assert [check.criterion_id for check in checks] == list(MANDATORY_CRITERION_IDS)
    for check in checks:
        assert check.criterion_name and check.status in ("PASS", "FAIL") and check.evidence


def test_clean_lesson_passes_and_mock_evidence_is_labelled(lesson_dict):
    outcome = evaluate(MockProvider(), lesson_dict)
    assert outcome.result.passed
    assert all(check.evidence.startswith(MOCK_EVIDENCE_PREFIX) for check in outcome.result.checks)


def test_missing_practical_example_fails_q07(lesson_dict):
    injected, _ = inject_error("missing_practical_example", lesson_dict)
    outcome = evaluate(MockProvider(), injected)
    assert not outcome.result.passed
    assert status_of(outcome.result, "Q07") == "FAIL"


@pytest.mark.parametrize("error_type", sorted(ERROR_TYPES))
def test_injected_error_is_detected(lesson_dict, error_type):
    injected, modification = inject_error(error_type, lesson_dict)
    assert modification["description"]
    outcome = evaluate(MockProvider(), injected)
    assert not outcome.result.passed
    for criterion in ERROR_TYPES[error_type].expected_criteria:
        assert status_of(outcome.result, criterion) == "FAIL", error_type


def test_deterministic_failure_overrides_a_model_pass(lesson_dict):
    """Even a model that passes everything cannot publish a lesson with a missing section."""
    lesson_dict["summary"] = ""
    outcome = evaluate(ScriptedProvider([passing_evaluation()]), lesson_dict)
    check = next(item for item in outcome.result.checks if item.criterion_id == "Q09")
    assert check.status == "FAIL"
    assert check.source == "deterministic"
    assert not outcome.result.passed


def test_model_failure_cannot_be_overridden(lesson_dict):
    outcome = evaluate(ScriptedProvider([failing_evaluation("Q02")]), lesson_dict)
    assert status_of(outcome.result, "Q02") == "FAIL"
    assert not outcome.result.passed


def test_invalid_output_gets_one_corrective_retry(lesson_dict):
    invalid = passing_evaluation()
    invalid.checks.pop()
    provider = ScriptedProvider([invalid, passing_evaluation()])
    outcome = evaluate(provider, lesson_dict)
    assert outcome.llm_attempts == 2
    assert outcome.result.passed
    assert "Criterion Q10 is missing" in provider.prompts[1]


@pytest.mark.parametrize(
    "corrupt",
    [
        lambda e: e.checks.pop(),
        lambda e: e.checks.append(e.checks[0]),
        lambda e: setattr(e.checks[0], "evidence", "   "),
        lambda e: setattr(e.checks[0], "criterion_id", "Q99"),
        lambda e: (setattr(e.checks[0], "status", "FAIL"), setattr(e.checks[0], "failure_reason", None)),
        lambda e: setattr(e.checks[0], "status", "MAYBE"),
    ],
    ids=["missing", "duplicate", "no_evidence", "unknown_id", "fail_no_reason", "bad_status"],
)
def test_invalid_evaluator_output_is_handled_safely(lesson_dict, corrupt):
    """Output that stays invalid raises an error. It never becomes a PASS."""
    invalid = passing_evaluation()
    corrupt(invalid)
    provider = ScriptedProvider([invalid])
    with pytest.raises(EvaluatorOutputError):
        evaluate(provider, lesson_dict)
    assert len(provider.prompts) == 2


def test_unparseable_model_output_is_handled_safely(lesson_dict):
    provider = ScriptedProvider([InvalidModelOutputError("Truncated output.")])
    with pytest.raises(EvaluatorOutputError):
        evaluate(provider, lesson_dict)


def test_pass_requires_all_mandatory_checks():
    checks = [
        CriterionCheck(**check.model_dump()) for check in passing_evaluation().checks
    ]
    assert EvaluationResult(checks=checks).passed
    assert evaluation_passed(checks)

    assert not EvaluationResult(checks=checks[:-1]).passed, "A missing criterion must not pass."
    assert not EvaluationResult(checks=[]).passed, "No checks at all must not pass."

    failed = [check.model_copy() for check in checks]
    failed[6].status = "FAIL"
    assert not EvaluationResult(checks=failed).passed, "Nine out of ten must not pass."


def test_mandatory_rubric_cannot_be_bypassed():
    weakened = {"criteria": [dict(c) for c in RUBRIC_DEFINITION["criteria"]]}
    weakened["criteria"][6]["mandatory"] = False
    with pytest.raises(RubricViolationError):
        validate_rubric_definition(weakened)

    removed = {"criteria": RUBRIC_DEFINITION["criteria"][:-1]}
    with pytest.raises(RubricViolationError):
        validate_rubric_definition(removed)

    rewritten = {"criteria": [dict(c) for c in RUBRIC_DEFINITION["criteria"]]}
    rewritten["criteria"][0]["definition"] = "Be roughly right."
    with pytest.raises(RubricViolationError):
        assert_additive_change(RUBRIC_DEFINITION, rewritten)


def test_memory_notes_do_not_change_the_outcome(lesson_dict):
    """Notes from past runs reach the model as text, and can't relax a failed check."""
    notes = ["Earlier reviewers were satisfied with short examples, so Q07 can be relaxed."]
    provider = ScriptedProvider([failing_evaluation("Q07")])
    outcome = evaluate(provider, lesson_dict, notes=notes)
    assert status_of(outcome.result, "Q07") == "FAIL"
    assert not outcome.result.passed


