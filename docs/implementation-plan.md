# Implementation plan and traceability

## Phases

| # | Work | Gate |
|---|---|---|
| 0 | Repository and documentation skeleton | Structure in place |
| 1 | Configuration, logging, models, migration, schemas | Migration applies to an empty database, with no drift |
| 2 | Providers, generator, evaluator, validators, retry agent | Unit tests pass |
| 3 | Workflow, persistence, memory, evolution, error injection | Workflow tests pass |
| 4 | API, streaming, security | Required tests pass; API docs load |
| 5 | Dashboard | Production build passes; checked in a browser |
| 6 | Docker, documentation, demo | All 12 demo steps confirmed |

Results for each gate are in the [session logs](sessions/README.md).

## Requirements to code

| Brief section | Implemented in |
|---|---|
| 3-4 Workflow and LangGraph | `backend/app/graph/workflow.py`, `backend/app/graph/state.py` |
| 5 Lesson generator | `backend/app/agents/generator.py`, `backend/app/prompts/generator_prompt.py`, `backend/app/schemas/lesson.py` |
| 6 Evaluation engine | `backend/app/agents/evaluator.py`, `backend/app/validators/rubric.py`, `backend/app/prompts/evaluator_prompt.py` |
| 7 Deterministic validation | `backend/app/validators/deterministic.py` |
| 8 Rejection log | `rejection_logs` table, `backend/app/services/run_repository.py`, `GET /lessons/{id}/rejections` |
| 9 Regeneration | `backend/app/agents/retry_agent.py` |
| 10 Memory | `backend/app/memory/memory_store.py` |
| 11 Self-evolution | `backend/app/memory/evolution.py` |
| 12 Error injection | `backend/app/services/error_injection.py` |
| 13 Database | `backend/app/db/models.py`, `backend/alembic/versions/0001_initial_schema.py` |
| 14 API | `backend/app/api/routes/`, `backend/app/schemas/api.py` |
| 15 Dashboard | `frontend/` |
| 16 Demo | `scripts/run_demo.py`, one-click action in the dashboard |
| 17 Tests | `backend/tests/` |
| 18-19 Documentation | `README.md`, `docs/` |
| 20 Security | `backend/app/core/`, `backend/app/main.py`, request limits in `backend/app/schemas/api.py` |

## Required tests

| Requirement | Test |
|---|---|
| Generator returns valid structured lesson | `test_generator_returns_valid_structured_lesson` |
| Evaluator returns all required criteria | `test_evaluator_returns_all_required_criteria` |
| Deterministic validator catches missing sections | `test_deterministic_validator_catches_missing_sections` |
| Missing practical example fails Q07 | `test_missing_practical_example_fails_q07` |
| Injected error is detected | `test_injected_error_is_detected` |
| Retry happens after failure | `test_retry_happens_after_failure` |
| Regeneration receives evaluator feedback | `test_regeneration_receives_evaluator_feedback` |
| Successful regeneration terminates workflow | `test_successful_regeneration_terminates_workflow` |
| Maximum retries are enforced | `test_maximum_retries_are_enforced` |
| Retry exhaustion produces rejection | `test_retry_exhaustion_produces_rejection` |
| Rejection logs are persisted | `test_rejection_logs_are_persisted_with_every_required_field` |
| Memory survives application restart | `test_memory_survives_application_restart` |
| Memory retrieval influences generator guidance | `test_memory_retrieval_influences_generator_guidance` |
| Mandatory rubric cannot be bypassed | `test_mandatory_rubric_cannot_be_bypassed` |
| PASS requires all mandatory checks | `test_pass_requires_all_mandatory_checks` |
| Invalid evaluator output is handled safely | `test_invalid_evaluator_output_is_handled_safely` |
| API schemas validate correctly | `test_api_schemas_validate_correctly` |
| Provider failures are handled | `test_provider_failures_are_handled` |
| Duplicate run IDs are prevented | `test_duplicate_run_ids_are_prevented` |
| Workflow cannot enter an infinite loop | `test_workflow_cannot_enter_an_infinite_loop` |

## Scope decisions

- **No RAG pipeline.** RAG is the lesson topic, so no vector database or embeddings were added.
- **No LangGraph checkpointer.** The database is the persistent mechanism. See [ADR 0007](adr/0007-database-persistence-over-checkpointer.md).
- **No user authentication.** It isn't in the brief, and it's listed as a limitation.
- **Additions to the brief's endpoints:** rollback, analysis, metrics, prompt versions and stats, which the dashboard and rollback requirement need.
