# 0011: Error injection after generation, blocked in production

**Status:** Accepted
**Date:** 2026-11-07

## Context

An evaluator that has only ever seen good lessons hasn't been shown to catch bad ones. The brief requires deliberate, recorded defects, unavailable in production.

## Decision

The defect is applied by code to the lesson the generator returned, before evaluation, on attempt 1 only. The generator doesn't know about it, and a real model can't "accidentally" avoid it.

Six types are supported, each with its expected criterion. The record stored on the run holds the type, the before and after content, the evaluator's result per attempt, and whether the defect was `detected` and `corrected`. An optional API field, `persistent_error`, re-injects on every attempt to demonstrate exhausting all retries. In the dashboard, a retry limit of 0 with an error type shows a rejection.

Controls: `error_injection` requires `demo_mode` (422), and production returns 403 before any work starts. If the evaluator passes an injected lesson, the run ends in `ERROR` and is not published.

## Alternatives rejected

- **Asking the generator to include the error:** a model may not comply exactly, which would make results unrepeatable.
- **Allowing it in production behind a flag:** there is no good reason to risk publishing deliberately damaged content.

## Consequences

Structural defects (missing summary, answers, example) are also caught deterministically, so they demonstrate the whole gate and not just the model. Semantic defects (wrong stage, contradiction, jargon) are the real test of the evaluator model, and only live runs measure that. Three types apply only to RAG lessons because their content is RAG-specific.
