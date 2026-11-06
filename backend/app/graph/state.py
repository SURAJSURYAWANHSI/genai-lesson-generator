"""Explicit workflow state. Values are JSON-safe so any node's output can be stored or streamed."""

from typing import Any, Literal, TypedDict


class LessonState(TypedDict, total=False):
    # Fields required by the brief.
    run_id: str
    topic: str
    learner_profile: dict[str, Any]
    reference_material: str | None
    current_lesson: dict[str, Any] | None
    current_attempt: int
    maximum_attempts: int
    current_evaluation: dict[str, Any] | None
    evaluation_history: list[dict[str, Any]]
    rejection_log: list[dict[str, Any]]
    revision_feedback: dict[str, Any] | None
    memory_context: dict[str, Any]
    final_status: Literal["PASS", "REJECTED", "ERROR"] | None
    final_lesson: dict[str, Any] | None
    error_message: str | None

    # Fields the workflow also needs.
    topic_key: str
    reference_source: str
    demo_mode: bool
    error_injection: str | None
    persistent_error: bool
    injection_record: dict[str, Any] | None
    current_version_id: str | None
    current_is_injected: bool
    evaluation_meta: dict[str, Any] | None
    retry_decision: Literal["pass", "retry", "exhausted"] | None
    generator_prompt: str
    generator_prompt_version: int
    evaluator_prompt: str
    evaluator_prompt_version: int
    rubric: dict[str, Any]
    rubric_version: int
