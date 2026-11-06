# 0007: Per-node database persistence instead of a checkpointer

**Status:** Accepted
**Date:** 2026-11-07

## Context

The brief asks for LangGraph checkpointing "or an equivalent persistent mechanism". The information that must last (versions, evaluations, rejection logs, memory) has to be queryable by the API anyway.

## Decision

Nodes write to the application's tables in short transactions as they go. These tables are the system of record. No LangGraph checkpointer is configured. A run still in `RUNNING` at startup is closed as `ERROR` with an explanation, so it can't appear stuck forever.

## Alternatives rejected

- **`SqliteSaver`:** adds a dependency and a second store for overlapping data, and a different package would be needed on Postgres.
- **`MemorySaver`:** gives no durability and grows for as long as the process lives.

## Consequences

There is one source of truth, and every run is inspectable after a crash up to its last completed node. An interrupted run can't resume from where it stopped and must be started again. That costs little here, since a run is short and retrying is safe.
