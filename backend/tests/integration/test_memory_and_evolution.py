"""Persistent memory across runs and restarts, and human-controlled evolution."""

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import ProposalStateError, RubricViolationError
from app.db.models import PromptVersion, RubricVersion
from app.db.session import reset_engine, session_scope
from app.memory.evolution import EvolutionEngine
from app.memory.memory_store import MemoryStore
from app.services import run_repository as repo
from app.validators.rubric import RUBRIC_DEFINITION
from tests.conftest import failing_evaluation, passing_evaluation
from tests.integration.test_workflow import clean_lesson


def fail_then_pass(make_service, run_lesson, *criteria: str, **request):
    service = make_service(
        [clean_lesson(), clean_lesson()], [failing_evaluation(*criteria), passing_evaluation()]
    )
    return run_lesson(service, **request)


def test_memory_survives_application_restart(make_service, run_lesson):
    run_id = fail_then_pass(make_service, run_lesson, "Q03")["run_id"]
    before = MemoryStore().list_records()
    assert before

    # A restart: all connections close and the configuration is reloaded from scratch.
    reset_engine()
    get_settings.cache_clear()

    after = MemoryStore().list_records()
    assert {record["id"] for record in after} == {record["id"] for record in before}
    assert repo.get_run_detail(run_id)["status"] == "PASS"
    assert repo.list_rejections(run_id), "Rejection logs must also survive."


def test_memory_retrieval_influences_generator_guidance(make_service, run_lesson):
    """Q03 fails repeatedly, so the next lesson is told to explain terms immediately."""
    for _ in range(2):
        fail_then_pass(make_service, run_lesson, "Q03")

    service = make_service([clean_lesson()], [passing_evaluation()])
    result = run_lesson(service)

    prompt = service.providers.generator.prompts[0]
    assert "lessons_from_past_runs" in prompt
    assert "Explain every technical term immediately" in prompt
    assert result["memory_used"] is True


def test_first_run_has_no_memory_to_use(make_service, run_lesson):
    service = make_service([clean_lesson()], [passing_evaluation()])
    result = run_lesson(service)
    assert result["memory_used"] is False
    assert "lessons_from_past_runs" not in service.providers.generator.prompts[0]


def test_failures_are_recorded_for_the_topic_and_globally(make_service, run_lesson):
    fail_then_pass(make_service, run_lesson, "Q03")
    records = MemoryStore().list_records("failure_pattern")
    assert {record["topic_key"] for record in records} == {"rag", "*"}


def test_differently_worded_rag_topics_share_memory(make_service, run_lesson):
    fail_then_pass(make_service, run_lesson, "Q07", topic="Introduction to RAG")
    service = make_service([clean_lesson()], [passing_evaluation()])
    result = run_lesson(service, topic="What is Retrieval-Augmented Generation?")
    assert result["memory_used"] is True


def test_evaluator_notes_keep_the_standard(make_service, run_lesson):
    for _ in range(2):
        fail_then_pass(make_service, run_lesson, "Q07")
    service = make_service([clean_lesson()], [passing_evaluation()])
    run_lesson(service)
    prompt = service.providers.evaluator.prompts[0]
    assert "notes_from_past_runs" in prompt
    assert "The rubric still applies exactly as written." in prompt


def test_human_feedback_reaches_the_next_generation(make_service, run_lesson):
    run_id = run_lesson(make_service([clean_lesson()], [passing_evaluation()]))["run_id"]
    feedback = repo.add_human_feedback(
        run_id, rating="needs_changes", comment="Use an example from a school.", criterion_id=None, reviewer="sam"
    )
    MemoryStore().record_human_feedback(feedback)
    service = make_service([clean_lesson()], [passing_evaluation()])
    run_lesson(service)
    assert "Use an example from a school." in service.providers.generator.prompts[0]


