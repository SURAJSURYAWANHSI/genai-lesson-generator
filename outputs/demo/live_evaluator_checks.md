# Live evaluator checks on Gemini

Run on 2026-11-07 through the API. These are single runs on the free tier: they show the evaluator working on real model output, but the sample is too small to measure accuracy.

The defects below can't be caught by the deterministic validators, because the lesson's structure stays valid. Only the evaluator model could find them.

| Run | Model | Result | Failed on attempt 1 | Revision changed |
|---|---|---|---|---|
| Incorrect explanation of a RAG stage (expected Q01) | `gemini-3.6-flash` | Passed on attempt 2 | Q01, Q10 | `what_it_means` only |
| Contradictory statement (expected Q10) | `gemini-3.6-flash` | Passed on attempt 2 | Q01, Q10 | `summary` only |
| Unexplained jargon (expected Q03) | `gemini-3.6-flash` | Stopped with an error during revision | Q02, Q03, Q06 | Not reached: the daily quota ran out |
| RAG lesson, no injected error | `gemini-3.6-flash` | Passed on attempt 1 | None | Not needed |
| Compound interest lesson, no injected error | `gemini-3.5-flash-lite` | Passed on attempt 1 | None | Not needed |

All three injected defects were detected, each on its expected criterion. For the jargon run, correction wasn't observed because the quota ran out first.

## Evidence from the evaluator

**Incorrect RAG stage, Q01:** "In the what_it_means section, the lesson states: 'Retrieval means the AI model invents new facts from its own imagination, without looking at any documents.' This is factually incorrect..."

**Contradiction, Q10:** "In the summary section, the lesson states 'The retrieved text is added to the prompt so the model can write an accurate, fact-based answer.' but ends with 'Remember that RAG never looks at or uses any documents when it answers a question.'"

**Unexplained jargon, Q03:** "In step_by_step_process step 1, the terms 'cosine similarity' and 'approximate nearest neighbour index' are introduced, but neither term is defined or explained anywhere in the lesson or terminology list."

## Not covered live

Rejection after all retries was tested with the mock provider and scripted responses, not on Gemini. It doesn't depend on the model, because a re-injected defect keeps failing the same check.
