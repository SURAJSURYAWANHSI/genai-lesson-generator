# Assessment demo walkthrough

The demo shows the evaluator catching a deliberately damaged lesson, the system repairing it from structured feedback, and memory recording what worked.

**Scenario:** topic "Introduction to RAG", demo mode on, injected error "Missing practical retrieval example".

## Run it

**From the dashboard:** start the backend and frontend, then select **Run assessment demo**.

**From the command line,** with the backend running:

```bash
backend/.venv/Scripts/python scripts/run_demo.py     # Windows
backend/.venv/bin/python scripts/run_demo.py         # macOS or Linux
```

The script checks each step below against what the API returns, exits non-zero if any step isn't confirmed, and writes results to `outputs/demo/`.

## What should happen

| # | Step | Where to see it |
|---|---|---|
| 1 | Initial lesson generated | Run detail, Versions, version 1 |
| 2 | Error injected | Version 1 is marked as injected, with before and after content |
| 3 | Evaluator identifies Q07 | Evaluation report, attempt 1 |
| 4 | Lesson receives FAIL | Attempt 1 status |
| 5 | Rejection log records evidence | Rejection log tab |
| 6 | Retry agent builds feedback | "Revision feedback" in the log entry |
| 7 | Revised lesson created | Version 2, showing only the changed sections |
| 8 | Revised lesson evaluated | Evaluation report, attempt 2 |
| 9 | All criteria pass | 10 of 10 PASS |
| 10 | Lesson published | Lesson tab, final version |
| 11 | Log stays accessible | `GET /api/v1/lessons/{run_id}/rejections` |
| 12 | Strategy remembered | Memory page, correction strategies for Q07 |

## With Gemini compared with mock

With Gemini, the lesson and judgements come from the real model. Attempt 1 can fail other criteria besides Q07, and a revision can take a third attempt, because real judgement varies. The mechanism is the same, but the exact content and number of attempts can differ.

With `LLM_PROVIDER=mock`, the run is fully repeatable at zero cost, but the content is canned and the evaluator is rule-based. That shows the pipeline works, not that a real model judges well.

## Try the other paths

- **Rejection:** turn on the persistent error option. The defect returns on every attempt, so the run ends `REJECTED` after 3 generations, with its lesson still viewable.
- **Semantic detection:** choose "Incorrect explanation of a RAG stage" or "Contradictory lesson statements" with Gemini. The validators can't catch these, so this is the real test of the evaluator model.
- **Self-evolution:** after a criterion has failed 3 times, a proposal appears on the Evolution page. Approve it and the next run uses a new prompt version. Roll it back to restore the previous one.
