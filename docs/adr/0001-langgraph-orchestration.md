# 0001: LangGraph for orchestration

**Status:** Accepted
**Date:** 2026-11-07

## Context

The workflow is a loop with branching: generate, evaluate, record, then publish, retry or reject. It must stop under every condition, and each step's progress must be visible to a live UI. The brief requires LangGraph.

## Decision

Model the workflow as a LangGraph `StateGraph` with a typed state and one node per responsibility. Retries and exits are conditional edges, so the control flow can be read from the graph definition in `backend/app/graph/workflow.py`.

Termination is enforced in three independent places: `max_retries` is bounded by the API schema, `enforce_attempt_limit` runs before every generation with an absolute cap of 3, and the graph is invoked with a recursion limit of 25 (the longest valid path is 20 steps).

## Alternatives rejected

- **A hand-written `while` loop:** shorter, but it hides the state machine inside control flow and gives no per-node streaming.
- **A free-running agent that decides its own next step:** the sequence here is known in advance. Letting a model choose it would add cost and unpredictability, and would make the quality gate easier to skip.

## Consequences

Streaming progress comes almost free through `graph.stream`, and each node can be understood alone. The cost is a framework dependency for a graph small enough to write by hand.
