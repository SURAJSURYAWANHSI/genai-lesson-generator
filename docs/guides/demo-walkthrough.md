# Assessment demo walkthrough

The demo shows the evaluator catching a deliberately damaged lesson, the system repairing it from structured feedback, and memory recording what worked.

**Scenario:** topic "Introduction to RAG", demo mode on, injected error "Missing practical retrieval example".

Results from a real Gemini run are saved in [outputs/demo](../../outputs/demo), including [checks on errors only a model can detect](../../outputs/demo/live_evaluator_checks.md).

## Run it

**From the dashboard:** start the backend and frontend, then select **Run the demo**.

**From the command line,** with the backend running:

```bash
backend/.venv/Scripts/python scripts/run_demo.py     # Windows
backend/.venv/bin/python scripts/run_demo.py         # macOS or Linux
```

The script checks each step below against what the API returns, exits non-zero if any step isn't confirmed, and overwrites the results in `outputs/demo/`.

Each demo normally uses 4 Gemini requests. The free tier's limit is low, so avoid repeat runs just before showing it to someone.

## What should happen

| # | Step | Where to see it |
|---|---|---|
| 1 | Initial lesson generated | Live workflow, Lesson generation |
| 2 | Error injected | Live workflow says a mistake was planted on purpose |
| 3 | Evaluator identifies Q07 | Evaluation report, attempt 1 |
| 4 | Lesson receives FAIL | Evaluation report, attempt 1 |
| 5 | Rejection log records evidence | Rejection log tab |
| 6 | Retry agent builds feedback | "Revision feedback" in the log entry |
| 7 | Revised lesson created | "What changed in the lesson" in the log entry, showing only the changed sections |
| 8 | Revised lesson evaluated | Evaluation report, attempt 2 |
| 9 | All criteria pass | Attempt 2 shows all 10 passed |
| 10 | Lesson published | Lesson tab shows the final version |
| 11 | Log stays accessible | Rejection log tab, or `GET /api/v1/lessons/{run_id}/rejections` |
| 12 | Strategy remembered | Memory page, successful correction strategies |

## With Gemini compared with mock

With Gemini, the lesson and judgements come from the real model. Attempt 1 can fail other criteria besides Q07, and a revision can take a third attempt, because real judgement varies. The mechanism is the same, but the exact content and number of attempts can differ.

With `LLM_PROVIDER=mock`, the run is fully repeatable and uses no quota, but the content is canned and the evaluator is rule-based. That shows the pipeline works, not that a real model judges well. A banner says when mock mode is on.

## Try the other paths

- **Rejection:** on the Generate page, turn on Demo mode, choose an error type and set the retry limit to 0. The run ends rejected after 1 attempt, with its lesson still readable and marked as not published. To exhaust all 3 attempts instead, send `persistent_error: true` to `POST /api/v1/lessons/generate` from the API docs at `/docs`.
- **Semantic detection:** choose "Incorrect explanation of a RAG stage" or "Contradictory lesson statements" with Gemini. The validators can't catch these, so this is the real test of the evaluator model.
- **Self-evolution:** after a criterion has failed 3 times, a proposal appears on the Self-Evolution page. Approve it and the next run uses a new prompt version. Roll it back to restore the previous one.
