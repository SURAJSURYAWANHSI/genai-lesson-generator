# 0003: All-must-pass gate, with no weighted score

**Status:** Accepted
**Date:** 2026-11-07

## Context

A lesson that is excellent except for one wrong explanation still teaches something false. An average would let strength in one area outvote a serious defect in another.

## Decision

A lesson passes only when all 10 mandatory criteria pass:

```python
self.complete and all(check.status == "PASS" for check in self.checks)
```

`complete` is included so that a missing criterion can't pass by absence: `all()` of an empty list is true. Rubric definitions are validated whenever they are loaded, and any that remove a criterion or make one optional are refused.

## Alternatives rejected

- **A weighted score with a threshold:** explicitly ruled out by the brief, and it gives a failed criterion a way to be ignored.
- **Severity levels with some criteria advisory:** this adds a place for standards to slip, and every criterion in this rubric matters for a beginner.

## Consequences

The gate is simple to reason about and hard to bypass. It is also strict: one borderline judgement causes a retry, and that costs more than a score would. Over-strict evaluation can reject acceptable lessons, which human feedback and rubric guidance can help tune.
