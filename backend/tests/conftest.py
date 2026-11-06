"""Test setup. Every test gets its own database, and no test needs an API key or network."""

import copy
import json
import re
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_run_service
from app.core.config import get_settings
from app.core.rate_limit import reset_rate_limit
from app.db.migrate import run_migrations
from app.db.session import reset_engine
from app.llm.base import LLMProvider, LLMResult
from app.llm.factory import Providers
from app.llm.mock import MockProvider
from app.llm.mock_content import rag_lesson
from app.schemas.api import GenerateLessonRequest
from app.schemas.evaluation import LLMCheck, LLMEvaluation
from app.schemas.lesson import Lesson
from app.services.run_service import RunService
from app.validators.rubric import CRITERION_NAMES

RAG_TOPIC = "Introduction to RAG"


@pytest.fixture(autouse=True)
def isolated_environment(tmp_path, monkeypatch) -> Iterator[None]:
    # Explicit values take priority over any developer .env file.
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("EVALUATOR_PROVIDER", "mock")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "1000")
    monkeypatch.setenv("LOG_LEVEL", "CRITICAL")
    get_settings.cache_clear()
    get_run_service.cache_clear()
    reset_engine()
    reset_rate_limit()
    run_migrations()
    yield
    reset_engine()
    get_settings.cache_clear()
    get_run_service.cache_clear()


def passing_evaluation() -> LLMEvaluation:
    return LLMEvaluation(
        checks=[
            LLMCheck(
                criterion_id=cid,
                criterion_name=name,
                status="PASS",
                evidence=f"The lesson meets {name}.",
                failure_reason=None,
                suggested_correction=None,
                affected_sections=[],
            )
            for cid, name in CRITERION_NAMES.items()
        ]
    )


def failing_evaluation(*criteria: str, sections: list[str] | None = None) -> LLMEvaluation:
    evaluation = passing_evaluation()
    for check in evaluation.checks:
        if check.criterion_id in criteria:
            check.status = "FAIL"
            check.evidence = f"Evidence of the problem with {check.criterion_id}."
            check.failure_reason = f"{check.criterion_id} is not met by this lesson."
            check.suggested_correction = f"Change the lesson so that it meets {check.criterion_id}."
            check.affected_sections = sections if sections is not None else ["practical_example"]
    return evaluation


class ScriptedProvider(LLMProvider):
    """Returns queued responses in order and records every prompt it receives."""

    def __init__(self, responses: list) -> None:
        super().__init__("scripted", "scripted-model", 1.0, 2.0)
        self.responses = list(responses)
        self.prompts: list[str] = []
        self.system_prompts: list[str] = []

    def generate_structured(self, schema, system_prompt, user_prompt) -> LLMResult:
        self.prompts.append(user_prompt)
        self.system_prompts.append(system_prompt)
        response = self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]
        if isinstance(response, Exception):
            raise response
        return LLMResult(response, 100, 50, self.provider_name, self.model_name, self.estimate_cost(100, 50))


@pytest.fixture
def lesson() -> Lesson:
    return Lesson.model_validate(rag_lesson())


@pytest.fixture
def lesson_dict() -> dict:
    return copy.deepcopy(rag_lesson())


@pytest.fixture
def make_service() -> Callable[..., RunService]:
    def build(generator: list | None = None, evaluator: list | None = None) -> RunService:
        return RunService(
            get_settings(),
            Providers(
                generator=ScriptedProvider(generator) if generator is not None else MockProvider(),
                evaluator=ScriptedProvider(evaluator) if evaluator is not None else MockProvider(),
            ),
        )

    return build


@pytest.fixture
def run_lesson() -> Callable[..., dict]:
    def execute(service: RunService, **request) -> dict:
        request.setdefault("topic", RAG_TOPIC)
        return service.run(service.prepare(GenerateLessonRequest(**request)))

    return execute


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import create_app

    with TestClient(create_app(), raise_server_exceptions=False) as test_client:
        yield test_client


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events = []
    for block in body.strip().split("\n\n"):
        match = re.match(r"event: (\w+)\ndata: (.*)", block, re.DOTALL)
        if match:
            events.append((match.group(1), json.loads(match.group(2))))
    return events
