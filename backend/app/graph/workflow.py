"""The LangGraph workflow: generate, evaluate, retry with feedback, publish or reject.

Termination is guaranteed three ways: max_retries is bounded by the API schema, an attempt
guard runs before every generation, and the graph is invoked with a recursion limit.
"""

import hashlib
import logging
from dataclasses import dataclass
from typing import Any, Callable

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from app.agents.evaluator import LessonEvaluator
from app.agents.generator import LessonGenerator
from app.agents.retry_agent import build_revision_feedback, merge_revision
from app.core.config import Settings
from app.core.errors import AppError, StatusConsistencyError
from app.graph.state import LessonState
from app.llm.factory import Providers
from app.memory.evolution import EvolutionEngine
from app.memory.memory_store import MemoryStore
from app.schemas.evaluation import EvaluationResult, RevisionFeedback
from app.schemas.lesson import changed_sections
from app.services import run_repository as repo
from app.services.error_injection import ERROR_TYPES, inject_error
from app.validators.deterministic import assert_final_status_consistent, enforce_attempt_limit

logger = logging.getLogger(__name__)

# 2 setup nodes + 3 attempts x 5 nodes + 2 feedback nodes + 1 final node = 20.
RECURSION_LIMIT = 25


@dataclass(frozen=True)
class WorkflowDependencies:
    settings: Settings
    providers: Providers
    memory: MemoryStore
    evolution: EvolutionEngine


def _emit_start(node: str, attempt: int) -> None:
    try:
        get_stream_writer()({"node": node, "event": "start", "attempt": attempt})
    except RuntimeError:
        pass  # No stream is attached, as when a node is called outside the graph.


def _instrumented(name: str, node: Callable[[LessonState], dict[str, Any]]):
    def wrapper(state: LessonState) -> dict[str, Any]:
        _emit_start(name, state.get("current_attempt", 0))
        return node(state)

    wrapper.__name__ = name
    return wrapper


