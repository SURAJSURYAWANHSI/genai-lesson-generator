"""Topic recognition, normalisation and topic-specific coverage requirements."""

import re
from pathlib import Path

_RAG_PATTERN = re.compile(r"\brag\b|retrieval[\s-]*augmented", re.IGNORECASE)
_REFERENCE_DIR = Path(__file__).resolve().parents[1] / "references"

RAG_COVERAGE: tuple[str, ...] = (
    "What RAG is",
    "Why RAG is useful",
    "What retrieval means",
    "What augmentation means",
    "What generation means",
    "How RAG works step by step",
    "How documents are stored and searched",
    "How retrieved information is provided to an AI model",
    "How the model uses retrieved information to generate answers",
    "A practical example demonstrating the complete process, showing the question, several documents, the document selected, the prompt given to the model and the final answer",
    "RAG limitations and common misconceptions",
)


def is_rag_topic(topic: str) -> bool:
    return bool(_RAG_PATTERN.search(topic))


def normalize_topic(topic: str) -> str:
    """Stable key so differently worded requests share memory."""
    if is_rag_topic(topic):
        return "rag"
    slug = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")
    return slug[:120] or "general"


def coverage_requirements(topic: str) -> tuple[str, ...]:
    return RAG_COVERAGE if is_rag_topic(topic) else ()


def default_reference(topic: str) -> str | None:
    if is_rag_topic(topic):
        return (_REFERENCE_DIR / "rag_reference.md").read_text(encoding="utf-8")
    return None