def test_approval_only_feedback_adds_no_guidance(make_service, run_lesson):
    run_id = run_lesson(make_service([clean_lesson()], [passing_evaluation()]))["run_id"]
    feedback = repo.add_human_feedback(
        run_id, rating="approve", comment="Looks good.", criterion_id=None, reviewer="sam"
    )
    MemoryStore().record_human_feedback(feedback)
    assert MemoryStore().list_records("human_feedback") == []


def engine() -> EvolutionEngine:
    return EvolutionEngine(get_settings())


def active_prompt_version() -> int:
    with session_scope() as session:
        return session.scalars(
            select(PromptVersion).where(PromptVersion.name == "generator", PromptVersion.is_active)
        ).one().version


def proposals_of(kind: str) -> list[dict]:
    return [item for item in engine().list_proposals() if item["proposal_type"] == kind]


def build_prompt_proposal(make_service, run_lesson) -> dict:
    for _ in range(3):
        fail_then_pass(make_service, run_lesson, "Q07")
    return proposals_of("generator_prompt")[0]


def test_proposals_are_generated_with_evidence(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    assert proposal["status"] == "PENDING"
    assert proposal["criterion_id"] == "Q07"
    assert proposal["evidence"]["count"] == 3
    assert proposal["evidence"]["runs_affected"] == 3
    assert proposal["evidence"]["organic_failures"] == 3


def test_all_analysis_dimensions_are_reported(make_service, run_lesson):
    build_prompt_proposal(make_service, run_lesson)
    analysis = engine().analysis()
    assert analysis["frequent_failures"][0]["criterion_id"] == "Q07"
    assert analysis["content_weaknesses"][0]["section"] == "practical_example"
    assert analysis["regeneration_patterns"]["runs_needing_regeneration"] == 3
    assert analysis["effective_strategies"][0]["successes"] == 3
    assert analysis["topic_failure_rates"][0]["failure_rate"] == 1.0


def test_duplicate_proposals_are_not_created(make_service, run_lesson):
    build_prompt_proposal(make_service, run_lesson)
    fail_then_pass(make_service, run_lesson, "Q07")
    assert len(proposals_of("generator_prompt")) == 1


def test_prompts_do_not_change_without_approval(make_service, run_lesson):
    build_prompt_proposal(make_service, run_lesson)
    assert active_prompt_version() == 1


def test_human_approval_controls_prompt_changes(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    approved = engine().approve(proposal["id"], "alex", "Agreed.")
    assert approved["status"] == "APPROVED" and approved["decided_by"] == "alex"
    assert (approved["previous_version"], approved["resulting_version"]) == (1, 2)
    assert approved["baseline_metrics"]["criterion_failures"] == 3
    assert active_prompt_version() == 2

    service = make_service([clean_lesson()], [passing_evaluation()])
    result = run_lesson(service)
    assert proposal["proposed_change"] in service.providers.generator.system_prompts[0]
    assert repo.get_run_detail(result["run_id"])["prompt_version"] == 2


def test_rejected_proposal_changes_nothing(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    rejected = engine().reject(proposal["id"], "alex", "Not needed.")
    assert rejected["status"] == "REJECTED"
    assert active_prompt_version() == 1


def test_rejected_proposal_needs_new_evidence_to_return(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    engine().reject(proposal["id"], "alex", None)
    engine().generate_proposals()
    assert len(proposals_of("generator_prompt")) == 1
    for _ in range(3):
        fail_then_pass(make_service, run_lesson, "Q07")
    assert len(proposals_of("generator_prompt")) == 2


def test_rollback_restores_the_previous_prompt(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    engine().approve(proposal["id"], "alex", None)
    rolled_back = engine().rollback(proposal["id"], "alex", "It made things worse.")
    assert rolled_back["status"] == "ROLLED_BACK"
    assert active_prompt_version() == 1
    service = make_service([clean_lesson()], [passing_evaluation()])
    run_lesson(service)
    assert proposal["proposed_change"] not in service.providers.generator.system_prompts[0]


def test_rollback_is_refused_when_a_newer_version_exists(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    other = proposals_of("instructional_strategy")[0]
    engine().approve(proposal["id"], "alex", None)
    engine().approve(other["id"], "alex", None)
    assert active_prompt_version() == 3
    with pytest.raises(ProposalStateError):
        engine().rollback(proposal["id"], "alex", None)
    assert active_prompt_version() == 3


def test_decisions_are_final_for_pending_state(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    engine().approve(proposal["id"], "alex", None)
    with pytest.raises(ProposalStateError):
        engine().approve(proposal["id"], "alex", None)
    with pytest.raises(ProposalStateError):
        engine().reject(proposal["id"], "alex", None)


def test_topic_guidance_applies_and_rolls_back(make_service, run_lesson):
    build_prompt_proposal(make_service, run_lesson)
    proposal = proposals_of("topic_guidance")[0]
    assert proposal["topic_key"] == "rag"
    engine().approve(proposal["id"], "alex", None)
    assert any("Approved guidance" in line for line in MemoryStore().retrieve("rag")["generator_guidance"])
    engine().rollback(proposal["id"], "alex", None)
    assert not any("Approved guidance" in line for line in MemoryStore().retrieve("rag")["generator_guidance"])


def test_rubric_improvement_is_additive_and_all_checks_stay_mandatory(make_service, run_lesson):
    for _ in range(2):
        service = make_service([clean_lesson()], [failing_evaluation("Q07")])
        run_lesson(service, max_retries=0)
    proposal = proposals_of("rubric_improvement")[0]
    engine().approve(proposal["id"], "alex", None)

    with session_scope() as session:
        rubric = session.scalars(select(RubricVersion).where(RubricVersion.is_active)).one()
        assert rubric.version == 2
        criteria = {item["id"]: item for item in rubric.definition["criteria"]}
    assert len(criteria) == 10 and all(item["mandatory"] for item in criteria.values())
    assert criteria["Q07"]["definition"] == RUBRIC_DEFINITION["criteria"][6]["definition"]
    assert criteria["Q07"]["additional_guidance"] == [proposal["proposed_change"]]

    engine().rollback(proposal["id"], "alex", None)
    with session_scope() as session:
        assert session.scalars(select(RubricVersion).where(RubricVersion.is_active)).one().version == 1


def test_rubric_seeded_version_cannot_be_weakened_at_load(make_service, run_lesson):
    run_lesson(make_service([clean_lesson()], [passing_evaluation()]))
    with session_scope() as session:
        rubric = session.scalars(select(RubricVersion).where(RubricVersion.is_active)).one()
        definition = {"criteria": rubric.definition["criteria"][:-1]}
        rubric.definition = definition
    with pytest.raises(RubricViolationError):
        repo.load_active_configuration()


def test_metrics_compare_prompt_versions(make_service, run_lesson):
    proposal = build_prompt_proposal(make_service, run_lesson)
    engine().approve(proposal["id"], "alex", None)
    run_lesson(make_service([clean_lesson()], [passing_evaluation()]))
    rows = {row["prompt_version"]: row for row in engine().metrics()}
    assert rows[1]["runs"] == 3 and rows[1]["first_attempt_pass_rate"] == 0.0
    assert rows[1]["criterion_failures"] == {"Q07": 3}
    assert rows[2]["runs"] == 1 and rows[2]["first_attempt_pass_rate"] == 1.0


def test_demo_runs_can_be_excluded_from_analysis(make_service, run_lesson, monkeypatch):
    for _ in range(3):
        run_lesson(make_service(), demo_mode=True, error_injection="missing_practical_example")
    included = engine().analysis()
    assert included["demo_runs"] == 3
    assert included["frequent_failures"][0]["demo_failures"] == 3

    monkeypatch.setenv("EVOLUTION_INCLUDE_DEMO_RUNS", "false")
    get_settings.cache_clear()
    excluded = engine().analysis()
    assert excluded["total_runs"] == 0 and excluded["frequent_failures"] == []
