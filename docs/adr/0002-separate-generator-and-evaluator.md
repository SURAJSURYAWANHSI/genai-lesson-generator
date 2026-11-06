# 0002: Separate generator and evaluator, with no self-assessment

**Status:** Accepted
**Date:** 2026-11-07

## Context

A model reviewing its own output in the same context tends to approve it, because the reasoning that produced an error also justifies it. A lesson that grades itself gives no real assurance.

## Decision

The generator and evaluator are separate agents with separate prompts, stored as separately versioned prompt records. The evaluator receives the lesson as data and is told it did not write it. It does not receive the revision feedback, so a revised lesson is judged on its content and not on what it claims to have fixed.

The `Lesson` schema has no status field, and unknown fields are dropped during parsing, so a generator cannot mark its work as passed. The evaluator's vendor and model can also be configured separately through `EVALUATOR_PROVIDER` and `EVALUATOR_MODEL`.

## Alternatives rejected

- **One prompt that writes and then self-reviews:** cheapest, but offers little independence.
- **Self-assessment as an input to the evaluator:** it would anchor the evaluator's judgement and contribute nothing it can't check itself.

## Consequences

Every attempt costs at least two model calls. By default both roles use the same model, so independence comes from prompt and context separation and not from a different vendor. Blind spots shared by one model can still get through, and that is documented as a limitation.
