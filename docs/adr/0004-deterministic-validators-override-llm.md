# 0004: Deterministic validators run first and override the model

**Status:** Accepted
**Date:** 2026-11-07

## Context

Some requirements can be checked exactly: a section is empty, a question has no answer, a retrieved document isn't in the document list. A model can overlook these or be talked past them. Other requirements, such as whether an explanation is correct, need judgement.

## Decision

`validate_lesson` runs before the evaluator model on every attempt. The model still runs afterwards, so that one attempt's feedback covers everything wrong with the lesson. The results are then merged, and a deterministic issue forces its criterion to FAIL whatever the model said. A deterministic check can only make a result stricter, never more lenient.

The validators check structure only. None treats a keyword as proof of quality, and a test (`test_keywords_alone_prove_nothing`) records that.

Separately, `validate_evaluation_output` checks the evaluator's output itself: all 10 criteria once each, evidence on every check, and actionable feedback on every failure.

## Alternatives rejected

- **Stop at the first deterministic failure and skip the model:** saves one call, but the feedback would be partial, so fixing everything would take more retries overall.
- **Keyword checks for semantic criteria:** cheap but easily fooled, and ruled out by the brief.

## Consequences

Structural defects are caught with certainty and for free. The limits are configurable, such as `MIN_LESSON_WORDS`. Semantic quality still depends entirely on the model.
