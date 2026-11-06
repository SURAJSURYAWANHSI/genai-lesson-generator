# 0005: Fail closed on invalid output and provider failures

**Status:** Accepted
**Date:** 2026-11-07

## Context

Evaluators can return malformed output, omit criteria or time out. If any of these could lead to a lesson being treated as passed, the quality gate would be only as reliable as the provider.

## Decision

A run has three end states: `PASS`, `REJECTED` (a judged lesson that used up its attempts) and `ERROR` (the system could not reach a judgement). Only `PASS` publishes.

- Invalid evaluator output gets one corrective retry that names the problems, then the run ends in `ERROR`.
- Malformed generator output is retried once within the same attempt. A failed retry ends in `ERROR`.
- Provider errors end in `ERROR`. Provider SDKs handle transient retries and timeouts first.
- `finalize_lesson` re-checks that the status matches the evaluation before publishing.
- A run in demo mode whose evaluator misses the injected error ends in `ERROR` and is not published.

Clients get a safe message. Stack traces and raw provider messages stay in the logs, and only the error's class name is included, because provider messages can echo request details.

## Alternatives rejected

- **Treat an unreadable evaluation as a failed check and retry:** this spends generation attempts fixing a lesson that may have nothing wrong with it, using feedback that has no real content.
- **Fall back to deterministic checks alone:** this would publish lessons nobody has judged semantically.

## Consequences

A provider outage stops publishing instead of lowering quality, at the cost of availability. Any lesson produced before an error stays available for inspection.
