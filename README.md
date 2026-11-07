# Self-Evaluating Lesson Generator

An agentic content quality system. It writes a complete beginner lesson, has an independent evaluator judge it against a strict 10-point rubric, rejects failures, regenerates from structured feedback, learns across runs, and publishes only when every check passes.

> RAG (Retrieval-Augmented Generation) is the **topic** of the assessment lesson. This project is not itself a RAG pipeline, so it has no vector database or embeddings.

**Documentation:** [index](docs/README.md) · [architecture](docs/architecture.md) · [design decisions](docs/design-decisions.md) · [ADRs](docs/adr/README.md) · [session logs](docs/sessions/README.md) · [demo walkthrough](docs/guides/demo-walkthrough.md)

## Quick start

Requires Python 3.11+, Node 22 and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env                 # then set GOOGLE_API_KEY in .env

cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS or Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# In a second terminal
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

On Windows PowerShell, if scripts are blocked, use `npm.cmd install` and `npm.cmd run dev`.

## 1. Project overview

Given a topic and learner profile, the system:

1. Loads lessons learned from earlier runs.
2. Generates a structured 15-section lesson.
3. Evaluates it with deterministic validators and a separately prompted model.
4. On any failure, logs the rejection, builds targeted feedback and regenerates, up to two retries.
5. Publishes the lesson if all 10 checks pass, or rejects it and keeps it available for inspection.
6. Updates its memory, and proposes improvements that a person can approve.

A React dashboard shows each stage as it happens.

## 2. Problem statement

Language models write fluent text that can still be wrong, too difficult or incomplete, and a beginner can't tell. Generating content is easy. Knowing it is fit to publish is the hard part. This project treats quality as a gate that must be passed, with evidence for every verdict, a limit on retries, and a full audit trail.

## 3. System architecture

- **FastAPI** exposes REST and Server-Sent Events.
- **LangGraph** runs the workflow as an explicit state machine.
- **Agents:** generator (writes), evaluator (judges), retry agent (turns failures into targeted feedback).
- **Provider layer:** one interface over Gemini (default), OpenAI and Claude, set by environment variables.
- **SQLAlchemy and Alembic:** ten tables, on SQLite by default, with a schema designed to be Postgres-portable.
- **Memory and evolution:** counted patterns from past runs, and human-approved, versioned prompt changes.

Details are in [docs/architecture.md](docs/architecture.md).

## 4. Architecture diagram

```mermaid
flowchart LR
    UI["React dashboard"] -->|"REST and SSE"| API["FastAPI"]
    API --> G["LangGraph workflow"]
    G --> GEN["Generator"]
    G --> EVAL["Evaluator + validators"]
    G --> RETRY["Retry agent"]
    GEN --> P["Provider layer"]
    EVAL --> P
    P --> LLM["Gemini (default), OpenAI, Claude"]
    G --> MEM["Memory"]
    API --> EVO["Self-evolution"]
    G --> EVO
    MEM --> DB[("SQLite or PostgreSQL")]
    EVO --> DB
    G --> DB
```

## 5. Agent workflow diagram

```mermaid
flowchart TD
    S([START]) --> I[initialize_run]
    I --> L[load_memory]
    L --> G[generate_lesson]
    G -->|ok| E[evaluate_lesson]
    G -->|error| R[reject_lesson]
    E -->|ok| RE[record_evaluation]
    E -->|error| R
    RE --> U[update_memory]
    U --> D{decide_retry}
    D -->|all 10 pass| F[finalize_lesson]
    D -->|fail, attempts left| P[prepare_revision_feedback]
    D -->|fail, no attempts left| R
    P --> G
    F --> X([END: PASS])
    R --> Y([END: REJECTED or ERROR])
```

Maximum generations: 3 (1 initial + 2 retries). Every generated lesson is evaluated.

## 6. Technology stack

| Area | Technology |
|---|---|
| Backend | Python 3.13 (3.11+ supported), FastAPI, LangGraph, LangChain chat models, Pydantic v2, SQLAlchemy, Alembic |
| Database | SQLite, with a PostgreSQL driver and Compose profile included |
| AI | Gemini by default; OpenAI and Claude through the same interface |
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Router, Lucide |
| Infrastructure | Docker, Docker Compose, environment variables, JSON structured logs |
| Testing | pytest, httpx |

