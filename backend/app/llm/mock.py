"""Clearly labelled mock provider for local development and demos without API keys.

It receives only the prompt text a real model would receive, and never sees error-injection
metadata. Its evaluator is a set of simple rules: enough to exercise the whole pipeline, but
it does NOT represent real semantic judgement. Every evidence string says so.
"""

import json
import re
from typing import Any, TypeVar

from pydantic import BaseModel

from app.core.config import MOCK_MODEL_NAME
from app.core.errors import InvalidModelOutputError
from app.llm.base import LLMProvider, LLMResult
from app.llm.mock_content import generic_lesson, rag_lesson
from app.prompts.topic_requirements import is_rag_topic
from app.schemas.evaluation import LLMCheck, LLMEvaluation
from app.schemas.lesson import LESSON_SECTIONS, Lesson, lesson_text
from app.validators.rubric import CRITERION_NAMES

T = TypeVar("T", bound=BaseModel)

MOCK_EVIDENCE_PREFIX = "[Mock rule-based check] "

_KNOWN_JARGON = (
    "cosine similarity",
    "approximate nearest neighbour",
    "embedding",
    "vector database",
    "chunk",
)
_FALSE_CLAIMS = (
    re.compile(r"retrieval (means|is)[^.]*\b(invent|imagin|make[s]? up|from memory)", re.IGNORECASE),
    re.compile(r"augmentation (means|is)[^.]*\b(delet|remov|retrain)", re.IGNORECASE),
    re.compile(r"generation (means|is)[^.]*\b(search|copy)", re.IGNORECASE),
)
_CONTRADICTIONS = (
    re.compile(r"\brag\b[^.]*\b(never|does not|doesn't|do not)\b[^.]*\b(search|look|use)(s|es)?\b[^.]*\bdocuments?\b", re.IGNORECASE),
)
_MAX_AVERAGE_SENTENCE_WORDS = 30


def _between(text: str, tag: str) -> str | None:
    match = re.search(rf"<{tag}>\s*(.*?)\s*</{tag}>", text, re.DOTALL)
    return match.group(1) if match else None


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


class MockProvider(LLMProvider):
    def __init__(self) -> None:
        super().__init__("mock", MOCK_MODEL_NAME, 0.0, 0.0)

    def generate_structured(
        self, schema: type[T], system_prompt: str, user_prompt: str
    ) -> LLMResult[T]:
        if schema is Lesson:
            parsed: Any = self._write_lesson(user_prompt)
        elif schema is LLMEvaluation:
            parsed = self._evaluate(user_prompt)
        else:
            raise InvalidModelOutputError(f"The mock provider cannot produce {schema.__name__}.")
        input_tokens = _estimate_tokens(system_prompt + user_prompt)
        output_tokens = _estimate_tokens(parsed.model_dump_json())
        return LLMResult(parsed, input_tokens, output_tokens, self.provider_name, self.model_name, 0.0)

    def _write_lesson(self, prompt: str) -> Lesson:
        topic = _between(prompt, "topic") or "this topic"
        canonical = rag_lesson() if is_rag_topic(topic) else generic_lesson(topic)
        previous = _between(prompt, "previous_lesson_json")
        feedback = _between(prompt, "revision_feedback_json")
        if previous is None or feedback is None:
            return Lesson.model_validate(canonical)
        # Repair only what the feedback names. If feedback were ignored, nothing would improve.
        revised = json.loads(previous)
        for section in json.loads(feedback).get("sections_to_revise", []):
            if section in canonical:
                revised[section] = canonical[section]
        return Lesson.model_validate(revised)

    def _evaluate(self, prompt: str) -> LLMEvaluation:
        topic = _between(prompt, "topic") or ""
        lesson_json = _between(prompt, "lesson_json")
        if lesson_json is None:
            raise InvalidModelOutputError("The evaluation prompt contains no lesson.")
        lesson = json.loads(lesson_json)
        rules = {
            "Q01": _check_accuracy,
            "Q02": _check_beginner_friendly,
            "Q03": _check_jargon,
            "Q04": _check_what_it_is,
            "Q05": _check_why_it_matters,
            "Q06": _check_how_it_works,
            "Q07": lambda data: _check_example(data, topic),
            "Q08": _check_flow,
            "Q09": _check_completeness,
            "Q10": _check_consistency,
        }
        return LLMEvaluation(checks=[_to_check(cid, rule(lesson)) for cid, rule in rules.items()])


def _to_check(criterion_id: str, outcome: tuple) -> LLMCheck:
    evidence, reason, correction, sections = outcome
    return LLMCheck(
        criterion_id=criterion_id,
        criterion_name=CRITERION_NAMES[criterion_id],
        status="FAIL" if reason else "PASS",
        evidence=MOCK_EVIDENCE_PREFIX + evidence,
        failure_reason=reason,
        suggested_correction=correction,
        affected_sections=sections,
    )


def _passed(evidence: str) -> tuple:
    return evidence, None, None, []


def _sections_matching(lesson: dict[str, Any], pattern: re.Pattern) -> list[str]:
    return [name for name in LESSON_SECTIONS if pattern.search(lesson_text({name: lesson.get(name)}))]


