"""Lesson generator agent. It writes lessons and has no way to mark them as passed."""

from typing import Any

from app.core.errors import InvalidModelOutputError
from app.llm.base import LLMProvider, LLMResult
from app.prompts.generator_prompt import build_generation_prompt, build_revision_prompt
from app.schemas.evaluation import RevisionFeedback
from app.schemas.lesson import Lesson


class LessonGenerator:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    def _call(self, system_prompt: str, prompt: str) -> LLMResult[Lesson]:
        """Malformed or truncated output is retried once, within the same generation attempt."""
        try:
            return self.provider.generate_structured(Lesson, system_prompt, prompt)
        except InvalidModelOutputError:
            return self.provider.generate_structured(Lesson, system_prompt, prompt)

    def generate(
        self,
        *,
        system_prompt: str,
        topic: str,
        learner_profile: dict[str, Any],
        reference_material: str | None,
        memory_guidance: list[str],
    ) -> LLMResult[Lesson]:
        prompt = build_generation_prompt(topic, learner_profile, reference_material, memory_guidance)
        return self._call(system_prompt, prompt)

    def revise(
        self,
        *,
        system_prompt: str,
        topic: str,
        learner_profile: dict[str, Any],
        reference_material: str | None,
        memory_guidance: list[str],
        previous_lesson: dict[str, Any],
        feedback: RevisionFeedback,
    ) -> LLMResult[Lesson]:
        prompt = build_revision_prompt(
            topic,
            learner_profile,
            reference_material,
            memory_guidance,
            previous_lesson,
            feedback.model_dump(),
        )
        return self._call(system_prompt, prompt)
