"""Controlled defects for proving the evaluator works. Demo/test mode only, never production."""

import copy
from dataclasses import dataclass
from typing import Any, Callable

from app.core.config import Settings
from app.core.errors import InjectionNotAllowedError, InjectionNotApplicableError
from app.prompts.topic_requirements import is_rag_topic

_UNEXPLAINED_SENTENCE = (
    "The retriever compares vector embeddings using cosine similarity inside an "
    "approximate nearest neighbour index."
)
_FALSE_RETRIEVAL = (
    "Retrieval means the AI model invents new facts from its own imagination, without "
    "looking at any documents."
)
_CONTRADICTION = (
    "Remember that RAG never looks at or uses any documents when it answers a question."
)


def _modification(section: str, before: Any, after: Any, description: str) -> dict[str, Any]:
    return {"section": section, "before": before, "after": after, "description": description}


def _missing_term_explanation(lesson: dict[str, Any]) -> dict[str, Any]:
    before = copy.deepcopy(lesson["step_by_step_process"])
    terms = ("embedding", "vector", "cosine", "nearest neighbour")
    removed = [
        item for item in lesson["terminology"]
        if any(term in item["term"].lower() for term in terms)
    ]
    lesson["terminology"] = [item for item in lesson["terminology"] if item not in removed]
    if lesson["step_by_step_process"]:
        step = lesson["step_by_step_process"][0]
        step["explanation"] = f"{step['explanation']} {_UNEXPLAINED_SENTENCE}"
    return _modification(
        "step_by_step_process",
        before,
        lesson["step_by_step_process"],
        f"Added unexplained jargon and removed {len(removed)} related glossary entries.",
    )


def _missing_practical_example(lesson: dict[str, Any]) -> dict[str, Any]:
    before = copy.deepcopy(lesson["practical_example"])
    lesson["practical_example"] = {
        "scenario": "RAG can be used by companies to answer questions from their documents.",
        "starting_input": "",
        "source_materials": [],
        "selected_materials": [],
        "intermediate_step": "",
        "final_result": "",
    }
    lesson["example_walkthrough"] = []
    return _modification(
        "practical_example",
        before,
        lesson["practical_example"],
        "Replaced the worked example with a one-line mention and removed the walkthrough.",
    )


def _incorrect_rag_stage(lesson: dict[str, Any]) -> dict[str, Any]:
    before = lesson["what_it_means"]
    lesson["what_it_means"] = f"{lesson['what_it_means']} {_FALSE_RETRIEVAL}"
    return _modification(
        "what_it_means",
        before,
        lesson["what_it_means"],
        "Added a false explanation of the retrieval stage.",
    )


def _contradictory_statements(lesson: dict[str, Any]) -> dict[str, Any]:
    before = lesson["summary"]
    lesson["summary"] = f"{lesson['summary']} {_CONTRADICTION}"
    return _modification(
        "summary", before, lesson["summary"], "Added a statement contradicting the rest of the lesson."
    )


def _missing_summary(lesson: dict[str, Any]) -> dict[str, Any]:
    before = lesson["summary"]
    lesson["summary"] = ""
    return _modification("summary", before, "", "Removed the summary.")


def _missing_knowledge_answers(lesson: dict[str, Any]) -> dict[str, Any]:
    before = copy.deepcopy(lesson["knowledge_check_answers"])
    lesson["knowledge_check_answers"] = []
    return _modification("knowledge_check_answers", before, [], "Removed all knowledge-check answers.")


@dataclass(frozen=True)
class ErrorType:
    key: str
    label: str
    description: str
    expected_criteria: tuple[str, ...]
    rag_only: bool
    apply: Callable[[dict[str, Any]], dict[str, Any]]


ERROR_TYPES: dict[str, ErrorType] = {
    item.key: item
    for item in (
        ErrorType("missing_term_explanation", "Missing explanation of a technical term",
                  "Adds unexplained jargon to the process and removes its glossary entries.",
                  ("Q03",), True, _missing_term_explanation),
        ErrorType("missing_practical_example", "Missing practical retrieval example",
                  "Replaces the worked example with a one-line mention.",
                  ("Q07",), False, _missing_practical_example),
        ErrorType("incorrect_rag_stage", "Incorrect explanation of a RAG stage",
                  "Adds a false description of the retrieval stage.",
                  ("Q01",), True, _incorrect_rag_stage),
        ErrorType("contradictory_statements", "Contradictory lesson statements",
                  "Adds a statement to the summary that contradicts the lesson.",
                  ("Q10",), True, _contradictory_statements),
        ErrorType("missing_summary", "Missing summary",
                  "Removes the summary.",
                  ("Q09",), False, _missing_summary),
        ErrorType("missing_knowledge_answers", "Missing knowledge-check answers",
                  "Removes every knowledge-check answer.",
                  ("Q09",), False, _missing_knowledge_answers),
    )
}


def assert_injection_allowed(
    settings: Settings, *, demo_mode: bool, error_type: str | None, topic: str
) -> None:
    if error_type is None:
        return
    if settings.is_production:
        raise InjectionNotAllowedError("Error injection is not available in production.")
    if not demo_mode:
        raise InjectionNotAllowedError("Error injection requires demo mode.")
    if ERROR_TYPES[error_type].rag_only and not is_rag_topic(topic):
        raise InjectionNotApplicableError(f"The error type '{error_type}' only applies to RAG lessons.")


def inject_error(error_type: str, lesson: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return a modified copy of the lesson and a record of what changed."""
    modified = copy.deepcopy(lesson)
    return modified, ERROR_TYPES[error_type].apply(modified)
