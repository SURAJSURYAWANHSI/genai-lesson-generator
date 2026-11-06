"""Starts workflow runs, for both the blocking and the streaming endpoints."""

import json
import logging
import uuid
from collections.abc import Iterator
from typing import Any

from langgraph.errors import GraphRecursionError

from app.core.config import Settings
from app.core.errors import DuplicateRunError
from app.graph.state import LessonState
from app.graph.workflow import (
    RECURSION_LIMIT,
    WorkflowDependencies,
    build_workflow,
    new_injection_record,
)
from app.llm.factory import Providers, build_providers
from app.memory.evolution import EvolutionEngine
from app.memory.memory_store import MemoryStore
from app.prompts.topic_requirements import default_reference, normalize_topic
from app.schemas.api import GenerateLessonRequest
from app.services import run_repository as repo
from app.services.error_injection import assert_injection_allowed

logger = logging.getLogger(__name__)

UNEXPECTED_ERROR_MESSAGE = "The run stopped because of an internal error."
_GRAPH_CONFIG = {"recursion_limit": RECURSION_LIMIT}


def sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _describe(node: str, update: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    """A small, display-ready summary of what a node just did."""
    state.update(update)
    payload: dict[str, Any] = {
        "node": node,
        "event": "complete",
        "attempt": state.get("current_attempt", 0),
    }
    if node == "load_memory":
        context = update["memory_context"]
        payload["memory_used"] = context["used"]
        payload["guidance"] = context["generator_guidance"]
    elif node == "generate_lesson":
        payload["injected"] = update.get("current_is_injected", False)
        payload["error"] = update.get("error_message")
    elif node == "evaluate_lesson":
        evaluation = update.get("current_evaluation")
        payload["error"] = update.get("error_message")
        if evaluation:
            payload["passed"] = evaluation["passed"]
            payload["failed_criteria"] = [
                check["criterion_id"] for check in evaluation["checks"] if check["status"] == "FAIL"
            ]
    elif node == "decide_retry":
        payload["decision"] = update["retry_decision"]
    elif node == "prepare_revision_feedback":
        payload["sections_to_revise"] = update["revision_feedback"]["sections_to_revise"]
    elif node in ("finalize_lesson", "reject_lesson"):
        payload["final_status"] = update["final_status"]
    return payload


class RunService:
    def __init__(self, settings: Settings, providers: Providers | None = None) -> None:
        self.settings = settings
        self.providers = providers or build_providers(settings)
        self.memory = MemoryStore(settings.memory_pattern_min_occurrences)
        self.evolution = EvolutionEngine(settings)
        self.graph = build_workflow(
            WorkflowDependencies(settings, self.providers, self.memory, self.evolution)
        )

    def prepare(self, request: GenerateLessonRequest) -> LessonState:
        """Check everything that should fail before any work starts."""
        assert_injection_allowed(
            self.settings,
            demo_mode=request.demo_mode,
            error_type=request.error_injection,
            topic=request.topic,
        )
        run_id = str(request.run_id or uuid.uuid4())
        if repo.run_exists(run_id):
            raise DuplicateRunError(f"Run {run_id} already exists.")
        reference = request.reference_material or default_reference(request.topic)
        source = "user" if request.reference_material else ("default" if reference else "none")
        return LessonState(
            run_id=run_id,
            topic=request.topic,
            topic_key=normalize_topic(request.topic),
            learner_profile=request.learner_profile.model_dump(),
            reference_material=reference,
            reference_source=source,
            maximum_attempts=request.max_retries + 1,
            demo_mode=request.demo_mode,
            error_injection=request.error_injection,
            persistent_error=request.persistent_error,
            injection_record=(
                new_injection_record(request.error_injection, request.persistent_error)
                if request.error_injection
                else None
            ),
        )

    def run(self, state: LessonState) -> dict[str, Any]:
        run_id = state["run_id"]
        try:
            self.graph.invoke(state, config=_GRAPH_CONFIG)
        except DuplicateRunError:
            raise
        except GraphRecursionError:
            logger.error("workflow_recursion_limit", extra={"run_id": run_id})
            repo.abort_run_if_running(run_id, "The workflow exceeded its step limit and was stopped.")
        except Exception:
            logger.exception("workflow_failed", extra={"run_id": run_id})
            repo.abort_run_if_running(run_id, UNEXPECTED_ERROR_MESSAGE)
        return repo.get_generate_response(run_id)

    def stream(self, state: LessonState) -> Iterator[str]:
        run_id = state["run_id"]
        progress: dict[str, Any] = {}
        finished = False
        yield sse("started", {"run_id": run_id, "maximum_attempts": state["maximum_attempts"]})
        try:
            for mode, chunk in self.graph.stream(state, config=_GRAPH_CONFIG, stream_mode=["updates", "custom"]):
                if mode == "custom":
                    yield sse("stage", chunk)
                    continue
                for node, update in chunk.items():
                    yield sse("stage", _describe(node, update or {}, progress))
            finished = True
            yield sse("complete", repo.get_generate_response(run_id))
        except GraphRecursionError:
            logger.error("workflow_recursion_limit", extra={"run_id": run_id})
            repo.abort_run_if_running(run_id, "The workflow exceeded its step limit and was stopped.")
            finished = True
            yield sse("error", {"run_id": run_id, "message": "The workflow exceeded its step limit."})
        except DuplicateRunError as error:
            finished = True
            yield sse("error", {"run_id": run_id, "message": str(error)})
        except Exception:
            logger.exception("workflow_failed", extra={"run_id": run_id})
            repo.abort_run_if_running(run_id, UNEXPECTED_ERROR_MESSAGE)
            finished = True
            yield sse("error", {"run_id": run_id, "message": UNEXPECTED_ERROR_MESSAGE})
        finally:
            # Reached without finishing only when the client disconnected mid-stream.
            if not finished:
                repo.abort_run_if_running(run_id, "The client disconnected before the run finished.")
