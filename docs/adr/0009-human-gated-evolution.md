# 0009: Human-gated evolution with versioning and rollback

**Status:** Accepted
**Date:** 2026-11-07

## Context

A system that rewrites its own prompts can degrade in ways nobody notices. The brief requires proposals with evidence, human approval, versioning and rollback.

## Decision

`EvolutionEngine` analyses stored evaluations by plain counting and creates proposals when evidence reaches a threshold. Analysis runs after each run and on demand, but creating a proposal changes nothing.

| Proposal type | Trigger | Effect on approval |
|---|---|---|
| `generator_prompt` | A criterion failed at least `EVOLUTION_MIN_FAILURES` times | New generator prompt version |
| `instructional_strategy` | A correction worked at least `EVOLUTION_MIN_STRATEGY_SUCCESSES` times | New generator prompt version |
| `topic_guidance` | At least half of a topic's runs (minimum 2) failed first time | Active memory record for that topic |
| `rubric_improvement` | A criterion was still failing at the end of at least 2 rejected runs | New rubric version with additional guidance |

Rubric proposals can only add guidance. `assert_additive_change` refuses anything that alters a definition or removes a check. Rollback restores the previous version and is refused with a 409 if a newer version has since been applied. Each run records the versions it used, so `/evolution/metrics` can compare outcomes across prompt versions. A rejected idea returns only after clearly more evidence accumulates.

## Alternatives rejected

- **Auto-applying changes above a confidence level:** forbidden by the brief, and it removes the accountability that makes evolution safe.
- **Having a model write proposals:** richer wording, but more cost, less predictability and weaker traceability to the evidence.

## Consequences

Every change has a named reviewer, evidence and a way back. Proposed wording is templated and therefore plain. Reviewer identity is self-declared because the system has no authentication, a limitation documented in the README. Metrics show correlation over small samples, not proof that a change helped.
