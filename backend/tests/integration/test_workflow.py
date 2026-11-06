"""The real LangGraph workflow with a real database, using scripted model responses."""

import pytest
from langgraph.errors import GraphRecursionError

from app.core.errors import InvalidModelOutputError, ProviderError, RetryLimitExceededError
from app.graph.workflow import RECURSION_LIMIT
from app.llm.mock_content import rag_lesson
from app.schemas.api import GenerateLessonRequest
from app.schemas.lesson import Lesson
from app.services import run_repository as repo
from app.services.run_service import RunService
from app.validators.deterministic import ABSOLUTE_MAX_ATTEMPTS, enforce_attempt_limit
from tests.conftest import failing_evaluation, passing_evaluation


def clean_lesson() -> Lesson:
    return Lesson.model_validate(rag_lesson())


def revised_lesson(section: str = "practical_example") -> Lesson:
    lesson = clean_lesson()
    if section == "practical_example":
        lesson.practical_example.scenario = "A revised, more specific scenario about staff leave."
    return lesson


def test_passing_lesson_is_finalized_on_first_attempt(make_service, run_lesson):
    service = make_service([clean_lesson()], [passing_evaluation()])
    result = run_lesson(service)
    assert result["status"] == "PASS"
    assert result["attempts"] == 1
    assert result["final_lesson"]["title"]
    assert result["rejection_log"] == []
    assert len(service.providers.generator.prompts) == 1


def test_retry_happens_after_failure(make_service, run_lesson):
    service = make_service(
        [clean_lesson(), revised_lesson()],
        [failing_evaluation("Q07"), passing_evaluation()],
    )
    result = run_lesson(service)
    assert result["attempts"] == 2
    assert len(service.providers.generator.prompts) == 2
    assert len(service.providers.evaluator.prompts) == 2, "Every generated lesson must be evaluated."


def test_regeneration_receives_evaluator_feedback(make_service, run_lesson):
    service = make_service(
        [clean_lesson(), revised_lesson()],
        [failing_evaluation("Q07"), passing_evaluation()],
    )
    run_lesson(service)
    first, second = service.providers.generator.prompts
    assert "revision_feedback_json" not in first
    assert "revision_feedback_json" in second
    assert "Evidence of the problem with Q07." in second
    assert "Q07 is not met by this lesson." in second
    assert "previous_lesson_json" in second


def test_revised_lesson_is_evaluated_independently(make_service, run_lesson):
    service = make_service(
        [clean_lesson(), revised_lesson()],
        [failing_evaluation("Q07"), passing_evaluation()],
    )
    run_lesson(service)
    second_evaluation = service.providers.evaluator.prompts[1]
    assert "revised, more specific scenario" in second_evaluation
    assert "revision_feedback" not in second_evaluation, "The evaluator isn't told what was fixed."


def test_successful_regeneration_terminates_workflow(make_service, run_lesson):
    service = make_service(
        [clean_lesson(), revised_lesson()],
        [failing_evaluation("Q07"), passing_evaluation()],
    )
    result = run_lesson(service)
    assert result["status"] == "PASS"
    assert result["attempts"] == 2
    assert len(service.providers.generator.prompts) == 2, "No further generation after passing."


def test_before_and_after_versions_are_saved(make_service, run_lesson):
    service = make_service(
        [clean_lesson(), revised_lesson()],
        [failing_evaluation("Q07"), passing_evaluation()],
    )
    result = run_lesson(service)
    versions = repo.list_versions(result["run_id"])
    assert [version["version"] for version in versions] == [1, 2]
    assert [version["is_final"] for version in versions] == [False, True]
    assert versions[1]["changed_sections"] == ["practical_example"]
    assert versions[0]["content_hash"] != versions[1]["content_hash"]


def test_maximum_retries_are_enforced(make_service, run_lesson):
    service = make_service([clean_lesson()], [failing_evaluation("Q07")])
    result = run_lesson(service, max_retries=2)
    assert result["attempts"] == 3
    assert len(service.providers.generator.prompts) == 3
    assert len(service.providers.evaluator.prompts) == 3


def test_smaller_retry_limit_is_respected(make_service, run_lesson):
    service = make_service([clean_lesson()], [failing_evaluation("Q07")])
    assert run_lesson(service, max_retries=0)["attempts"] == 1
    service = make_service([clean_lesson()], [failing_evaluation("Q07")])
    assert run_lesson(service, max_retries=1)["attempts"] == 2


def test_retry_exhaustion_produces_rejection(make_service, run_lesson):
    service = make_service([clean_lesson()], [failing_evaluation("Q07")])
    result = run_lesson(service)
    assert result["status"] == "REJECTED"
    assert result["final_lesson"] is None
    detail = repo.get_run_detail(result["run_id"])
    assert detail["latest_lesson"] is not None, "A rejected lesson stays available for inspection."
    assert detail["final_lesson"] is None


