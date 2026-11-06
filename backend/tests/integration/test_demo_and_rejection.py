"""The assessment demo, error injection and the rejection log."""

import pytest

from app.core.config import get_settings
from app.core.errors import InjectionNotAllowedError, InjectionNotApplicableError
from app.memory.memory_store import MemoryStore
from app.services import run_repository as repo
from app.services.error_injection import ERROR_TYPES, assert_injection_allowed
from tests.conftest import failing_evaluation, passing_evaluation
from tests.integration.test_workflow import clean_lesson

DEMO = {"demo_mode": True, "error_injection": "missing_practical_example"}


def test_assessment_demo_end_to_end(make_service, run_lesson):
    """The 12 steps in section 16 of the brief, through the real graph and mock provider."""
    result = run_lesson(make_service(), **DEMO)
    run_id = result["run_id"]
    versions = repo.list_versions(run_id)
    evaluations = repo.list_evaluations(run_id)
    rejections = repo.list_rejections(run_id)
    detail = repo.get_run_detail(run_id)

    # 1-2: lesson generated, then the error injected.
    assert versions[0]["is_injected"] and versions[0]["injected_error_type"] == "missing_practical_example"
    assert versions[0]["content"]["practical_example"]["source_materials"] == []
    # 3-4: evaluator identifies Q07 and the lesson fails.
    first = evaluations[0]
    assert first["status"] == "FAIL"
    assert [c["criterion_id"] for c in first["checks"] if c["status"] == "FAIL"] == ["Q07"]
    # 5: rejection log records evidence.
    assert rejections[0]["failed_criterion_ids"] == ["Q07"]
    assert rejections[0]["failed_checks"][0]["evidence"]
    # 6: retry agent produces correction feedback.
    assert "practical_example" in rejections[0]["generator_feedback"]["sections_to_revise"]
    # 7: revised lesson created, changing only what failed.
    assert not versions[1]["is_injected"]
    assert set(versions[1]["changed_sections"]) == {"practical_example", "example_walkthrough"}
    assert len(versions[1]["content"]["practical_example"]["source_materials"]) >= 2
    # 8-9: revised lesson evaluated, and every criterion passes.
    assert evaluations[1]["passed"]
    assert all(check["status"] == "PASS" for check in evaluations[1]["checks"])
    # 10: published.
    assert result["status"] == "PASS" and result["attempts"] == 2
    assert detail["final_version"] == 2
    # 11: rejection log remains accessible.
    assert rejections[0]["revised_lesson"] == versions[1]["content"]
    assert rejections[0]["previous_lesson"] == versions[0]["content"]
    # 12: memory records the successful correction strategy.
    strategies = MemoryStore().list_records("correction_strategy")
    assert any(item["criterion_id"] == "Q07" and item["success_count"] == 1 for item in strategies)
    # Injection details are stored.
    injection = detail["error_injection"]
    assert injection["detected"] is True and injection["corrected"] is True
    assert injection["modifications"][0]["description"]
    assert injection["evaluator_results"][0]["failed_criteria"] == ["Q07"]


def test_assessment_demo_is_repeatable(make_service, run_lesson):
    service = make_service()
    outcomes = [run_lesson(service, **DEMO) for _ in range(3)]
    assert [(r["status"], r["attempts"]) for r in outcomes] == [("PASS", 2)] * 3
    finals = [r["final_lesson"] for r in outcomes]
    assert finals[0] == finals[1] == finals[2]


@pytest.mark.parametrize("error_type", sorted(ERROR_TYPES))
def test_each_error_type_is_detected_and_corrected(make_service, run_lesson, error_type):
    result = run_lesson(make_service(), demo_mode=True, error_injection=error_type)
    assert result["status"] == "PASS", result["evaluation"]
    assert result["attempts"] == 2
    injection = repo.get_run_detail(result["run_id"])["error_injection"]
    assert injection["detected"] is True
    assert injection["corrected"] is True


def test_persistent_error_produces_rejection(make_service, run_lesson):
    result = run_lesson(make_service(), **DEMO, persistent_error=True)
    assert result["status"] == "REJECTED"
    assert result["attempts"] == 3
    assert len(result["rejection_log"]) == 3
    injection = repo.get_run_detail(result["run_id"])["error_injection"]
    assert injection["detected"] is True and injection["corrected"] is False


def test_evaluator_missing_an_injected_error_never_publishes(make_service, run_lesson):
    """A model that passes everything can miss a semantic defect. The known defect still blocks it."""
    service = make_service([clean_lesson()], [passing_evaluation()])
    result = run_lesson(service, demo_mode=True, error_injection="contradictory_statements")
    assert result["status"] == "ERROR"
    assert result["final_lesson"] is None
    assert "did not detect" in result["error_message"]
    assert repo.get_run_detail(result["run_id"])["error_injection"]["detected"] is False


def test_injection_blocked_in_production():
    settings = get_settings().model_copy(update={"app_env": "production"})
    with pytest.raises(InjectionNotAllowedError):
        assert_injection_allowed(settings, demo_mode=True, error_type="missing_summary", topic="RAG")


def test_injection_requires_demo_mode():
    with pytest.raises(InjectionNotAllowedError):
        assert_injection_allowed(get_settings(), demo_mode=False, error_type="missing_summary", topic="RAG")


def test_rag_specific_errors_need_a_rag_topic():
    with pytest.raises(InjectionNotApplicableError):
        assert_injection_allowed(get_settings(), demo_mode=True, error_type="incorrect_rag_stage", topic="Fractions")
    assert_injection_allowed(get_settings(), demo_mode=True, error_type="missing_summary", topic="Fractions")


def test_rejection_logs_are_persisted_with_every_required_field(make_service, run_lesson):
    service = make_service(
        [clean_lesson(), clean_lesson()], [failing_evaluation("Q07"), passing_evaluation()]
    )
    result = run_lesson(service)
    entry = repo.list_rejections(result["run_id"])[0]
    assert entry["run_id"] == result["run_id"]
    assert entry["attempt"] == 1 and entry["lesson_version"] == 1 and entry["status"] == "FAIL"
    assert entry["failed_criterion_ids"] == ["Q07"]
    check = entry["failed_checks"][0]
    assert check["criterion_name"] == "Practical Example"
    assert check["evidence"] and check["failure_reason"] and check["suggested_correction"]
    assert entry["generator_feedback"]["failed_criteria"][0]["criterion_id"] == "Q07"
    assert entry["previous_lesson"] and entry["revised_lesson"] and entry["created_at"]
