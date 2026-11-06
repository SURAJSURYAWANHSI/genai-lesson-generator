"""The mandatory 10-check rubric and the rules that stop it being weakened."""

from typing import Any

from app.core.errors import RubricViolationError
from app.schemas.evaluation import MANDATORY_CRITERION_IDS, CriterionCheck

RUBRIC_DEFINITION: dict[str, Any] = {
    "criteria": [
        {
            "id": "Q01",
            "name": "Accuracy",
            "definition": "Explanations of the subject are factually correct and consistent with the reference material.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q02",
            "name": "Beginner Friendliness",
            "definition": "A learner with no technical background can understand the lesson.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q03",
            "name": "Jargon Explanation",
            "definition": "Technical terms are explained before or when they are introduced.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q04",
            "name": "What It Is",
            "definition": "The lesson clearly explains the core concept.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q05",
            "name": "Why It Matters",
            "definition": "The lesson explains the problem being solved and the importance of the concept.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q06",
            "name": "How It Works",
            "definition": "The lesson provides a logically ordered explanation of the complete workflow.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q07",
            "name": "Practical Example",
            "definition": "A concrete example demonstrates the actual concept rather than merely mentioning it.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q08",
            "name": "Teaching Flow",
            "definition": "The lesson progresses from simple ideas to more complex ideas.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q09",
            "name": "Standalone Completeness",
            "definition": "The learner can understand the topic without requiring external resources.",
            "mandatory": True,
            "additional_guidance": [],
        },
        {
            "id": "Q10",
            "name": "Consistency",
            "definition": "The lesson does not contain contradictory explanations or misleading statements.",
            "mandatory": True,
            "additional_guidance": [],
        },
    ]
}

CRITERION_NAMES: dict[str, str] = {c["id"]: c["name"] for c in RUBRIC_DEFINITION["criteria"]}

# Where a failure usually sits when the evaluator doesn't name specific sections.
DEFAULT_SECTIONS: dict[str, list[str]] = {
    "Q01": ["what_it_means", "important_components", "step_by_step_process"],
    "Q02": ["introduction", "what_it_means", "why_it_matters", "important_components", "step_by_step_process", "summary"],
    "Q03": ["terminology", "important_components", "step_by_step_process"],
    "Q04": ["introduction", "what_it_means"],
    "Q05": ["why_it_matters"],
    "Q06": ["important_components", "step_by_step_process"],
    "Q07": ["practical_example", "example_walkthrough"],
    "Q08": ["introduction", "important_components", "step_by_step_process"],
    "Q09": ["real_world_analogy", "common_mistakes", "summary", "key_takeaways", "knowledge_check_questions", "knowledge_check_answers"],
    "Q10": ["what_it_means", "important_components", "common_mistakes", "summary"],
}


def evaluation_passed(checks: list[CriterionCheck]) -> bool:
    return all(check.status == "PASS" for check in checks)


def validate_rubric_definition(definition: dict[str, Any]) -> None:
    criteria = definition.get("criteria") or []
    ids = [criterion.get("id") for criterion in criteria]
    if sorted(ids) != list(MANDATORY_CRITERION_IDS):
        raise RubricViolationError("A rubric must contain exactly the mandatory criteria Q01 to Q10.")
    for criterion in criteria:
        if criterion.get("mandatory") is not True:
            raise RubricViolationError(f"Criterion {criterion['id']} must stay mandatory.")
        if not str(criterion.get("definition", "")).strip():
            raise RubricViolationError(f"Criterion {criterion['id']} needs a definition.")


def assert_additive_change(old: dict[str, Any], new: dict[str, Any]) -> None:
    """Only additional guidance may be added. Existing rubric text can never change."""
    validate_rubric_definition(new)
    previous = {criterion["id"]: criterion for criterion in old["criteria"]}
    for criterion in new["criteria"]:
        before = previous[criterion["id"]]
        if criterion["definition"] != before["definition"] or criterion["name"] != before["name"]:
            raise RubricViolationError(f"Criterion {criterion['id']} cannot be rewritten by a proposal.")
        kept = criterion.get("additional_guidance", [])
        existing = before.get("additional_guidance", [])
        if kept[: len(existing)] != existing:
            raise RubricViolationError(f"Existing guidance on {criterion['id']} cannot be removed.")
