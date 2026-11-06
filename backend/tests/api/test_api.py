"""HTTP behaviour, against the real application with the mock provider."""

import uuid

import pytest
from pydantic import ValidationError

from app.api.dependencies import get_run_service
from app.core.config import get_settings
from app.core.errors import ProviderError
from app.schemas.api import GenerateLessonRequest
from tests.conftest import RAG_TOPIC, parse_sse

GENERATE = "/api/v1/lessons/generate"
DEMO = {"topic": RAG_TOPIC, "demo_mode": True, "error_injection": "missing_practical_example"}


def generate(client, **body):
    return client.post(GENERATE, json={"topic": RAG_TOPIC, **body})


def test_health_reports_configuration_without_secrets(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-very-secret-value")
    get_settings.cache_clear()
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok" and body["database"] == "ok"
    assert body["mock_mode"] is True and body["demo_allowed"] is True
    assert len(body["error_types"]) == 6
    assert "sk-very-secret-value" not in response.text and "api_key" not in response.text


def test_generate_response_matches_the_documented_shape(client):
    response = generate(client)
    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {"run_id", "status", "attempts", "final_lesson", "evaluation", "rejection_log", "memory_used"}
    assert body["status"] == "PASS" and body["attempts"] == 1
    assert len(body["evaluation"]["checks"]) == 10


def test_api_schema_applies_learner_defaults():
    request = GenerateLessonRequest(topic=RAG_TOPIC)
    assert request.learner_profile.education == "12th-grade graduate"
    assert request.learner_profile.english_level == "basic"
    assert request.learner_profile.programming_experience == "None"
    assert request.max_retries == 2


@pytest.mark.parametrize(
    "body",
    [
        {"topic": "ab"},
        {"topic": "   abc   " * 100},
        {"topic": RAG_TOPIC, "max_retries": 3},
        {"topic": RAG_TOPIC, "max_retries": -1},
        {"topic": RAG_TOPIC, "error_injection": "missing_summary"},
        {"topic": RAG_TOPIC, "demo_mode": True, "error_injection": "not_a_real_type"},
        {"topic": RAG_TOPIC, "demo_mode": True, "persistent_error": True},
        {"topic": RAG_TOPIC, "learner_profile": {"english_level": "fluent"}},
        {"topic": RAG_TOPIC, "unknown_field": 1},
        {"topic": RAG_TOPIC, "run_id": "not-a-uuid"},
        {},
    ],
)
def test_api_schemas_validate_correctly(client, body):
    assert client.post(GENERATE, json=body).status_code == 422


def test_reference_material_size_is_limited(client):
    limit = get_settings().max_reference_chars
    assert generate(client, reference_material="x" * (limit + 1)).status_code == 422
    assert generate(client, reference_material="x" * 100).status_code == 200


def test_duplicate_run_ids_are_prevented(client):
    run_id = str(uuid.uuid4())
    assert generate(client, run_id=run_id).status_code == 200
    second = generate(client, run_id=run_id)
    assert second.status_code == 409
    assert "already exists" in second.json()["detail"]
    assert client.post(f"{GENERATE}/stream", json={"topic": RAG_TOPIC, "run_id": run_id}).status_code == 409


def test_run_endpoints_after_demo(client):
    run_id = client.post(GENERATE, json=DEMO).json()["run_id"]

    detail = client.get(f"/api/v1/lessons/{run_id}").json()
    assert detail["status"] == "PASS" and detail["final_version"] == 2
    assert detail["error_injection"]["detected"] is True

    evaluations = client.get(f"/api/v1/lessons/{run_id}/evaluations").json()
    assert [item["status"] for item in evaluations] == ["FAIL", "PASS"]

    rejections = client.get(f"/api/v1/lessons/{run_id}/rejections").json()
    assert rejections[0]["failed_criterion_ids"] == ["Q07"]

    versions = client.get(f"/api/v1/lessons/{run_id}/versions").json()
    assert [item["version"] for item in versions] == [1, 2]

    history = client.get("/api/v1/lessons/history").json()
    assert history["total"] == 1 and history["items"][0]["run_id"] == run_id


def test_unknown_and_malformed_run_ids(client):
    assert client.get(f"/api/v1/lessons/{uuid.uuid4()}").status_code == 404
    assert client.get(f"/api/v1/lessons/{uuid.uuid4()}/rejections").status_code == 404
    assert client.get("/api/v1/lessons/not-a-uuid").status_code == 422


def test_streaming_reports_the_whole_workflow(client):
    with client.stream("POST", f"{GENERATE}/stream", json=DEMO) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        events = parse_sse(response.read().decode())
    names = [name for name, _ in events]
    assert names[0] == "started" and names[-1] == "complete"
    stages = [data for name, data in events if name == "stage"]
    completed = [stage["node"] for stage in stages if stage["event"] == "complete"]
    assert completed == [
        "initialize_run", "load_memory",
        "generate_lesson", "evaluate_lesson", "record_evaluation", "update_memory", "decide_retry",
        "prepare_revision_feedback",
        "generate_lesson", "evaluate_lesson", "record_evaluation", "update_memory", "decide_retry",
        "finalize_lesson",
    ]
    started = [stage["node"] for stage in stages if stage["event"] == "start"]
    assert started == completed, "Each stage reports both its start and its completion."
    evaluate = next(stage for stage in stages if stage["node"] == "evaluate_lesson" and stage["event"] == "complete")
    assert evaluate["failed_criteria"] == ["Q07"]
    final = events[-1][1]
    assert final["status"] == "PASS" and final["attempts"] == 2


def test_injection_refused_in_production(client, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("EVALUATOR_PROVIDER", "anthropic")
    get_settings.cache_clear()
    get_run_service.cache_clear()
    response = client.post(GENERATE, json=DEMO)
    assert response.status_code == 403
    assert "not available in production" in response.json()["detail"]


def test_rag_only_injection_on_other_topic_is_422(client):
    body = {"topic": "Fractions", "demo_mode": True, "error_injection": "incorrect_rag_stage"}
    assert client.post(GENERATE, json=body).status_code == 422


def test_rate_limit(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "2")
    get_settings.cache_clear()
    assert generate(client).status_code == 200
    assert generate(client).status_code == 200
    limited = generate(client)
    assert limited.status_code == 429
    assert "Retry-After" in limited.headers


def test_feedback_endpoint(client):
    run_id = generate(client).json()["run_id"]
    url = f"/api/v1/lessons/{run_id}/feedback"
    response = client.post(url, json={"rating": "needs_changes", "comment": "Add a school example.", "criterion_id": "Q07"})
    assert response.status_code == 201
    assert client.post(url, json={"rating": "bad", "comment": "x"}).status_code == 422
    assert client.post(url, json={"rating": "approve", "comment": "x", "criterion_id": "Q99"}).status_code == 422
    assert client.post(f"/api/v1/lessons/{uuid.uuid4()}/feedback", json={"rating": "approve", "comment": "x"}).status_code == 404
    records = client.get("/api/v1/memory", params={"memory_type": "human_feedback"}).json()
    assert records[0]["content"] == "Add a school example."


def test_memory_endpoints(client):
    client.post(GENERATE, json=DEMO)
    patterns = client.get("/api/v1/memory/patterns").json()
    assert patterns["failure_patterns"][0]["criterion_id"] == "Q07"
    assert patterns["correction_strategies"][0]["criterion_id"] == "Q07"
    assert patterns["active_prompt_versions"] == {"evaluator": 1, "generator": 1}
    assert client.get("/api/v1/memory").json()


def test_evolution_lifecycle_over_http(client):
    for _ in range(3):
        client.post(GENERATE, json=DEMO)
    proposals = client.get("/api/v1/evolution/proposals", params={"status": "PENDING"}).json()
    proposal = next(item for item in proposals if item["proposal_type"] == "generator_prompt")
    url = f"/api/v1/evolution/proposals/{proposal['id']}"
    assert proposal["evidence"]["demo_failures"] == 3

    assert client.post(f"{url}/approve", json={}).status_code == 422, "A reviewer must be named."
    assert client.post(f"{url}/approve", json={"reviewer": "alex"}).json()["status"] == "APPROVED"
    assert client.post(f"{url}/approve", json={"reviewer": "alex"}).status_code == 409

    prompts = client.get("/api/v1/evolution/prompts").json()
    assert max(item["version"] for item in prompts if item["name"] == "generator" and item["is_active"]) == 2

    assert client.post(f"{url}/rollback", json={"reviewer": "alex"}).json()["status"] == "ROLLED_BACK"
    prompts = client.get("/api/v1/evolution/prompts").json()
    assert max(item["version"] for item in prompts if item["name"] == "generator" and item["is_active"]) == 1

    assert client.get("/api/v1/evolution/analysis").json()["demo_runs"] == 3
    assert client.get("/api/v1/evolution/metrics").json()[0]["runs"] == 3
    assert client.post("/api/v1/evolution/analyze").status_code == 200
    assert client.post(f"/api/v1/evolution/proposals/{uuid.uuid4()}/reject", json={"reviewer": "a"}).status_code == 404


def test_stats_for_the_dashboard(client):
    client.post(GENERATE, json=DEMO)
    client.post(GENERATE, json={**DEMO, "persistent_error": True})
    stats = client.get("/api/v1/stats").json()
    assert stats["total_runs"] == 2
    assert stats["passing_lessons"] == 1 and stats["rejected_lessons"] == 1
    assert stats["average_attempts"] == 2.5
    assert stats["rubric_failures"][0]["criterion_id"] == "Q07"
    assert len(stats["recent_runs"]) == 2


def test_internal_errors_do_not_expose_details(client, monkeypatch):
    from app.api.routes import system

    def explode():
        raise RuntimeError("secret database password in a stack trace")

    monkeypatch.setattr(system.repo, "get_stats", explode)
    response = client.get("/api/v1/stats")
    assert response.status_code == 500
    assert "secret" not in response.text and "Traceback" not in response.text
    assert response.json()["request_id"]


def test_provider_failure_returns_a_safe_error_run(client, monkeypatch):
    service = get_run_service()

    def fail(*_args, **_kwargs):
        raise ProviderError("The mock provider request failed (RateLimitError).")

    monkeypatch.setattr(service.providers.generator, "generate_structured", fail)
    body = generate(client).json()
    assert body["status"] == "ERROR"
    assert body["final_lesson"] is None
    assert "RateLimitError" in body["error_message"]


def test_cors_allows_only_configured_origins(client):
    allowed = client.options(GENERATE, headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    blocked = client.options(GENERATE, headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in blocked.headers


def test_openapi_documentation_is_available(client):
    assert client.get("/docs").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    for path in (
        "/api/v1/lessons/generate", "/api/v1/lessons/generate/stream", "/api/v1/lessons/{run_id}",
        "/api/v1/lessons/{run_id}/evaluations", "/api/v1/lessons/{run_id}/rejections",
        "/api/v1/lessons/{run_id}/versions", "/api/v1/lessons/history", "/api/v1/memory",
        "/api/v1/memory/patterns", "/api/v1/evolution/proposals",
        "/api/v1/evolution/proposals/{proposal_id}/approve", "/api/v1/evolution/proposals/{proposal_id}/reject",
        "/api/v1/lessons/{run_id}/feedback", "/api/v1/health",
    ):
        assert path in paths, path


def test_validation_error_is_a_pydantic_error_type():
    with pytest.raises(ValidationError):
        GenerateLessonRequest(topic=RAG_TOPIC, error_injection="missing_summary")
