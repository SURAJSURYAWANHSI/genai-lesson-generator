"""Structured lesson output.

Every field is required with no defaults, so the same model works as a strict JSON schema
on all three vendors. Strings and lists may be empty at this level on purpose: checking
that they are filled is the deterministic validator's job, and that is what catches a
section removed by error injection. Unknown fields, such as a generator trying to mark its
own lesson as passed, are dropped.
"""

import hashlib
import json
from typing import Any

from pydantic import BaseModel, ConfigDict


class _Strict(BaseModel):
    model_config = ConfigDict(extra="ignore")


class LessonComponent(_Strict):
    name: str
    explanation: str


class ProcessStep(_Strict):
    step_number: int
    title: str
    explanation: str


class SourceMaterial(_Strict):
    title: str
    content: str


class PracticalExample(_Strict):
    scenario: str
    starting_input: str
    source_materials: list[SourceMaterial]
    selected_materials: list[str]
    intermediate_step: str
    final_result: str


class WalkthroughStep(_Strict):
    step_number: int
    action: str
    result: str


class TermDefinition(_Strict):
    term: str
    simple_explanation: str


class Misconception(_Strict):
    misconception: str
    correction: str


class KnowledgeQuestion(_Strict):
    number: int
    question: str


class KnowledgeAnswer(_Strict):
    number: int
    answer: str


class Lesson(_Strict):
    title: str
    introduction: str
    what_it_means: str
    why_it_matters: str
    important_components: list[LessonComponent]
    step_by_step_process: list[ProcessStep]
    real_world_analogy: str
    practical_example: PracticalExample
    example_walkthrough: list[WalkthroughStep]
    terminology: list[TermDefinition]
    common_mistakes: list[Misconception]
    summary: str
    key_takeaways: list[str]
    knowledge_check_questions: list[KnowledgeQuestion]
    knowledge_check_answers: list[KnowledgeAnswer]


LESSON_SECTIONS: tuple[str, ...] = tuple(Lesson.model_fields)


def _iter_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _iter_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _iter_strings(item)


def lesson_text(lesson: Lesson | dict[str, Any]) -> str:
    data = lesson.model_dump() if isinstance(lesson, Lesson) else lesson
    return "\n".join(_iter_strings(data))


def word_count(lesson: Lesson | dict[str, Any]) -> int:
    return len(lesson_text(lesson).split())


def content_hash(lesson: Lesson | dict[str, Any]) -> str:
    data = lesson.model_dump() if isinstance(lesson, Lesson) else lesson
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode("utf-8")).hexdigest()


def changed_sections(before: dict[str, Any] | None, after: dict[str, Any]) -> list[str]:
    if before is None:
        return list(LESSON_SECTIONS)
    return [name for name in LESSON_SECTIONS if before.get(name) != after.get(name)]