def _check_accuracy(lesson: dict[str, Any]) -> tuple:
    text = lesson_text(lesson)
    for pattern in _FALSE_CLAIMS:
        match = pattern.search(text)
        if match:
            return (
                f"Found the statement: '{match.group(0)}'.",
                "The lesson describes a stage of the process incorrectly.",
                "Correct the explanation of this stage so that it matches the reference material.",
                _sections_matching(lesson, pattern),
            )
    return _passed("No statement matches the list of known false claims.")


def _check_beginner_friendly(lesson: dict[str, Any]) -> tuple:
    sentences = [s for s in re.split(r"[.!?]+\s", lesson_text(lesson)) if s.strip()]
    average = sum(len(s.split()) for s in sentences) / max(1, len(sentences))
    if average > _MAX_AVERAGE_SENTENCE_WORDS:
        return (
            f"Average sentence length is {average:.0f} words.",
            "Sentences are too long for a beginner reader.",
            "Rewrite long sentences as several short ones.",
            ["introduction", "what_it_means", "important_components", "step_by_step_process"],
        )
    return _passed(f"Average sentence length is {average:.0f} words.")


def _check_jargon(lesson: dict[str, Any]) -> tuple:
    defined = " ".join(item.get("term", "") for item in lesson.get("terminology", [])).lower()
    body = {k: v for k, v in lesson.items() if k != "terminology"}
    text = lesson_text(body).lower()
    undefined = [term for term in _KNOWN_JARGON if term in text and term not in defined]
    if undefined:
        pattern = re.compile("|".join(map(re.escape, undefined)), re.IGNORECASE)
        return (
            f"These terms are used but not defined: {', '.join(undefined)}.",
            "Technical terms appear without a simple explanation.",
            "Explain each of these terms in simple words where it first appears and add it to the terminology section.",
            sorted({"terminology", *_sections_matching(body, pattern)}),
        )
    return _passed("Every term on the known-jargon list that is used has a definition.")


def _check_what_it_is(lesson: dict[str, Any]) -> tuple:
    if not (lesson.get("what_it_means") or "").strip():
        return ("The what_it_means section is empty.", "The core concept is not explained.",
                "Explain the core concept in simple words.", ["what_it_means"])
    return _passed("The what_it_means section has content.")


def _check_why_it_matters(lesson: dict[str, Any]) -> tuple:
    if not (lesson.get("why_it_matters") or "").strip():
        return ("The why_it_matters section is empty.", "The lesson does not say why the concept matters.",
                "Describe the problem being solved and why it matters.", ["why_it_matters"])
    return _passed("The why_it_matters section has content.")


def _check_how_it_works(lesson: dict[str, Any]) -> tuple:
    steps = lesson.get("step_by_step_process") or []
    if len(steps) < 3:
        return (f"The process has {len(steps)} steps.", "The workflow is not fully explained.",
                "Describe the complete workflow in ordered steps.", ["step_by_step_process"])
    return _passed(f"The process has {len(steps)} ordered steps.")


def _check_example(lesson: dict[str, Any], topic: str) -> tuple:
    example = lesson.get("practical_example") or {}
    walkthrough = lesson.get("example_walkthrough") or []
    documents = example.get("source_materials") or []
    selected = example.get("selected_materials") or []
    if is_rag_topic(topic) and (len(documents) < 2 or not selected):
        return (
            f"The example shows {len(documents)} documents and {len(selected)} retrieved documents.",
            "The example does not demonstrate the retrieval stage.",
            "Show a question, multiple documents, the selected document and the final answer.",
            ["practical_example", "example_walkthrough"],
        )
    if len(walkthrough) < 3 or not (example.get("final_result") or "").strip():
        return (
            f"The walkthrough has {len(walkthrough)} steps.",
            "The example is mentioned but not worked through.",
            "Trace the example step by step through to its final result.",
            ["practical_example", "example_walkthrough"],
        )
    return _passed(f"The example has {len(documents)} source materials and {len(walkthrough)} walkthrough steps.")


def _check_flow(lesson: dict[str, Any]) -> tuple:
    if not (lesson.get("introduction") or "").strip():
        return ("The introduction is empty.", "The lesson does not start from a simple idea.",
                "Open with a simple introduction before the technical explanation.", ["introduction"])
    return _passed("The lesson opens with an introduction before the process and example.")


def _check_completeness(lesson: dict[str, Any]) -> tuple:
    missing = [
        name
        for name in ("summary", "key_takeaways", "knowledge_check_questions", "knowledge_check_answers")
        if not lesson.get(name)
    ]
    if missing:
        return (f"These sections are empty: {', '.join(missing)}.", "The lesson is not complete on its own.",
                "Write every missing section.", missing)
    return _passed("Summary, takeaways, questions and answers are all present.")


def _check_consistency(lesson: dict[str, Any]) -> tuple:
    text = lesson_text(lesson)
    for pattern in _CONTRADICTIONS:
        match = pattern.search(text)
        if match:
            return (
                f"Found the statement: '{match.group(0)}'.",
                "This statement contradicts the rest of the lesson.",
                "Remove the contradictory statement so the lesson gives one consistent explanation.",
                _sections_matching(lesson, pattern),
            )
    return _passed("No statement matches the list of known contradictions.")