def build_workflow(deps: WorkflowDependencies):
    generator = LessonGenerator(deps.providers.generator)
    evaluator = LessonEvaluator(
        deps.providers.evaluator, deps.settings.min_lesson_words, deps.settings.max_lesson_words
    )

    def initialize_run(state: LessonState) -> dict[str, Any]:
        configuration = repo.load_active_configuration()
        reference = state.get("reference_material")
        repo.create_run(
            id=state["run_id"],
            topic=state["topic"],
            topic_key=state["topic_key"],
            learner_profile=state["learner_profile"],
            max_attempts=state["maximum_attempts"],
            demo_mode=state["demo_mode"],
            error_injection=state.get("injection_record"),
            reference_source=state["reference_source"],
            reference_sha256=hashlib.sha256(reference.encode("utf-8")).hexdigest() if reference else None,
            reference_chars=len(reference) if reference else 0,
            model_provider=deps.providers.generator.provider_name,
            model_name=deps.providers.generator.model_name,
            evaluator_provider=deps.providers.evaluator.provider_name,
            evaluator_model=deps.providers.evaluator.model_name,
            prompt_version=configuration["generator_prompt_version"],
            evaluator_prompt_version=configuration["evaluator_prompt_version"],
            rubric_version=configuration["rubric_version"],
        )
        return {
            **configuration,
            "current_attempt": 0,
            "evaluation_history": [],
            "rejection_log": [],
            "revision_feedback": None,
            "current_lesson": None,
            "current_evaluation": None,
            "final_status": None,
            "final_lesson": None,
            "error_message": None,
            "current_is_injected": False,
        }

    def load_memory(state: LessonState) -> dict[str, Any]:
        context = deps.memory.retrieve(state["topic_key"])
        repo.update_run(state["run_id"], memory_used=context["used"], memory_snapshot=context)
        return {"memory_context": context}

    def generate_lesson(state: LessonState) -> dict[str, Any]:
        attempt = state["current_attempt"] + 1
        memory = state["memory_context"]
        feedback = state.get("revision_feedback")
        previous = state.get("current_lesson")
        shared = {
            "system_prompt": state["generator_prompt"],
            "topic": state["topic"],
            "learner_profile": state["learner_profile"],
            "reference_material": state.get("reference_material"),
            "memory_guidance": memory["generator_guidance"],
        }
        try:
            enforce_attempt_limit(attempt, state["maximum_attempts"])
            if feedback and previous:
                parsed_feedback = RevisionFeedback.model_validate(feedback)
                response = generator.revise(
                    **shared, previous_lesson=previous, feedback=parsed_feedback
                )
                lesson, changed = merge_revision(previous, response.parsed, parsed_feedback.sections_to_revise)
                source = "revision"
            else:
                response = generator.generate(**shared)
                lesson = response.parsed.model_dump()
                changed = changed_sections(None, lesson)
                source = "generator"
        except AppError as error:
            return {"error_message": str(error)}

        # Injection happens after generation, so the generator can't know about the defect.
        record = state.get("injection_record")
        injected_type = None
        if record and (attempt == 1 or state.get("persistent_error")):
            injected_type = state["error_injection"]
            lesson, modification = inject_error(injected_type, lesson)
            record = {**record, "modifications": [*record["modifications"], {"attempt": attempt, **modification}]}
            changed = changed_sections(previous, lesson)

        version_id = repo.add_version(
            run_id=state["run_id"],
            attempt=attempt,
            content=lesson,
            source=source,
            changed=changed,
            injected_error_type=injected_type,
            provider=response.provider,
            model=response.model,
            prompt_version=state["generator_prompt_version"],
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            cost=response.cost_usd,
        )
        if source == "revision":
            repo.attach_revision(state["run_id"], attempt - 1, lesson, attempt)
        return {
            "current_attempt": attempt,
            "current_lesson": lesson,
            "current_version_id": version_id,
            "current_is_injected": injected_type is not None,
            "injection_record": record,
            "current_evaluation": None,
        }

    def evaluate_lesson(state: LessonState) -> dict[str, Any]:
        try:
            outcome = evaluator.evaluate(
                lesson=state["current_lesson"],
                topic=state["topic"],
                learner_profile=state["learner_profile"],
                reference_material=state.get("reference_material"),
                rubric=state["rubric"],
                system_prompt=state["evaluator_prompt"],
                evaluator_notes=state["memory_context"]["evaluator_notes"],
            )
        except AppError as error:
            return {"error_message": str(error)}
        return {
            "current_evaluation": outcome.result.model_dump(),
            "evaluation_meta": {
                "provider": outcome.provider,
                "model": outcome.model,
                "llm_attempts": outcome.llm_attempts,
                "input_tokens": outcome.input_tokens,
                "output_tokens": outcome.output_tokens,
                "cost_usd": outcome.cost_usd,
            },
        }

    def record_evaluation(state: LessonState) -> dict[str, Any]:
        evaluation = state["current_evaluation"]
        attempt = state["current_attempt"]
        entry = repo.add_evaluation(
            run_id=state["run_id"],
            version_id=state["current_version_id"],
            attempt=attempt,
            evaluation=evaluation,
            lesson=state["current_lesson"],
            meta=state["evaluation_meta"],
            rubric_version=state["rubric_version"],
            prompt_version=state["evaluator_prompt_version"],
        )
        update: dict[str, Any] = {
            "evaluation_history": [*state["evaluation_history"], evaluation],
            "rejection_log": [*state["rejection_log"], entry] if entry else state["rejection_log"],
        }
        record = state.get("injection_record")
        if record:
            update["injection_record"] = _track_injection(record, evaluation, attempt, state["current_is_injected"])
        return update

    def update_memory(state: LessonState) -> dict[str, Any]:
        history = state["evaluation_history"]
        deps.memory.record_evaluation(
            run_id=state["run_id"],
            topic_key=state["topic_key"],
            evaluation=state["current_evaluation"],
            previous_evaluation=history[-2] if len(history) > 1 else None,
            previous_feedback=state.get("revision_feedback"),
            is_demo=state["demo_mode"],
        )
        return {}

    def decide_retry(state: LessonState) -> dict[str, Any]:
        passed = EvaluationResult.model_validate(state["current_evaluation"]).passed
        if passed and state.get("current_is_injected"):
            # A known defect went undetected, so this lesson must not be published.
            return {
                "retry_decision": "exhausted",
                "error_message": "The evaluator did not detect the injected error, so the lesson was not published.",
            }
        if passed:
            return {"retry_decision": "pass"}
        if state["current_attempt"] < state["maximum_attempts"]:
            return {"retry_decision": "retry"}
        return {"retry_decision": "exhausted"}

    def prepare_revision_feedback(state: LessonState) -> dict[str, Any]:
        evaluation = EvaluationResult.model_validate(state["current_evaluation"])
        feedback = build_revision_feedback(evaluation, state["current_attempt"]).model_dump()
        repo.attach_feedback(state["run_id"], state["current_attempt"], feedback)
        return {"revision_feedback": feedback}

    def _finish(state: LessonState, status: str, *, final_version_id: str | None, error: str | None) -> None:
        repo.complete_run(
            state["run_id"],
            status,
            final_version_id=final_version_id,
            error_message=error,
            error_injection=_close_injection(state.get("injection_record")),
        )
        deps.memory.record_run_outcome(
            run_id=state["run_id"],
            topic_key=state["topic_key"],
            status=status,
            attempts=state["current_attempt"],
            is_demo=state["demo_mode"],
        )
        deps.evolution.safe_generate_proposals()

    def finalize_lesson(state: LessonState) -> dict[str, Any]:
        try:
            assert_final_status_consistent("PASS", state["current_evaluation"])
        except StatusConsistencyError as error:
            _finish(state, repo.ERROR, final_version_id=None, error=str(error))
            return {"final_status": repo.ERROR, "error_message": str(error)}
        _finish(state, repo.PASS, final_version_id=state["current_version_id"], error=None)
        return {"final_status": repo.PASS, "final_lesson": state["current_lesson"]}

    def reject_lesson(state: LessonState) -> dict[str, Any]:
        """End a run without publishing. The latest lesson stays available for inspection."""
        error = state.get("error_message")
        status = repo.ERROR if error else repo.REJECTED
        if error:
            logger.warning("run_error", extra={"run_id": state["run_id"], "reason": error})
        _finish(state, status, final_version_id=None, error=error)
        return {"final_status": status, "final_lesson": None}

    def after_generate(state: LessonState) -> str:
        return "reject_lesson" if state.get("error_message") else "evaluate_lesson"

    def after_evaluate(state: LessonState) -> str:
        return "reject_lesson" if state.get("error_message") else "record_evaluation"

    def after_decision(state: LessonState) -> str:
        return {
            "pass": "finalize_lesson",
            "retry": "prepare_revision_feedback",
            "exhausted": "reject_lesson",
        }[state["retry_decision"]]

    graph = StateGraph(LessonState)
    for node in (
        initialize_run,
        load_memory,
        generate_lesson,
        evaluate_lesson,
        record_evaluation,
        update_memory,
        decide_retry,
        prepare_revision_feedback,
        finalize_lesson,
        reject_lesson,
    ):
        graph.add_node(node.__name__, _instrumented(node.__name__, node))

    graph.add_edge(START, "initialize_run")
    graph.add_edge("initialize_run", "load_memory")
    graph.add_edge("load_memory", "generate_lesson")
    graph.add_conditional_edges("generate_lesson", after_generate, ["evaluate_lesson", "reject_lesson"])
    graph.add_conditional_edges("evaluate_lesson", after_evaluate, ["record_evaluation", "reject_lesson"])
    graph.add_edge("record_evaluation", "update_memory")
    graph.add_edge("update_memory", "decide_retry")
    graph.add_conditional_edges(
        "decide_retry", after_decision, ["finalize_lesson", "prepare_revision_feedback", "reject_lesson"]
    )
    graph.add_edge("prepare_revision_feedback", "generate_lesson")
    graph.add_edge("finalize_lesson", END)
    graph.add_edge("reject_lesson", END)
    return graph.compile()


