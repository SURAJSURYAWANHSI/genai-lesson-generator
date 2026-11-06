"""Turns a failed evaluation into structured feedback and limits revisions to failed sections.

This is deterministic on purpose: the evaluator already identified the problems, so another
model call here would add cost without adding information.
"""

from typing import Any

from app.schemas.evaluation import EvaluationResult, FailedCriterionFeedback, RevisionFeedback
from app.schemas.lesson import LESSON_SECTIONS, Lesson, changed_sections
from app.validators.rubric import DEFAULT_SECTIONS

REVISION_INSTRUCTIONS: dict[str, str] = {
    "Q01": "Correct the factual errors and keep the explanation consistent with the reference material.",
    "Q02": "Simplify the sentence structure and replace difficult words with common ones.",
    "Q03": "Explain each technical term in simple words at the point where it first appears.",
    "Q04": "State clearly and simply what the concept is before going further.",
    "Q05": "Describe the problem being solved and why the concept matters to the learner.",
    "Q06": "Lay out the complete workflow as ordered steps with no stage missing.",
    "Q07": "Add a concrete worked example that shows every stage with real content, not a description of one.",
    "Q08": "Reorganise the explanation into logical steps, moving from simple ideas to harder ones.",
    "Q09": "Add whatever is missing so the learner needs nothing outside this lesson.",
    "Q10": "Remove the contradiction or misleading claim so the lesson gives one consistent explanation.",
}


def build_revision_feedback(evaluation: EvaluationResult, attempt: int) -> RevisionFeedback:
    failed: list[FailedCriterionFeedback] = []
    to_revise: list[str] = []
    for check in evaluation.failed_checks:
        targets = [name for name in check.affected_sections if name in LESSON_SECTIONS]
        targets = targets or DEFAULT_SECTIONS[check.criterion_id]
        to_revise.extend(targets)
        failed.append(
            FailedCriterionFeedback(
                criterion_id=check.criterion_id,
                criterion_name=check.criterion_name,
                evidence=check.evidence,
                failure_reason=check.failure_reason or "",
                suggested_correction=check.suggested_correction or "",
                instruction=REVISION_INSTRUCTIONS[check.criterion_id],
                target_sections=targets,
            )
        )
    revise = [name for name in LESSON_SECTIONS if name in to_revise]
    return RevisionFeedback(
        attempt=attempt,
        failed_criteria=failed,
        sections_to_revise=revise,
        sections_to_preserve=[name for name in LESSON_SECTIONS if name not in revise],
    )


def merge_revision(
    previous: dict[str, Any], revised: Lesson, sections_to_revise: list[str]
) -> tuple[dict[str, Any], list[str]]:
    """Take only the targeted sections from the revision, so nothing else can drift."""
    revised_data = revised.model_dump()
    merged = {
        name: revised_data[name] if name in sections_to_revise else previous[name]
        for name in LESSON_SECTIONS
    }
    return merged, changed_sections(previous, merged)