def test_workflow_cannot_enter_an_infinite_loop(make_service, run_lesson):
    """Whatever the model does, generation stops at the limit."""
    service = make_service([clean_lesson()], [failing_evaluation("Q01", "Q02", "Q03")])
    result = run_lesson(service, max_retries=2)
    assert result["status"] == "REJECTED"
    assert len(service.providers.generator.prompts) <= ABSOLUTE_MAX_ATTEMPTS
    with pytest.raises(RetryLimitExceededError):
        enforce_attempt_limit(ABSOLUTE_MAX_ATTEMPTS + 1, 1000)
    assert RECURSION_LIMIT >= 20  # 20 is the longest valid path through the graph.


def test_longest_path_fits_the_recursion_limit(make_service):
    service = make_service([clean_lesson()], [failing_evaluation("Q07")])
    state = service.prepare(GenerateLessonRequest(topic="Introduction to RAG"))
    service.graph.invoke(state, config={"recursion_limit": RECURSION_LIMIT})
    assert repo.get_run_detail(state["run_id"])["status"] == "REJECTED"


def test_recursion_guard_stops_a_stuck_run(make_service):
    service = make_service([clean_lesson()], [failing_evaluation("Q07")])
    state = service.prepare(GenerateLessonRequest(topic="Introduction to RAG"))
    with pytest.raises(GraphRecursionError):
        service.graph.invoke(state, config={"recursion_limit": 5})


def test_client_disconnect_closes_the_run(make_service):
    service = make_service([clean_lesson()], [passing_evaluation()])
    state = service.prepare(GenerateLessonRequest(topic="Introduction to RAG"))
    stream = service.stream(state)
    while "load_memory" not in next(stream):  # The run exists, and is partway through.
        pass
    assert repo.get_run_detail(state["run_id"])["status"] == "RUNNING"
    stream.close()
    detail = repo.get_run_detail(state["run_id"])
    assert detail["status"] == "ERROR"
    assert "disconnected" in detail["error_message"]


def test_provider_failure_ends_the_run_with_error(make_service, run_lesson):
    service = make_service([ProviderError("The provider request failed (RateLimitError).")], [passing_evaluation()])
    result = run_lesson(service)
    assert result["status"] == "ERROR"
    assert result["attempts"] == 0
    assert "RateLimitError" in result["error_message"]
    assert service.providers.evaluator.prompts == []


def test_provider_failure_during_evaluation_never_publishes(make_service, run_lesson):
    service = make_service([clean_lesson()], [ProviderError("The provider request failed.")])
    result = run_lesson(service)
    assert result["status"] == "ERROR"
    assert result["final_lesson"] is None
    assert repo.get_run_detail(result["run_id"])["latest_lesson"] is not None


def test_invalid_evaluator_output_ends_with_error_not_pass(make_service, run_lesson):
    service = make_service([clean_lesson()], [InvalidModelOutputError("Bad output.")])
    result = run_lesson(service)
    assert result["status"] == "ERROR"
    assert result["final_lesson"] is None


def test_unexpected_exception_is_contained(make_service, run_lesson, monkeypatch):
    service = make_service([clean_lesson()], [passing_evaluation()])
    monkeypatch.setattr(repo, "add_evaluation", lambda **_: (_ for _ in ()).throw(RuntimeError("database detail")))
    result = run_lesson(service)
    assert result["status"] == "ERROR"
    assert "database detail" not in result["error_message"]


def test_token_usage_and_cost_are_recorded(make_service, run_lesson):
    service = make_service([clean_lesson()], [passing_evaluation()])
    detail = repo.get_run_detail(run_lesson(service)["run_id"])
    assert detail["input_tokens"] == 200
    assert detail["output_tokens"] == 100
    # Scripted rates are $1 and $2 per million tokens: 2 calls x (100 x 1 + 50 x 2) / 1e6.
    assert detail["estimated_cost_usd"] == pytest.approx(0.0004)


def test_prompt_and_rubric_versions_are_recorded(make_service, run_lesson):
    service = make_service([clean_lesson()], [passing_evaluation()])
    detail = repo.get_run_detail(run_lesson(service)["run_id"])
    assert (detail["prompt_version"], detail["evaluator_prompt_version"], detail["rubric_version"]) == (1, 1, 1)
    assert (detail["model_provider"], detail["model_name"]) == ("scripted", "scripted-model")


def test_reference_material_is_not_stored_in_full(make_service, run_lesson):
    reference = "Confidential reference text. " * 10
    service = make_service([clean_lesson()], [passing_evaluation()])
    detail = repo.get_run_detail(run_lesson(service, reference_material=reference)["run_id"])
    assert detail["reference_source"] == "user"
    assert detail["reference_chars"] == len(reference)
    assert "Confidential" not in str(detail)
    assert reference.strip() in service.providers.generator.prompts[0]
    assert reference.strip() in service.providers.evaluator.prompts[0]


def test_graph_has_all_required_nodes(make_service):
    service: RunService = make_service([clean_lesson()], [passing_evaluation()])
    nodes = set(service.graph.get_graph().nodes)
    assert {
        "initialize_run", "load_memory", "generate_lesson", "evaluate_lesson", "record_evaluation",
        "decide_retry", "prepare_revision_feedback", "update_memory", "finalize_lesson", "reject_lesson",
    } <= nodes
