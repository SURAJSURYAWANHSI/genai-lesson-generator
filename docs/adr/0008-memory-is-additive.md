# 0008: Memory is additive and can never relax the rubric

**Status:** Accepted
**Date:** 2026-11-07

## Context

A system that learns from past results could drift towards passing more by lowering its standard, for example by remembering that a certain weakness was previously accepted.

## Decision

Memory can only add guidance. The generator receives advice built from repeated failures, proven corrections, approved topic guidance and human feedback. The evaluator receives notes on where problems have been common, and those notes state that the rubric still applies as written.

The PASS decision reads only the checks of the current evaluation and never reads memory. Failure patterns only start producing guidance once they've recurred (`MEMORY_PATTERN_MIN_OCCURRENCES`), so one odd result doesn't shape future lessons. Memory is stored in the database, per topic and globally, so it survives restarts.

## Alternatives rejected

- **Vector search over past lessons:** extra infrastructure for no benefit, since lookups are by criterion and topic. The brief also warns against unnecessary technology.
- **Adjusting pass thresholds from history:** this is exactly what the brief forbids.

## Consequences

Failure counts in memory include demo runs, tracked separately as `demo_occurrences`, so injected errors can influence guidance. That guidance is additive and harmless, but the separate count lets a reviewer tell the difference. An instruction in the notes could still bias a model's reading, which is why the evaluator prompt says notes never excuse a failure.
