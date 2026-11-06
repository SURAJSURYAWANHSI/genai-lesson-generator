"""Independent evaluator: deterministic validators plus a separately prompted model.

A deterministic issue always forces its criterion to FAIL, whatever the model says. Output
that breaks the rules gets one corrective retry and then fails closed with an error.
"""

from dataclasses import dataclass
from typing import Any

from app.core.errors import EvaluatorOutputError, InvalidModelOutputError
from app.llm.base import LLMProvider
from app.prompts.evaluator_prompt import build_correction_prompt, build_evaluation_prompt
from app.schemas.evaluation import (
    CriterionCheck,
    DeterministicIssue,
    EvaluationResult,
    LLMEvaluation,
)
from app.schemas.lesson import LESSON_SECTIONS, Lesson
from app.validators.deterministic import validate_evaluation_output, validate_lesson
from app.validators.rubric import CRITERION_NAMES

MAX_EVALUATOR_CALLS = 2


@dataclass(frozen=True)
class EvaluationOutcome:
    result: EvaluationResult
    input_tokens: int
    output_tokens: int
    cost_usd: float | None
    llm_attempts: int
    provider: str
    model: str


def merge_checks(
    evaluation: LLMEvaluation, issues: list[DeterministicIssue]
) -> list[CriterionCheck]:
    by_criterion: dict[str, list[DeterministicIssue]] = {}
    for issue in issues:
        by_criterion.setdefault(issue.criterion_id, []).append(issue)

    merged: list[CriterionCheck] = []
    for check in sorted(evaluation.checks, key=lambda item: item.criterion_id):
        sections = [name for name in check.affected_sections if name in LESSON_SECTIONS]
        name = CRITERION_NAMES[check.criterion_id]
        found = by_criterion.get(check.criterion_id)
        if not found:
            merged.append(
                CriterionCheck(**{**check.model_dump(), "criterion_name": name, "affected_sections": sections})
            )
            continue
        messages = " ".join(issue.message for issue in found)
        corrections = " ".join(dict.fromkeys(issue.suggested_correction for issue in found))
        llm_failed = check.status == "FAIL"
        merged.append(
            CriterionCheck(
                criterion_id=check.criterion_id,
                criterion_name=name,
                status="FAIL",
                evidence=f"Deterministic validator: {messages} Model evidence: {check.evidence}",
                failure_reason=f"{messages} {check.failure_reason}" if llm_failed else messages,
                suggested_correction=f"{corrections} {check.suggested_correction}" if llm_failed else corrections,
                affected_sections=list(dict.fromkeys([*sections, *(issue.section for issue in found)])),
                source="llm+deterministic" if llm_failed else "deterministic",
            )
        )
    return merged


class LessonEvaluator:
    def __init__(self, provider: LLMProvider, min_words: int, max_words: int) -> None:
        self.provider = provider
        self.min_words = min_words
        self.max_words = max_words

    def evaluate(
        self,
        *,
        lesson: dict[str, Any],
        topic: str,
        learner_profile: dict[str, Any],
        reference_material: str | None,
        rubric: dict[str, Any],
        system_prompt: str,
        evaluator_notes: list[str],
    ) -> EvaluationOutcome:
        issues = validate_lesson(
            Lesson.model_validate(lesson), topic, min_words=self.min_words, max_words=self.max_words
        )
        base_prompt = build_evaluation_prompt(
            topic, learner_profile, reference_material, rubric, lesson, evaluator_notes
        )
        prompt = base_prompt
        input_tokens = output_tokens = 0
        cost: float | None = 0.0
        errors: list[str] = []

        for call in range(1, MAX_EVALUATOR_CALLS + 1):
            try:
                response = self.provider.generate_structured(LLMEvaluation, system_prompt, prompt)
            except InvalidModelOutputError as error:
                errors = [str(error)]
            else:
                input_tokens += response.input_tokens
                output_tokens += response.output_tokens
                cost = None if cost is None or response.cost_usd is None else cost + response.cost_usd
                errors = validate_evaluation_output(response.parsed)
                if not errors:
                    return EvaluationOutcome(
                        result=EvaluationResult(
                            checks=merge_checks(response.parsed, issues),
                            deterministic_issues=issues,
                        ),
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        cost_usd=cost,
                        llm_attempts=call,
                        provider=response.provider,
                        model=response.model,
                    )
            prompt = build_correction_prompt(base_prompt, errors)

        raise EvaluatorOutputError(
            "The evaluator's output stayed invalid after a corrective retry, so the lesson "
            f"cannot be published. First problem: {errors[0]}"
        )
