# Changelog

## Unreleased

- Applied an always-dark Midnight Black and Lime Green theme to the dashboard, with a bundled font and transitions.
- Live workflow: stages run left to right on wide screens, and finished stages stay marked Done while a retry runs.
- Average attempts shows 0 before any run has finished.
- Added a hero entry animation and hid scrollbars.

## 1.0.0 - 2026-11-07

Initial release.

- LangGraph workflow: generation, evaluation, retries with structured feedback, publish or reject.
- Mandatory 10-check rubric with deterministic validators and an independent evaluator.
- Provider layer with Gemini as default, plus OpenAI and Claude, set through environment variables.
- Persistent memory and human-approved self-evolution with versioning and rollback.
- Deliberate error injection in demo mode, blocked in production.
- REST and Server-Sent Events API, and a React dashboard.
- Docker setup, ADRs, design documentation and session logs.
