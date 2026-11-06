"""Deterministic validators and retry-agent logic."""

import pytest

from app.agents.retry_agent import build_revision_feedback, merge_revision
from app.core.errors import RetryLimitExceededError, StatusConsistencyError
from app.schemas.evaluation import CriterionCheck, EvaluationResult, LLMEvaluation
from app.schemas.lesson import LESSON_SECTIONS, Lesson
from app.validators.deterministic import (
    assert_final_status_consistent,
    enforce_attempt_limit,
    validate_evaluation_output,
    validate_lesson,
)
from tests.conftest import RAG_TOPIC, failing_evaluation, passing_evaluation


def issues_for(lesson_dict: dict, *, topic=RAG_TOPIC, min_words=500, max_words=6000):
    return validate_lesson(Lesson.model_validate(lesson_dict), topic, min_words=min_words, max_words=max_words)


def result_from(evaluation: LLMEvaluation) -> EvaluationResult:
    return EvaluationResult(checks=[CriterionCheck(**check.model_dump()) for check in evaluation.checks])


def test_clean_lesson_has_no_issues(lesson_dict):
    assert issues_for(lesson_dict) == []


@pytest.mark.parametrize(
    "section, empty, criterion",
    [
        ("introduction", "", "Q04"),
        ("why_it_matters", "  ", "Q05"),
        ("step_by_step_process", [], "Q06"),
        ("example_walkthrough", [], "Q07"),
        ("terminology", [], "Q03"),
        ("summary", "", "Q09"),
        ("key_takeaways", [], "Q09"),
        ("knowledge_check_questions", [], "Q09"),
        ("knowledge_check_answers", [], "Q09"),
    ],
)
def test_deterministic_validator_catches_missing_sections(lesson_dict, section, empty, criterion):
    lesson_dict[section] = empty
    found = issues_for(lesson_dict)
    assert any(i.section == section and i.criterion_id == criterion for i in found)


def test_minimum_length_is_configurable(lesson_dict):
    assert issues_for(lesson_dict, min_words=500) == []
    too_short = issues_for(lesson_dict, min_words=100000, max_words=200000)
    assert [issue.code for issue in too_short] == ["lesson_too_short"]


def test_maximum_length_is_enforced(lesson_dict):
    assert [issue.code for issue in issues_for(lesson_dict, min_words=1, max_words=10)] == ["lesson_too_long"]


def test_unanswered_question_is_caught(lesson_dict):
    lesson_dict["knowledge_check_answers"].pop()
    assert [issue.code for issue in issues_for(lesson_dict)] == ["knowledge_answers_incomplete"]


def test_rag_example_must_show_retrieval_between_real_documents(lesson_dict):
    lesson_dict["practical_example"]["selected_materials"] = ["A document that does not exist"]
    assert [issue.code for issue in issues_for(lesson_dict)] == ["rag_example_unknown_document"]


def test_non_rag_example_does_not_need_documents(lesson_dict):
    lesson_dict["practical_example"]["source_materials"] = []
    lesson_dict["practical_example"]["selected_materials"] = []
    assert issues_for(lesson_dict, topic="Introduction to Fractions") == []


def test_steps_out_of_order_are_caught(lesson_dict):
    lesson_dict["step_by_step_process"].reverse()
    assert "steps_out_of_order" in [issue.code for issue in issues_for(lesson_dict)]


def test_keywords_alone_prove_nothing(lesson_dict):
    """Validators check structure, so filler full of keywords isn't treated as quality."""
    lesson_dict["what_it_means"] = "RAG retrieval augmentation generation."
    assert issues_for(lesson_dict) == []  # Structurally present, left for the evaluator to judge.


def test_evaluation_output_validator_accepts_valid_output():
    assert validate_evaluation_output(passing_evaluation()) == []


def test_failed_check_needs_actionable_feedback():
    evaluation = failing_evaluation("Q07")
    evaluation.checks[6].suggested_correction = "Fix it"
    errors = validate_evaluation_output(evaluation)
    assert errors == ["Q07: a failed check needs an actionable correction."]


def test_attempt_limit_is_enforced():
    enforce_attempt_limit(3, 3)
    with pytest.raises(RetryLimitExceededError):
        enforce_attempt_limit(4, 3)
    # The absolute cap of 3 applies whatever was requested.
    with pytest.raises(RetryLimitExceededError):
        enforce_attempt_limit(4, 999)


def test_final_status_must_match_evaluation():
    passed = result_from(passing_evaluation()).model_dump()
    failed = result_from(failing_evaluation("Q07")).model_dump()
    assert_final_status_consistent("PASS", passed)
    assert_final_status_consistent("REJECTED", failed)
    with pytest.raises(StatusConsistencyError):
        assert_final_status_consistent("PASS", failed)
    with pytest.raises(StatusConsistencyError):
        assert_final_status_consistent("PASS", None)
    with pytest.raises(StatusConsistencyError):
        assert_final_status_consistent("REJECTED", passed)


def test_feedback_contains_only_failed_criteria():
    feedback = build_revision_feedback(result_from(failing_evaluation("Q07", "Q03")), attempt=1)
    assert [item.criterion_id for item in feedback.failed_criteria] == ["Q03", "Q07"]
    assert feedback.sections_to_revise == ["practical_example"]
    assert "summary" in feedback.sections_to_preserve
    assert set(feedback.sections_to_revise) | set(feedback.sections_to_preserve) == set(LESSON_SECTIONS)
    assert all(item.evidence and item.instruction for item in feedback.failed_criteria)


def test_feedback_falls_back_to_default_sections():
    feedback = build_revision_feedback(result_from(failing_evaluation("Q05", sections=[])), attempt=1)
    assert feedback.sections_to_revise == ["why_it_matters"]


def test_revision_merge_keeps_unrelated_sections(lesson, lesson_dict):
    revised = lesson.model_copy(deep=True)
    revised.summary = "A model rewrote this section without being asked to."
    revised.why_it_matters = "This section was the one that needed changing."
    merged, changed = merge_revision(lesson_dict, revised, ["why_it_matters"])
    assert merged["why_it_matters"] == "This section was the one that needed changing."
    assert merged["summary"] == lesson_dict["summary"], "Untargeted sections must not drift."
    assert changed == ["why_it_matters"]