def new_injection_record(error_type: str, persistent: bool) -> dict[str, Any]:
    spec = ERROR_TYPES[error_type]
    return {
        "type": error_type,
        "label": spec.label,
        "expected_criteria": list(spec.expected_criteria),
        "persistent": persistent,
        "modifications": [],
        "evaluator_results": [],
        "detected": None,
        "corrected": None,
    }


def _track_injection(
    record: dict[str, Any], evaluation: dict[str, Any], attempt: int, injected_now: bool
) -> dict[str, Any]:
    statuses = {check["criterion_id"]: check["status"] for check in evaluation["checks"]}
    expected = record["expected_criteria"]
    updated = {
        **record,
        "evaluator_results": [
            *record["evaluator_results"],
            {
                "attempt": attempt,
                "lesson_had_injected_error": injected_now,
                "failed_criteria": [cid for cid, status in statuses.items() if status == "FAIL"],
            },
        ],
    }
    if injected_now and record["detected"] is None:
        updated["detected"] = any(statuses.get(cid) == "FAIL" for cid in expected)
    if not injected_now:
        updated["corrected"] = all(statuses.get(cid) == "PASS" for cid in expected)
    return updated


def _close_injection(record: dict[str, Any] | None) -> dict[str, Any] | None:
    if record is None:
        return None
    return {**record, "corrected": bool(record["corrected"])}