Beyond the brief's list, the project adds only `pydantic-settings`, `psycopg`, `react-markdown` and the libraries shadcn/ui itself uses.

## 7. Repository structure

```
.
├── backend/
│   ├── alembic/              Database migrations
│   ├── app/
│   │   ├── agents/           generator, evaluator, retry_agent
│   │   ├── api/routes/       lessons, memory, evolution, system
│   │   ├── core/             config, logging, errors, rate limit
│   │   ├── db/               models, session, migration runner
│   │   ├── graph/            state, workflow
│   │   ├── llm/              provider interface, LangChain adapters, mock
│   │   ├── memory/           memory_store, evolution
│   │   ├── prompts/          generator and evaluator prompts, topic requirements
│   │   ├── references/       curated RAG reference
│   │   ├── schemas/          lesson, evaluation, API
│   │   ├── services/         error_injection, run_repository, run_service
│   │   └── validators/       rubric, deterministic
│   └── tests/                unit, integration, api
├── frontend/                 React dashboard
├── docs/
│   ├── adr/                  Architecture Decision Records
│   ├── api/openapi.json      Exported API schema
│   ├── guides/               Demo walkthrough
│   ├── sessions/             Development session logs
│   ├── architecture.md
│   ├── design-decisions.md
│   └── implementation-plan.md
├── outputs/demo/             Saved demo results
├── scripts/run_demo.py       Runs and checks the assessment demo
├── docker-compose.yml
└── .env.example
```

## 8. Installation instructions

**Backend:**

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS or Linux: .venv/bin/pip
```

**Frontend:**

```bash
cd frontend
npm install
```

## 9. Environment setup

Copy `.env.example` to `.env`. Only the key is required:

```ini
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your-key          # GEMINI_API_KEY also works
GENERATOR_MODEL=gemini-3.6-flash
EVALUATOR_MODEL=gemini-3.6-flash
```

**To change something later,** edit `.env` and restart the backend. No code changes:

| Change | Set |
|---|---|
| A different Gemini key | `GOOGLE_API_KEY` |
| A newer Gemini model | `GENERATOR_MODEL`, `EVALUATOR_MODEL` |
| Claude | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`; also clear or update the two model settings |
| OpenAI | `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, and both model settings |
| A different vendor for evaluation | `EVALUATOR_PROVIDER`, its key, `EVALUATOR_MODEL` |
| Try it without any key | `LLM_PROVIDER=mock` |

If the key is missing, the backend stops at startup and says so. It never falls back to mock on its own. `.env` is ignored by git, and keys never reach the frontend.

**Where everything lives:** the app runs on this machine and stores everything in this folder.

| What | Where |
|---|---|
| Runs, lessons, evaluations, rejection logs, memory, prompt versions, proposals | `backend/data/lessons.db` (SQLite) |
| Demo results | `outputs/demo/` |
| API key and settings | `.env` |

The only data that leaves the machine is what the model needs: when a real provider is active, the topic, learner profile, reference material, lesson text and memory guidance are sent to that provider (Google, for Gemini) to generate and evaluate lessons. With `LLM_PROVIDER=mock`, nothing leaves the machine. LangChain's optional LangSmith tracing stays off unless you turn it on with its own environment variables, so don't set those.

## 10. Running the backend

```bash
cd backend
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Migrations run automatically at startup. Interactive API docs are at <http://localhost:8000/docs>.

## 11. Running the frontend

```bash
cd frontend
npm run dev
```

Open <http://localhost:5173>. The dev server proxies `/api` to port 8000.

## 12. Running tests

```bash
cd backend
.venv/Scripts/python -m pytest
```

Tests need no API key or network access: they use scripted responses and an isolated database for each test. Tests cover the system's logic, so they say nothing about real model quality. [The implementation plan](docs/implementation-plan.md) maps each test the brief requires to its test function.

## 13. Running Docker

```bash
docker compose up --build
```

The app is then at <http://localhost:8080>, with the API at <http://localhost:8000>. Both are reachable only from this machine. Data is kept in `backend/data/`, the same file a local run uses.

To use Postgres:

```bash
COMPOSE_DATABASE_URL=postgresql+psycopg://lessons:lessons@postgres:5432/lessons \
  docker compose --profile postgres up --build
```

## 14. Running the assessment demo

**One click:** select **Run assessment demo** on the dashboard.

**Command line,** with the backend running:

```bash
backend/.venv/Scripts/python scripts/run_demo.py
```

The demo injects "Missing practical retrieval example" into the first lesson. The evaluator should fail Q07, and the feedback should drive a revised lesson that passes all 10 checks. The script confirms all 12 expected steps from the API's data and saves results in `outputs/demo/`. See the [walkthrough](docs/guides/demo-walkthrough.md).

## 15. API documentation

Interactive docs are at `/docs`, and the schema is saved in [docs/api/openapi.json](docs/api/openapi.json). All paths start with `/api/v1`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/lessons/generate` | Run the workflow and return the final result |
| POST | `/lessons/generate/stream` | Run the workflow, streaming progress over SSE |
| GET | `/lessons/history` | List previous runs |
| GET | `/lessons/{run_id}` | Get one run |
| GET | `/lessons/{run_id}/evaluations` | Every evaluation |
| GET | `/lessons/{run_id}/rejections` | Rejection log |
| GET | `/lessons/{run_id}/versions` | Every lesson version |
| POST | `/lessons/{run_id}/feedback` | Add human feedback |
| GET | `/memory` | Memory records |
| GET | `/memory/patterns` | Failure patterns, strategies, topic patterns |
| GET | `/evolution/proposals` | Improvement proposals |
| POST | `/evolution/proposals/{id}/approve` | Approve and apply |
| POST | `/evolution/proposals/{id}/reject` | Reject |
| POST | `/evolution/proposals/{id}/rollback` | Undo an approved proposal |
| POST | `/evolution/analyze` | Analyse history now |
| GET | `/evolution/analysis` | Statistics from history |
| GET | `/evolution/metrics` | Outcomes per prompt version |
| GET | `/evolution/prompts` | All prompt versions |
| GET | `/stats` | Dashboard statistics |
| GET | `/health` | Health and configuration, with no secrets |

Example request:

```json
{
  "topic": "Introduction to RAG",
  "learner_profile": {"education": "12th-grade graduate", "english_level": "basic", "technical_level": "beginner"},
  "max_retries": 2,
  "reference_material": null,
  "demo_mode": false,
  "error_injection": null
}
```

## 16. Rubric explanation

Every criterion is mandatory, and all 10 must pass. There is no weighted score.

| ID | Criterion | Requires |
|---|---|---|
| Q01 | Accuracy | Factually correct and consistent with the reference material |
| Q02 | Beginner Friendliness | Understandable with no technical background |
| Q03 | Jargon Explanation | Terms explained before or when introduced |
| Q04 | What It Is | Clearly explains the core concept |
| Q05 | Why It Matters | Explains the problem solved and its importance |
| Q06 | How It Works | Logically ordered explanation of the whole workflow |
| Q07 | Practical Example | A concrete example that demonstrates the concept |
| Q08 | Teaching Flow | Moves from simple ideas to harder ones |
| Q09 | Standalone Completeness | Needs no external resources |
| Q10 | Consistency | No contradictions or misleading statements |

Each check returns a status, evidence, failure reason, suggested correction and affected sections. Deterministic validators run first and can force a FAIL, but can never turn a model's FAIL into a PASS.

## 17. Memory architecture

Memory is stored in the `agent_memory` table, so it survives restarts.

| Record type | Created when | Used for |
|---|---|---|
| Failure pattern | A criterion fails | Generator advice and evaluator notes, once it has recurred |
| Correction strategy | A criterion that failed passes after revision | Generator advice |
| Human feedback | A reviewer requests changes | Generator advice for that topic |
| Topic guidance | A topic proposal is approved | Generator advice for that topic |
| Run summary | A run ends | History |

Records exist per topic and globally. Prompt and rubric versions, past runs and evaluation failures are held in their own tables. Memory is never consulted when deciding PASS or FAIL, so it can't weaken the rubric. ([ADR 0008](docs/adr/0008-memory-is-additive.md))

## 18. Self-evolution design

After each run, stored evaluations are analysed for frequent failures, weak sections, regeneration patterns, effective corrections and topic failure rates. When evidence reaches a threshold, a proposal is created, but nothing changes.

A person approves or rejects each proposal. Approval creates a new prompt or rubric version, and rollback restores the previous one. Rubric proposals can only add guidance, and all 10 checks stay mandatory. Each run records its versions, so `/evolution/metrics` can compare outcomes. ([ADR 0009](docs/adr/0009-human-gated-evolution.md))

## 19. Deliberate error injection

Available only with `demo_mode: true`, and refused with a 403 when `APP_ENV=production`.

| Type | Expected failure | Caught by |
|---|---|---|
| `missing_practical_example` | Q07 | Validators and model |
| `missing_summary` | Q09 | Validators and model |
| `missing_knowledge_answers` | Q09 | Validators and model |
| `missing_term_explanation` | Q03 | Model |
| `incorrect_rag_stage` | Q01 | Model |
| `contradictory_statements` | Q10 | Model |

The run stores the type, what changed, the evaluator's result, and whether the error was detected and corrected. If an evaluator misses an injected error, the run ends in `ERROR` and isn't published. ([ADR 0011](docs/adr/0011-error-injection.md))

## 20. Design decisions

The reasoning and trade-offs are in [docs/design-decisions.md](docs/design-decisions.md), with one record per decision in [docs/adr](docs/adr/README.md). The main ones:

- Generation and evaluation are separate, and a lesson can't grade itself.
- PASS requires all 10 checks.
- Invalid output and provider failures end in `ERROR`, never in a publish.
- Revisions can only change the sections that failed, enforced in code.
- Prompt changes need human approval and can be rolled back.

## 21. Limitations

**Verification status:**

| Area | Status |
|---|---|
| Workflow, memory, evolution, API | Covered by automated tests, plus checks against real server processes |
| Live Gemini generation and evaluation | Run through the API: the 12-step demo passed, and the evaluator caught all three injected errors that only a model can detect. See [the results](outputs/demo/live_evaluator_checks.md). A small sample, not a measure of accuracy |
| Dashboard | Build and browser checks used the mock provider, with real-provider screens simulated. Not yet checked in a browser against live Gemini |
| OpenAI and Claude adapters | Tested offline only; never run against live APIs |
| Docker Compose and PostgreSQL | Written but not run, because the Docker daemon wasn't available |

**Gemini free tier:** on 2026-11-07 the free tier's error reported a limit of 20 requests per day per model. A normal run uses at least 2 requests and the assessment demo normally 4, so that is about five demos a day at best. Separately named models don't always give a fresh allowance: `gemini-3.5-flash` hit the limit after very few direct calls once `gemini-3.6-flash` was used up, while the lite models kept working. When a limit is reached, runs end in `ERROR` with a clear message. Results from a real run are saved in `outputs/demo/`. Models can also be overloaded: `gemini-3.8-flash` returned repeated 503 and 504 errors that day.

**By design:**

- A PASS means an evaluator found no failure, not that the lesson is certainly correct. Results can vary between runs, and a shared model can have shared blind spots.
- Mock mode shows that the pipeline works, not that a model judges well.
- There is no authentication, so reviewer names are self-declared. Put it behind an authenticating gateway before exposing it.
- The rate limiter and interrupted-run recovery work per process, so the app runs as one worker.
- An interrupted run must be restarted, because it can't resume.
- Cost is null until rates are configured.

## 22. Future improvements

- Authentication and roles for reviewers.
- An evaluation dataset of known-good and known-bad lessons, to measure the evaluator's accuracy.
- A second vendor as a cross-check evaluator on Q01.
- A/B testing of prompt versions, instead of comparing them over time.
- Learner testing to check real comprehension for Q02.
- A shared rate limiter for running several instances.
